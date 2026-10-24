import { fmtNum } from './calendar';
import { getCountry } from '../data/countries';
import type { CountryModule } from './country';
import { partyChoice, partyStance, proposalSupport, seatImpact, type VoteChoice } from './actors/voting';
import { addDays, addMonths, addYears, cmp, daysBetween, fmtDate, month, monthsBetween, nextSunday, year } from './calendar';
import { externalEvents, endogenousEvents } from './events';
import { indicators, initEconomy, initFiscal, makeFiscal, potentialNominal, stepEconomy } from './economy/model';
import { chamberSize, composition, nationalEstimate, runElection, seatMap } from './electoral/elections';
import { aggregate, territoryVote } from './electoral/voters';
import { aiDeals, answerDeal, DEALS, deadlinePassed, investitureVotes, kingsCandidate, type DealKind } from './government/formation';
import { getDef, processProcedures, resumeAfterLegislature, startProcedure, stepMajority, type ProcedureHooks } from './legal/procedures';
import { num, ruleAt, str } from './legal/rules';
import { stream } from './rng';
import type {
  Amendment,
  CountryId,
  ElectionResult,
  GameState,
  ISODate,
  IssueId,
  Legislator,
  LogEntry,
  Party,
  PendingDecision,
  ProcedureInstance,
  Proposal,
  RuleValue,
  TurnReport,
} from './types';

export const FORMAT_VERSION = 1;
export const APP_VERSION = '0.1.0';

const FIRST = ['Ana', 'Luis', 'Marta', 'Jorge', 'Elena', 'Diego', 'Lucía', 'Raúl', 'Sofía', 'Andrés', 'Carmen', 'Tomás', 'Irene', 'Pablo', 'Rosa', 'Mateo', 'Julia', 'Héctor', 'Clara', 'Samuel'];
const LAST = ['Valdés', 'Ortega', 'Quintana', 'Robles', 'Salinas', 'Herrera', 'Medina', 'Fuentes', 'Navarro', 'Campos', 'Ibarra', 'Soler', 'Lozano', 'Prieto', 'Vidal', 'Cordero', 'Arenas', 'Mejía', 'Paredes', 'Esquivel'];

export interface NewGameConfig {
  country: CountryId;
  difficulty: GameState['difficulty'];
  seed: string;
  partyMode: 'nuevo' | 'existente';
  baseParty?: string;
  party: { name: string; short: string; color: string; econ: number; social: number; priorities: IssueId[] };
  leader: string;
  promises: string[];
}

const DIFF = {
  facil: { playerValence: 0.15, incumbentValence: 0.0, funds: 110, strengthNew: 0.38 },
  normal: { playerValence: 0.05, incumbentValence: 0.12, funds: 75, strengthNew: 0.3 },
  dificil: { playerValence: 0.0, incumbentValence: 0.25, funds: 45, strengthNew: 0.22 },
};

function fiscalYearOf(c: CountryModule, d: ISODate): number {
  const fy = c.economy.fiscalYearStartMonth;
  return fy === 1 ? year(d) : month(d) >= fy ? year(d) + 1 : year(d);
}

function fiscalYearStart(c: CountryModule, fy: number): ISODate {
  const m = c.economy.fiscalYearStartMonth;
  return m === 1 ? `${fy}-01-01` : `${fy - 1}-${String(m).padStart(2, '0')}-01`;
}

export function newGame(cfg: NewGameConfig): GameState {
  const c = getCountry(cfg.country);
  const r = stream(cfg.seed, 'creacion');
  const D = DIFF[cfg.difficulty];
  const name = () => `${r.pick(FIRST)} ${r.pick(LAST)}`;
  let playerId = 'jugador';
  const parties: Party[] = c.parties.map((t) => ({ ...t, valence: 0, isPlayer: false, leader: name(), funds: 60, promises: [] }));
  const P = cfg.party;
  if (cfg.partyMode === 'existente' && cfg.baseParty) {
    const p = parties.find((x) => x.id === cfg.baseParty);
    if (!p) throw new Error('Partido base no encontrado');
    playerId = p.id;
    const clamp = (v: number, base: number) => Math.max(base - 0.25, Math.min(base + 0.25, v));
    Object.assign(p, { name: P.name || p.name, short: P.short || p.short, color: P.color || p.color, econ: clamp(P.econ, p.econ), social: clamp(P.social, p.social), priorities: P.priorities.length ? P.priorities : p.priorities, isPlayer: true, leader: cfg.leader, valence: D.playerValence, funds: D.funds, promises: [...cfg.promises] });
  } else {
    parties.push({ id: playerId, name: P.name, short: P.short, color: P.color, econ: P.econ, social: P.social, priorities: P.priorities, strength: D.strengthNew, isPlayer: true, leader: cfg.leader, valence: D.playerValence, funds: D.funds, promises: [...cfg.promises] });
  }
  const candidates = parties.filter((p) => !p.isPlayer && !p.regionalGroups && p.establishedSeats && p.strength >= 0.5);
  const incumbent = candidates[Math.floor(r.next() * candidates.length)] ?? parties.find((p) => !p.isPlayer)!;
  incumbent.valence = D.incumbentValence;
  incumbent.incumbent = true;
  const rules = Object.fromEntries(c.rules.map((x) => [x.id, JSON.parse(JSON.stringify(x))]));
  const start = c.scenario.start;
  const g: GameState = {
    format: 'naciones-partida',
    formatVersion: FORMAT_VERSION,
    id: `partida-${cfg.seed}-${Date.now().toString(36)}`,
    branchId: 'principal',
    branchLabel: 'Rama principal',
    seed: cfg.seed,
    country: cfg.country,
    rulesetVersion: c.rulesetVersion,
    rules,
    amendments: [],
    difficulty: cfg.difficulty,
    createdAt: new Date().toISOString(),
    date: start,
    startDate: start,
    phase: 'campana',
    playerParty: playerId,
    playerRole: 'candidato',
    candidateName: cfg.leader,
    parties,
    legislators: [],
    regional: [],
    groups: JSON.parse(JSON.stringify(c.interestGroups)),
    government: { executiveParty: incumbent.id, executiveName: incumbent.leader, coalition: [incumbent.id], supportParties: [], since: addYears(start, -2), termsServed: { [incumbent.leader]: 1 } },
    economy: initEconomy(c),
    fiscal: initFiscal(c, fiscalYearOf(c, start)),
    procedures: [],
    elections: [],
    schedule: [{ date: c.scenario.firstElection, offices: [...c.scenario.offices], reason: 'Elecciones generales' }],
    polls: [],
    log: [],
    decisions: [],
    history: [],
    reports: [],
    campaign: { round: 0, visited: [], focus: [], mobilization: {}, debateDone: false },
    counters: { seq: 0, turn: 0 },
    policy: { econ: 0, social: 0 },
    installs: [],
  };
  // Composición inicial simulada de las cámaras (ficticia) y gobiernos territoriales
  baselineLegislature(g);
  assignRegional(g);
  addLog(g, 'inicio', `Comienza la partida en ${c.name}`, `${c.scenario.note} Reglas jurídicas: versión ${c.rulesetVersion}. Semilla: ${cfg.seed}.`, 'juridica');
  addLog(g, 'inicio', `Gobierno saliente: ${incumbent.name}`, `El Ejecutivo en funciones al inicio es ficticio (${incumbent.leader}). La composición inicial de las cámaras es simulada.`, 'simulacion');
  takePoll(g, 'Encuesta inicial');
  snapshot(g);
  return g;
}

function baselineLegislature(g: GameState) {
  const c = getCountry(g.country);
  const offices = c.chambers.map((ch) => ch.id);
  const out = runElection(g, offices, addYears(g.date, -2));
  g.legislators = out.legislators;
  if (g.country === 'us') {
    // Senado completo: tres clases
    const ctxVotes = c.territories.map((t) => ({ t, w: Object.entries(nationalEstimate(g).byTerritory[t.id] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] }));
    g.legislators = g.legislators.filter((l) => l.chamber !== 'senado');
    for (const { t, w } of ctxVotes) {
      for (const cls of t.senateClasses ?? []) {
        const p = g.parties.find((x) => x.id === w) ?? g.parties[0];
        g.legislators.push({ id: `senado-${t.id}-c${cls}`, chamber: 'senado', territory: t.id, party: p.id, econ: p.econ, social: p.social, discipline: 0.72, termEnds: '2099-01-01' });
      }
    }
  }
}

function assignRegional(g: GameState) {
  const c = getCountry(g.country);
  if (c.system.territorial === 'unitario') return;
  const est = nationalEstimate(g).byTerritory;
  const groups = g.country === 'us' ? c.territories.map((t) => ({ id: t.id, terr: [t] })) : (c.groups ?? []).map((gr) => ({ id: gr.id, terr: c.territories.filter((t) => t.group === gr.id) }));
  g.regional = groups.map((gr) => {
    const sum: Record<string, number> = {};
    for (const t of gr.terr) for (const [p, s] of Object.entries(est[t.id] ?? {})) sum[p] = (sum[p] ?? 0) + s * t.pop;
    const w = Object.entries(sum).sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.parties[0].id;
    return { group: gr.id, party: w };
  });
}

// ------------------------------------------------------------------ utilidades

export function addLog(g: GameState, kind: LogEntry['kind'], title: string, detail: string, layer: LogEntry['layer'] = 'simulacion', data?: Record<string, unknown>) {
  g.counters.seq++;
  g.log.push({ id: `log-${g.counters.seq}`, date: g.date, kind, title, detail, layer, data });
  if (g.log.length > 600) g.log.splice(0, g.log.length - 600);
}

export function party(g: GameState, id: string): Party {
  const p = g.parties.find((x) => x.id === id);
  if (!p) throw new Error(`Partido desconocido: ${id}`);
  return p;
}

export function playerParty(g: GameState): Party {
  return party(g, g.playerParty);
}

export function isPlayerExecutive(g: GameState): boolean {
  return g.government.executiveParty === g.playerParty;
}

function snapshot(g: GameState) {
  const ind = indicators(g) as unknown as Record<string, number>;
  g.history.push({ date: g.date, ind: Object.fromEntries(Object.entries(ind).map(([k, v]) => [k, Math.round(v * 100) / 100])) });
  if (g.history.length > 400) g.history.shift();
}

export function nextElection(g: GameState): GameState['schedule'][number] | undefined {
  return [...g.schedule].sort((a, b) => cmp(a.date, b.date)).find((s) => cmp(s.date, g.date) >= 0);
}

export function campaignOpen(g: GameState): boolean {
  if (g.phase === 'campana') return true;
  const n = nextElection(g);
  return g.phase === 'gobierno' && !!n && daysBetween(g.date, n.date) <= 120;
}

export function takePoll(g: GameState, label = 'Encuesta') {
  const est = nationalEstimate(g);
  const r = stream(g.seed, 'encuesta', g.date, g.polls.length);
  const n = 1000;
  const shares: Record<string, number> = {};
  for (const [p, s] of Object.entries(est.shares)) {
    const sd = Math.sqrt((s * (1 - s)) / n);
    shares[p] = Math.max(0, s + r.normal(0, sd) + r.normal(0, 0.12 * s + 0.002)); // error muestral + efecto de la encuestadora
  }
  const tot = Object.values(shares).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(shares)) shares[k] = Math.round((shares[k] / tot) * 1000) / 10;
  g.polls.push({ date: g.date, sample: n, shares, moe: Math.round(1.96 * Math.sqrt(0.25 / n) * 1000) / 10, label });
  if (g.polls.length > 60) g.polls.shift();
}

// ------------------------------------------------------------------ propuestas e iniciativa

export interface Check {
  ok: boolean;
  errors: string[];
  warnings: string[];
  procedureId?: string;
  normType?: string;
}

function seatsOf(g: GameState, chamber: string, partyId: string): number {
  return composition(g, chamber)[partyId] ?? 0;
}

/** Verifica quién puede iniciar una norma y si el momento procesal lo permite (motor jurídico). */
export function checkInitiative(g: GameState, proposal: Proposal, proposer: string = g.playerParty): Check {
  const c = getCountry(g.country);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (g.phase !== 'gobierno') errors.push('Sólo se pueden presentar iniciativas una vez constituido el Gobierno (fase de gobierno).');
  const isExec = g.government.executiveParty === proposer;
  const def = c.procedures.find((p) => p.id === proposal.procedureId);
  if (!def) errors.push('Procedimiento no disponible.');
  const nt = proposal.normType;
  const mainChamber = c.chambers[0].id;
  if (nt === 'decreto-ejecutivo' && !isExec) errors.push('Sólo el Ejecutivo puede dictar este decreto.');
  if (nt === 'ley-presupuesto' && !isExec) errors.push('La iniciativa presupuestaria corresponde exclusivamente al Ejecutivo.');
  if (nt === 'ley-ordinaria' || nt === 'ley-organica') {
    if (g.country === 'es' && !isExec && seatsOf(g, 'congreso', proposer) < 5) errors.push('Para presentar una proposición de ley hace falta un grupo parlamentario (el juego exige al menos 5 diputados; pendiente de cotejo con el Reglamento).');
    if (g.country === 'sv' && !isExec && seatsOf(g, 'asamblea', proposer) < 1) errors.push('Hace falta al menos un diputado para presentar la iniciativa.');
    if (g.country === 'us' && seatsOf(g, 'camara', proposer) < 1) errors.push('Una ley federal debe presentarla un miembro del Congreso; su partido no tiene representantes.');
  }
  if (nt === 'constitucion') {
    if (g.country === 'sv') {
      const min = num(g, 'sv.reforma.iniciativa');
      const s = seatsOf(g, 'asamblea', proposer);
      if (s < min) errors.push(`La reforma constitucional sólo pueden proponerla al menos ${min} diputados (art. 248). Su grupo tiene ${s}.`);
    }
    if (g.country === 'es' && !isExec) {
      const min = num(g, 'es.reforma.iniciativa');
      if (seatsOf(g, 'congreso', proposer) < min) errors.push(`Sin ser Gobierno, una proposición de reforma constitucional necesita 1/5 de los diputados (${min}) o dos grupos. Su grupo no llega.`);
    }
    if (g.country === 'us' && seatsOf(g, 'camara', proposer) + seatsOf(g, 'senado', proposer) < 1) errors.push('Su partido no tiene miembros en el Congreso para presentar la resolución conjunta.');
  }
  if (nt === 'reglamento-parlamentario') {
    const comp = composition(g, 'senado');
    const top = Object.entries(comp).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[0] !== proposer) errors.push('Sólo la mayoría del Senado (su líder) puede impulsar este precedente.');
  }
  // duplicados
  const dup = g.procedures.find((p) => p.status === 'en-tramite' && ((proposal.reformId && p.proposal.reformId === proposal.reformId) || (proposal.kind === 'presupuesto' && p.proposal.kind === 'presupuesto') || (proposal.levers && p.proposal.levers && Object.keys(proposal.levers).some((k) => k in (p.proposal.levers ?? {})))));
  if (dup) errors.push(`Ya hay una iniciativa en trámite sobre la misma materia: «${dup.title}».`);
  if (mainChamber && !g.legislators.some((l) => l.chamber === mainChamber)) errors.push('No hay legislatura constituida.');
  // reglas pendientes: desactivan la acción
  for (const rid of def?.ruleIds ?? []) if (g.rules[rid]?.verification === 'pendiente') errors.push(`La regla «${g.rules[rid].title}» está pendiente de verificación: acción desactivada.`);
  for (const rid of def?.ruleIds ?? []) if (g.rules[rid]?.verification === 'por-cotejar') warnings.push(`Regla pendiente de cotejo con el texto oficial: ${g.rules[rid].title}.`);
  return { ok: errors.length === 0, errors, warnings, procedureId: proposal.procedureId, normType: nt };
}

let tmpSeq = 0;
export function makeReformProposal(g: GameState, reformId: string, value: RuleValue, routeId?: string): { proposal: Proposal | null; routing: ReturnType<CountryModule['reforms'][number]['classify']> } {
  const c = getCountry(g.country);
  const rf = c.reforms.find((r) => r.id === reformId);
  if (!rf) throw new Error('Reforma desconocida');
  const routing = rf.classify(value, g);
  if (!routing.allowed) return { proposal: null, routing };
  const route = routing.routes?.find((x) => x.id === routeId);
  const procedureId = route?.procedureId ?? routing.procedureId!;
  const label = rf.options.find((o) => o.value === value)?.label ?? String(value);
  const proposal: Proposal = {
    id: `prop-${++tmpSeq}`,
    kind: 'reforma',
    title: `${rf.title}: ${label}`,
    summary: rf.question,
    normType: routing.normType,
    procedureId,
    reformId,
    reformValue: value,
    position: rf.position,
    intensity: rf.intensity,
    concessions: [],
  };
  return { proposal, routing };
}

export function makePolicyProposal(g: GameState, kind: 'tributaria' | 'sectorial', levers: Record<string, number>, reconciliation = false): Proposal {
  const c = getCountry(g.country);
  let econ = 0, social = 0, intensity = 0;
  const parts: string[] = [];
  let normType: Proposal['normType'] = 'ley-ordinaria';
  let procedureId = c.procedureFor('tributaria');
  for (const [k, v] of Object.entries(levers)) {
    const t = c.taxes.find((x) => x.id === k);
    const reg = c.regulations.find((x) => x.id === k);
    const cur = g.fiscal.levers[k] ?? t?.base ?? reg?.base ?? 0;
    const base = t?.base ?? reg?.base ?? 1;
    const rel = (v - cur) / (base || 1);
    if (t) {
      econ += -rel * 1.5; // subir impuestos se percibe como más intervención
      parts.push(`${t.name}: ${cur} → ${v}`);
    }
    if (reg) {
      econ += rel * reg.econDir * 1.5;
      social += rel * reg.socialDir * 1.5;
      normType = reg.normType;
      procedureId = reg.procedureId;
      parts.push(`${reg.name}: ${cur} → ${v}`);
    }
    intensity += Math.abs(rel);
  }
  if (kind === 'tributaria' && reconciliation && g.country === 'us') procedureId = 'us.reconciliacion';
  const n = Math.hypot(econ, social) || 1;
  return {
    id: `prop-${++tmpSeq}`,
    kind,
    title: kind === 'tributaria' ? 'Reforma tributaria' : parts.length === 1 ? parts[0].split(':')[0] : 'Paquete de medidas',
    summary: parts.join(' · '),
    normType,
    procedureId,
    levers,
    position: { econ: econ / n, social: social / n },
    intensity: Math.min(1, intensity * 2),
    concessions: [],
  };
}

export function makeBudgetProposal(g: GameState, pct: Record<string, number>, financing?: number): Proposal {
  const c = getCountry(g.country);
  const fy = fiscalYearOf(c, g.date) + (cmp(g.date, fiscalYearStart(c, fiscalYearOf(c, g.date))) >= 0 ? 1 : 0);
  let econ = 0;
  let tot = 0;
  for (const b of c.budget) {
    const cur = g.fiscal.spendingPct[b.id] ?? b.basePct;
    const v = pct[b.id] ?? cur;
    econ += -(v - cur) * (b.id === 'seguridad' ? 0.3 : 1);
    tot += Math.abs(v - cur);
  }
  if (financing !== undefined) econ -= ((financing - (g.fiscal.levers.financiacion ?? 100)) / 100) * 10;
  const intensity = Math.min(1, tot / 3);
  return {
    id: `prop-${++tmpSeq}`,
    kind: 'presupuesto',
    title: `Presupuesto del ejercicio ${fy}`,
    summary: 'Asignaciones de gasto por categoría en % del PIB.',
    normType: 'ley-presupuesto',
    procedureId: c.procedureFor('presupuesto'),
    budget: { ...pct },
    levers: financing !== undefined ? { financiacion: financing } : undefined,
    fiscalYear: fy,
    position: { econ: Math.max(-1, Math.min(1, econ / 2)), social: 0 },
    intensity: Math.max(0.05, intensity),
    concessions: [],
  };
}

/** Estimación previa de una votación (sin defecciones). */
export function previewVotes(g: GameState, proposal: Proposal, proposer = g.playerParty) {
  const c = getCountry(g.country);
  const def = getDef(g, proposal.procedureId);
  const impact = seatImpact(g, proposal);
  const chambers = c.chambers.map((ch) => {
    const comp = composition(g, ch.id);
    const rows = g.parties.filter((p) => comp[p.id]).map((p) => {
      const st = partyStance(g, p, proposal, proposer, impact);
      return { party: p, seats: comp[p.id], stance: st.stance, choice: p.id === g.playerParty && proposer === g.playerParty ? ('si' as VoteChoice) : partyChoice(st.stance), reasons: st.reasons };
    });
    const yes = rows.filter((r) => r.choice === 'si').reduce((a, r) => a + r.seats, 0);
    const no = rows.filter((r) => r.choice === 'no').reduce((a, r) => a + r.seats, 0);
    const abst = rows.filter((r) => r.choice === 'abstencion').reduce((a, r) => a + r.seats, 0);
    const steps = def.steps.filter((s) => s.chamber === ch.id && (s.kind === 'votacion' || s.kind === 'veto-camara')).map((s) => ({ step: s, majority: stepMajority(g, s) }));
    return { chamber: ch, members: chamberSize(g, ch.id), rows, yes, no, abst, steps };
  });
  return { chambers, support: proposalSupport(g, proposal), impact };
}

export function addConcession(proposal: Proposal, partyId: string, kind: 'prioridad' | 'inversion-territorial', partyName: string): Proposal {
  const p: Proposal = JSON.parse(JSON.stringify(proposal));
  if (p.concessions.some((c) => c.partyId === partyId && c.kind === kind)) return p;
  if (kind === 'prioridad') {
    p.concessions.push({ partyId, kind, label: `Incluir prioridades de ${partyName}`, cost: 0, value: 0.42 });
    p.intensity = Math.max(0.05, p.intensity * 0.85);
  } else p.concessions.push({ partyId, kind, label: `Inversión territorial pactada con ${partyName}`, cost: 0.05, value: 0.48 });
  return p;
}

export function submitProposal(g0: GameState, proposal: Proposal): { game: GameState; check: Check; procedure?: ProcedureInstance } {
  const check = checkInitiative(g0, proposal);
  if (!check.ok) return { game: g0, check };
  const g = clone(g0);
  const def = getDef(g, proposal.procedureId);
  const proc = startProcedure(g, def, { title: proposal.title, proposal, proposerParty: g.playerParty });
  addLog(g, 'procedimiento', `Se presenta: ${proposal.title}`, `${def.name}. Inicia el trámite el ${fmtDate(g.date)}.`, 'juridica', { procedureId: proc.id });
  return { game: g, check, procedure: proc };
}

export function attemptShortcut(g0: GameState, reformId: string, shortcutId: string): { game: GameState; message: string } {
  const c = getCountry(g0.country);
  const sc = c.shortcuts.find((s) => s.id === shortcutId);
  const rf = c.reforms.find((r) => r.id === reformId);
  if (!sc || !rf) return { game: g0, message: 'Acción desconocida.' };
  const g = clone(g0);
  addLog(g, 'intento-invalido', `Intento sin validez jurídica: ${rf.title}`, `${sc.explain} La regla no cambia. Coste en confianza institucional: parámetro del juego.`, 'juridica', { reformId, shortcutId });
  g.economy.shocks.trust -= 2;
  return { game: g, message: sc.explain };
}

export function setPlayerVote(g0: GameState, procId: string, choice: VoteChoice): GameState {
  const g = clone(g0);
  const p = g.procedures.find((x) => x.id === procId);
  if (p) p.meta = { ...(p.meta ?? {}), playerVote: choice };
  return g;
}

export function resolveDecision(g0: GameState, decisionId: string, option: string): GameState {
  const g = clone(g0);
  const d = g.decisions.find((x) => x.id === decisionId);
  if (!d) return g;
  const p = g.procedures.find((x) => x.id === d.procedureId);
  if (p) p.meta = { ...(p.meta ?? {}), [`decision-${p.currentStep}`]: option };
  if (d.kind === 'voto-investidura') g.government.formation = { ...(g.government.formation ?? { attempts: [], offers: {}, caretaker: g.government.executiveParty }), offers: { ...(g.government.formation?.offers ?? {}), __playerVote: option } };
  g.decisions = g.decisions.filter((x) => x.id !== decisionId);
  addLog(g, 'decision', `Decisión: ${d.title}`, d.options.find((o) => o.id === option)?.label ?? option, 'simulacion');
  return g;
}

// ------------------------------------------------------------------ hooks de procedimiento

const hooks: ProcedureHooks = {
  applyLaw: (g, proc) => applyLaw(g, proc),
  dissolve: (g, proc) => {
    const d = nextSunday(addDays(g.date, num(g, 'es.elecciones.plazo')));
    g.schedule = [{ date: d, offices: ['congreso', 'senado'], reason: `Disolución por el art. 168 (${proc.title})` }];
    addLog(g, 'procedimiento', 'Disolución de las Cortes por reforma agravada', `Elecciones el ${fmtDate(d)}.`, 'juridica');
  },
  log: (g, kind, title, detail, data) => addLog(g, kind, title, detail, kind === 'votacion' ? 'simulacion' : 'juridica', data),
  playerVote: (g, proc) => (proc.meta?.playerVote as VoteChoice | undefined) ?? (proc.proposerParty === g.playerParty ? 'si' : undefined),
  playerDecision: (g, proc, step) => {
    const key = `decision-${step.id}`;
    const val = proc.meta?.[key];
    if (typeof val === 'string') return val;
    const existing = g.decisions.find((d) => d.procedureId === proc.id);
    if (existing) {
      // si ya pasó un turno sin decidir, vence el plazo
      if (cmp(g.date, existing.deadline) > 0) {
        g.decisions = g.decisions.filter((d) => d !== existing);
        return undefined;
      }
      return 'esperando';
    }
    const opts = step.kind === 'sancion'
      ? [{ id: 'sancionar', label: 'Sancionar (firmar)', explain: 'La ley sigue su curso hacia la publicación.' }, { id: 'vetar', label: 'Vetar', explain: 'Devuelve el proyecto: el legislativo puede superar el veto con mayoría cualificada.' }]
      : [{ id: 'pedir', label: 'Pedir referéndum', explain: 'Su grupo reúne la fracción necesaria para exigir la consulta.' }, { id: 'no-pedir', label: 'No pedirlo', explain: 'La reforma continúa sin referéndum.' }];
    g.counters.seq++;
    g.decisions.push({ id: `dec-${g.counters.seq}`, kind: step.kind === 'sancion' ? 'sancion' : 'solicitud-referendum', title: `${step.label}: ${proc.title}`, detail: step.kind === 'sancion' ? 'Como titular del Ejecutivo debe decidir dentro del plazo legal. Si no decide antes de que termine el próximo turno, el juego lo tiene por sancionado (simplificación).' : 'Puede exigir que la reforma se someta a referéndum.', procedureId: proc.id, deadline: addDays(g.date, 31), options: opts });
    return 'esperando';
  },
};

function nextElectionDateFor(g: GameState, office: string, after: ISODate): ISODate {
  const c = getCountry(g.country);
  const sched = [...g.schedule, ...c.nextElections(g, after)].filter((s) => s.offices.includes(office) && cmp(s.date, after) >= 0).sort((a, b) => cmp(a.date, b.date));
  return sched[0]?.date ?? addYears(after, 4);
}

function applyLaw(g: GameState, proc: ProcedureInstance) {
  const c = getCountry(g.country);
  const p = proc.proposal;
  const date = proc.inForceOn ?? g.date;
  if (p.kind === 'presupuesto' && p.budget) {
    const lev = { ...g.fiscal.levers, ...(p.levers ?? {}) };
    const fy = p.fiscalYear ?? fiscalYearOf(c, date);
    const f = makeFiscal(g, c, p.budget, lev, fy, 'ley');
    if (cmp(date, fiscalYearStart(c, fy)) >= 0) g.fiscal = f;
    else g.pendingFiscal = f;
    addLog(g, 'ley-vigente', `Aprobado el presupuesto ${fy}`, cmp(date, fiscalYearStart(c, fy)) >= 0 ? 'Se aplica de inmediato.' : `Se aplicará desde el ${fmtDate(fiscalYearStart(c, fy))}.`, 'juridica', { procedureId: proc.id });
  } else if (p.levers) {
    for (const [k, v] of Object.entries(p.levers)) {
      const old = g.fiscal.levers[k];
      if (k === 'consumo') g.economy.shocks.prices += 0.5 * (v - old);
      if (k === 'aranceles') g.economy.shocks.prices += 0.12 * (v - old);
      g.fiscal.levers[k] = v;
      if (g.pendingFiscal) g.pendingFiscal.levers[k] = v;
    }
    addLog(g, 'ley-vigente', `En vigor: ${p.title}`, p.summary, 'juridica', { procedureId: proc.id });
  }
  if (p.kind === 'reforma' && p.reformId) {
    const rf = c.reforms.find((r) => r.id === p.reformId)!;
    let eff = date;
    if (rf.transitional.kind === 'siguiente-eleccion' && rf.transitional.office) eff = nextElectionDateFor(g, rf.transitional.office, date);
    if (rf.transitional.kind === 'siguiente-mandato' && rf.transitional.office) {
      const el = nextElectionDateFor(g, rf.transitional.office, date);
      eff = addDays(c.installationDate(rf.transitional.office, el, g), 1);
    }
    const prev = ruleAt(g, rf.ruleId, eff).value;
    g.counters.seq++;
    const am: Amendment = { id: `enm-${g.counters.seq}`, ruleId: rf.ruleId, previous: prev, value: p.reformValue!, effectiveFrom: eff, procedureId: proc.id, label: p.title, transitional: rf.transitional.text };
    g.amendments.push(am);
    if (rf.ruleId === 'es.congreso.diputados' && Number(p.reformValue) > (ruleAt(g, 'es.congreso.rango').value as Record<string, number>).max) {
      g.counters.seq++;
      g.amendments.push({ id: `enm-${g.counters.seq}`, ruleId: 'es.congreso.rango', previous: ruleAt(g, 'es.congreso.rango').value, value: { min: 300, max: Number(p.reformValue) }, effectiveFrom: date, procedureId: proc.id, label: 'Nuevo margen del art. 68.1', transitional: 'Inmediata' });
    }
    // Cambiar la elección presidencial a 4 años de Cámara alinea calendarios (simplificación ya descrita)
    addLog(g, 'reforma-vigente', `Reforma en vigor: ${p.title}`, `Regla «${g.rules[rf.ruleId].title}»: ${String(prev)} → ${String(p.reformValue)}. Se aplica desde el ${fmtDate(eff)}. ${rf.transitional.text}`, 'juridica', { procedureId: proc.id, amendment: am.id });
  }
  // costes de concesiones (inversión territorial)
  const cost = p.concessions.reduce((a, x) => a + x.cost, 0);
  if (cost > 0) {
    const add = (cost / 100) * potentialNominal(g);
    g.fiscal.spendingNominal.infraestructura = (g.fiscal.spendingNominal.infraestructura ?? 0) + add;
    if (g.pendingFiscal) g.pendingFiscal.spendingNominal.infraestructura = (g.pendingFiscal.spendingNominal.infraestructura ?? 0) + add;
  }
  // orientación acumulada de las políticas
  g.policy = { econ: clamp(g.policy.econ + p.position.econ * p.intensity * 0.6, -1, 1), social: clamp(g.policy.social + p.position.social * p.intensity * 0.6, -1, 1) };
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

export function clone(g: GameState): GameState {
  return JSON.parse(JSON.stringify(g));
}

// ------------------------------------------------------------------ campaña

export type CampaignAction =
  | { kind: 'gira'; territories: string[] }
  | { kind: 'mensaje'; issues: IssueId[] }
  | { kind: 'publicidad'; amount: number }
  | { kind: 'debate' }
  | { kind: 'alianza'; group: string };

export function campaignAction(g0: GameState, a: CampaignAction): { game: GameState; message: string } {
  if (!campaignOpen(g0)) return { game: g0, message: 'La campaña no está abierta.' };
  const g = clone(g0);
  const me = playerParty(g);
  const used = g.campaign.visited;
  const key = `${a.kind}-${g.counters.turn}`;
  if (a.kind !== 'gira' && used.includes(key)) return { game: g0, message: 'Ya realizó esta acción en este turno.' };
  let msg = '';
  switch (a.kind) {
    case 'gira': {
      const list = a.territories.slice(0, 3);
      const cost = 5 * list.length;
      if (me.funds < cost) return { game: g0, message: 'Fondos insuficientes.' };
      if (used.filter((x) => x.startsWith(`gira-${g.counters.turn}`)).length >= 3) return { game: g0, message: 'Máximo de tres visitas por turno.' };
      me.funds -= cost;
      for (const t of list) {
        g.campaign.mobilization[t] = Math.min(0.4, (g.campaign.mobilization[t] ?? 0) + 0.12);
        used.push(`gira-${g.counters.turn}-${t}`);
      }
      msg = `Gira por ${list.length} territorio(s): aumenta la movilización local (parámetro del juego: +0,12 de utilidad, máximo 0,4).`;
      break;
    }
    case 'mensaje':
      g.campaign.focus = a.issues.slice(0, 2);
      used.push(key);
      msg = 'El mensaje de campaña refuerza esos temas entre quienes los priorizan.';
      break;
    case 'publicidad': {
      const amt = Math.min(me.funds, a.amount);
      if (amt <= 0) return { game: g0, message: 'Fondos insuficientes.' };
      me.funds -= amt;
      me.valence += 0.04 * Math.sqrt(amt / 10);
      used.push(key);
      msg = `Publicidad: +${fmtNum(0.04 * Math.sqrt(amt / 10), 3)} de popularidad (rendimientos decrecientes).`;
      break;
    }
    case 'debate': {
      if (g.campaign.debateDone) return { game: g0, message: 'Ya participó en el debate de esta campaña.' };
      const r = stream(g.seed, 'debate', g.date);
      const d = r.normal(0.03, 0.06);
      me.valence += d;
      g.campaign.debateDone = true;
      used.push(key);
      msg = `Debate: ${d >= 0 ? 'buena' : 'mala'} actuación (${d >= 0 ? '+' : ''}${fmtNum(d, 3)} de popularidad; componente aleatorio).`;
      addLog(g, 'campana', 'Debate electoral', msg, 'simulacion');
      break;
    }
    case 'alianza': {
      const gr = g.groups.find((x) => x.id === a.group);
      if (!gr) return { game: g0, message: 'Organización desconocida.' };
      const promise = { empresas: 'Bajar el impuesto de sociedades', sindicatos: 'Subir el salario mínimo', civil: 'Reforzar la transparencia y los servicios públicos' }[gr.kind];
      me.funds += 15;
      me.valence += 0.02;
      me.promises.push(promise);
      used.push(key);
      msg = `${gr.name} respalda su candidatura (+15 de fondos). Compromiso adquirido: «${promise}».`;
      addLog(g, 'campana', `Apoyo de ${gr.name}`, msg, 'simulacion');
      break;
    }
  }
  return { game: g, message: msg };
}

// ------------------------------------------------------------------ España: formación, censura, confianza, disolución

export function offerDeal(g0: GameState, partyId: string, kind: DealKind): { game: GameState; message: string; accepted: boolean } {
  const g = clone(g0);
  const f = g.government.formation;
  if (!f) return { game: g0, message: 'No hay un proceso de formación de gobierno abierto.', accepted: false };
  if (f.offers[partyId]) return { game: g0, message: 'Ya existe un acuerdo con este partido.', accepted: false };
  const ans = answerDeal(g, g.playerParty, partyId, kind);
  if (ans.accepted) f.offers[partyId] = kind;
  addLog(g, 'investidura', `${ans.accepted ? 'Acuerdo' : 'Sin acuerdo'} con ${party(g, partyId).short}: ${DEALS[kind].label}`, ans.reason, 'simulacion');
  return { game: g, message: ans.reason, accepted: ans.accepted };
}

function playerDeals(g: GameState): Record<string, string> {
  return Object.fromEntries(Object.entries(g.government.formation?.offers ?? {}).filter(([k]) => !k.startsWith('__')));
}

function investiture(g: GameState, candidate: string, deals: Record<string, string>, playerChoice?: VoteChoice): boolean {
  const f = g.government.formation!;
  if (!f.firstVoteOn) f.firstVoteOn = g.date;
  const est1 = investitureVotes(g, candidate, deals, playerChoice);
  const t = est1.tally;
  f.attempts.push({ candidateParty: candidate, date: g.date, vote: 1, yes: t.yes, no: t.no, abstain: t.abstain, passed: est1.first });
  const name = party(g, candidate).short;
  addLog(g, 'investidura', `Primera votación de investidura (${name}): ${est1.first ? 'aprobada' : 'no alcanza la mayoría absoluta'}`, `${t.yes} sí, ${t.no} no, ${t.abstain} abstenciones. Mayoría absoluta: ${Math.floor(t.members / 2) + 1}.`, 'juridica');
  let ok = est1.first;
  if (!ok) {
    f.attempts.push({ candidateParty: candidate, date: addDays(g.date, 2), vote: 2, yes: t.yes, no: t.no, abstain: t.abstain, passed: est1.second });
    addLog(g, 'investidura', `Segunda votación a las 48 horas (${name}): ${est1.second ? 'aprobada por mayoría simple' : 'rechazada'}`, `${t.yes} sí frente a ${t.no} no.`, 'juridica');
    ok = est1.second;
  }
  if (ok) {
    const coalition = [candidate, ...Object.entries(deals).filter(([, k]) => k === 'coalicion').map(([p]) => p)];
    const support = Object.entries(deals).filter(([, k]) => k === 'programa' || k === 'territorial').map(([p]) => p);
    const leader = candidate === g.playerParty ? g.candidateName : party(g, candidate).leader;
    g.government = { ...g.government, executiveParty: candidate, executiveName: leader, coalition, supportParties: support, since: g.date, termsServed: { ...g.government.termsServed, [leader]: (g.government.termsServed[leader] ?? 0) + 1 }, formation: undefined };
    const cost = Object.values(deals).filter((k) => k === 'territorial').length * DEALS.territorial.cost;
    if (cost > 0) g.fiscal.spendingNominal.infraestructura += (cost / 100) * potentialNominal(g);
    g.playerRole = candidate === g.playerParty ? 'gobierno' : 'oposicion';
    g.phase = 'gobierno';
    addLog(g, 'gobierno', `${leader} (${name}) es investido Presidente del Gobierno`, coalition.length > 1 ? `Gobierno de coalición: ${coalition.map((p) => party(g, p).short).join(' + ')}.` : 'Gobierno de un solo partido.', 'juridica');
  }
  return ok;
}

export function requestInvestiture(g0: GameState): { game: GameState; message: string } {
  const g = clone(g0);
  const f = g.government.formation;
  if (!f || g.phase !== 'formacion') return { game: g0, message: 'No hay investidura en curso.' };
  if (!g.legislators.some((l) => l.chamber === 'congreso' && cmp(g.date, '0000') > 0)) return { game: g0, message: 'Las Cortes aún no se han constituido.' };
  const lim = num(g, 'es.presidente.limite');
  if (lim > 0 && (g.government.termsServed[g.candidateName] ?? 0) >= lim) return { game: g0, message: `Su candidato ya alcanzó el límite de ${lim} mandatos introducido por una reforma.` };
  const king = kingsCandidate(g, playerDeals(g));
  const failedBefore = f.attempts.some((a) => a.candidateParty === king && !a.passed);
  if (king !== g.playerParty && !failedBefore) return { game: g0, message: `Tras las consultas, el Rey propone primero a ${party(g, king).name}, que reúne más apoyos esperados. Podrá optar si esa candidatura fracasa.` };
  const ok = investiture(g, g.playerParty, playerDeals(g));
  return { game: g, message: ok ? 'Investidura lograda.' : 'La investidura ha fracasado. Corre el plazo de dos meses desde la primera votación.' };
}

export function questionOfConfidence(g0: GameState): { game: GameState; message: string } {
  if (g0.country !== 'es' || !isPlayerExecutive(g0) || g0.phase !== 'gobierno') return { game: g0, message: 'No disponible.' };
  const g = clone(g0);
  const deals: Record<string, string> = Object.fromEntries([...g.government.coalition.filter((p) => p !== g.playerParty).map((p) => [p, 'coalicion']), ...g.government.supportParties.map((p) => [p, 'programa'])]);
  const est = investitureVotes(g, g.playerParty, deals);
  const t = est.tally;
  const ok = t.yes > t.no;
  addLog(g, 'gobierno', `Cuestión de confianza: ${ok ? 'otorgada' : 'denegada'}`, `${t.yes} sí, ${t.no} no, ${t.abstain} abstenciones (mayoría simple).`, 'juridica');
  if (ok) g.economy.shocks.approval += 2;
  else {
    g.government.formation = { attempts: [], offers: {}, caretaker: g.playerParty };
    g.phase = 'formacion';
    addLog(g, 'gobierno', 'El Gobierno dimite y se abre una nueva investidura', 'Art. 114.1 CE.', 'juridica');
  }
  return { game: g, message: ok ? 'El Congreso renueva su confianza.' : 'Ha perdido la confianza: se abre una nueva investidura.' };
}

export function dissolve(g0: GameState): { game: GameState; message: string } {
  if (g0.country !== 'es' || !isPlayerExecutive(g0)) return { game: g0, message: 'Sólo el Presidente del Gobierno puede proponer la disolución.' };
  const lastDis = g0.log.filter((l) => l.kind === 'gobierno' && l.title.startsWith('Disolución')).pop();
  if (lastDis && daysBetween(lastDis.date, g0.date) < num(g0, 'es.disolucion')) return { game: g0, message: 'No puede disolver antes de que pase un año desde la anterior disolución (art. 115.3).' };
  if (g0.procedures.some((p) => p.status === 'en-tramite' && p.defId === 'es.censura')) return { game: g0, message: 'No puede disolver con una moción de censura en trámite (art. 115.2).' };
  const g = clone(g0);
  const d = nextSunday(addDays(g.date, num(g, 'es.elecciones.plazo')));
  g.schedule = [{ date: d, offices: ['congreso', 'senado'], reason: 'Disolución anticipada (art. 115)' }];
  addLog(g, 'gobierno', 'Disolución anticipada de las Cortes', `Elecciones generales el ${fmtDate(d)}.`, 'juridica');
  return { game: g, message: `Elecciones convocadas para el ${fmtDate(d)}.` };
}

export function censureMotion(g0: GameState): { game: GameState; message: string } {
  if (g0.country !== 'es' || g0.phase !== 'gobierno' || isPlayerExecutive(g0)) return { game: g0, message: 'No disponible.' };
  const need = num(g0, 'es.censura');
  if (seatsOf(g0, 'congreso', g0.playerParty) < need) return { game: g0, message: `La moción debe proponerla al menos 1/10 del Congreso (${need} diputados).` };
  const g = clone(g0);
  const deals: Record<string, string> = {};
  for (const p of g.parties) {
    if (p.id === g.playerParty || g.government.coalition.includes(p.id) || !seatsOf(g, 'congreso', p.id)) continue;
    if (answerDeal(g, g.playerParty, p.id, 'programa').accepted) deals[p.id] = 'programa';
  }
  const est = investitureVotes(g, g.playerParty, deals);
  const t = est.tally;
  const ok = est.first;
  addLog(g, 'gobierno', `Moción de censura ${ok ? 'aprobada' : 'rechazada'}`, `Presentada con candidato alternativo; votada tras el plazo de 5 días. ${t.yes} sí (mayoría absoluta: ${Math.floor(t.members / 2) + 1}).`, 'juridica');
  if (ok) {
    g.date = addDays(g.date, 5);
    g.government = { ...g.government, executiveParty: g.playerParty, executiveName: g.candidateName, coalition: [g.playerParty], supportParties: Object.keys(deals), since: g.date, termsServed: { ...g.government.termsServed, [g.candidateName]: (g.government.termsServed[g.candidateName] ?? 0) + 1 } };
    g.playerRole = 'gobierno';
  }
  return { game: g, message: ok ? 'La moción prospera: usted es investido Presidente del Gobierno (art. 114.2).' : 'La moción no alcanza la mayoría absoluta.' };
}

// ------------------------------------------------------------------ IA del Ejecutivo y de otros partidos

function aiTurn(g: GameState) {
  const c = getCountry(g.country);
  if (g.phase !== 'gobierno') return;
  const exec = g.government.executiveParty;
  const r = stream(g.seed, 'ia', g.date);
  if (exec && exec !== g.playerParty) {
    // presupuesto anual
    const fyNow = fiscalYearOf(c, g.date);
    const nextFY = cmp(g.date, fiscalYearStart(c, fyNow)) >= 0 ? fyNow + 1 : fyNow;
    const monthsTo = monthsBetween(g.date, fiscalYearStart(c, nextFY));
    const attempts = g.procedures.filter((p) => p.proposal.kind === 'presupuesto' && p.proposal.fiscalYear === nextFY);
    const has = attempts.some((p) => p.status !== 'rechazada') || g.pendingFiscal?.fiscalYear === nextFY || attempts.length >= 2;
    if (!has && monthsTo <= 4 && monthsTo >= 1) {
      const ep = party(g, exec);
      const ind = indicators(g);
      const pct: Record<string, number> = {};
      for (const b of c.budget) {
        if (!b.adjustable) continue;
        let v = g.fiscal.spendingPct[b.id] ?? b.basePct;
        const pri = b.issue && ep.priorities.includes(b.issue);
        v *= pri ? 1.03 : 0.995;
        if (ind.deficit > 4) v *= 0.98;
        pct[b.id] = Math.round(v * 100) / 100;
      }
      let prop = makeBudgetProposal(g, pct);
      prop = aiNegotiate(g, prop, exec);
      const def = getDef(g, prop.procedureId);
      startProcedure(g, def, { title: prop.title, proposal: prop, proposerParty: exec });
      addLog(g, 'procedimiento', `El Gobierno presenta: ${prop.title}`, prop.concessions.length ? `Proyecto del Ejecutivo (IA) con acuerdos: ${prop.concessions.map((x) => x.label).join('; ')}.` : 'Proyecto del Ejecutivo (IA).', 'juridica');
    } else if (r.chance(0.12) && !g.procedures.some((p) => p.status === 'en-tramite' && p.proposerParty === exec && p.proposal.kind !== 'presupuesto')) {
      const ep = party(g, exec);
      const lev: Record<string, number> = {};
      if (ep.econ > 0.1) lev.sociedades = Math.max(c.taxes.find((t) => t.id === 'sociedades')!.min, (g.fiscal.levers.sociedades ?? 100) - 5);
      else if (ep.econ < -0.1) lev.renta = Math.min(c.taxes.find((t) => t.id === 'renta')!.max, (g.fiscal.levers.renta ?? 100) + 5);
      if (Object.keys(lev).length) {
        const prop = makePolicyProposal(g, 'tributaria', lev);
        startProcedure(g, getDef(g, prop.procedureId), { title: prop.title, proposal: prop, proposerParty: exec });
        addLog(g, 'procedimiento', `El Gobierno presenta: ${prop.title}`, prop.summary, 'juridica');
      }
    }
  }
  // España: moción de censura contra un gobierno del jugador muy impopular
  if (g.country === 'es' && exec === g.playerParty && g.economy.approval < 30 && r.chance(0.08)) {
    const comp = composition(g, 'congreso');
    const rival = g.parties.filter((p) => p.id !== g.playerParty && !g.government.coalition.includes(p.id)).sort((a, b) => (comp[b.id] ?? 0) - (comp[a.id] ?? 0))[0];
    if (rival && (comp[rival.id] ?? 0) >= num(g, 'es.censura')) {
      const deals = aiDeals(g, rival.id);
      const est = investitureVotes(g, rival.id, deals, 'no');
      addLog(g, 'gobierno', `${rival.short} presenta una moción de censura`, `Votación tras 5 días: ${est.tally.yes} sí (necesarios ${Math.floor(est.tally.members / 2) + 1}).`, 'juridica');
      if (est.first) {
        g.government = { ...g.government, executiveParty: rival.id, executiveName: rival.leader, coalition: [rival.id], supportParties: Object.keys(deals), since: g.date };
        g.playerRole = 'oposicion';
        addLog(g, 'gobierno', `Prospera la moción: ${rival.leader} es el nuevo Presidente del Gobierno`, 'Art. 114.2 CE.', 'juridica');
      }
    }
  }
}

/** La IA busca apoyos con concesiones hasta tener mayoría estimada en la primera votación (máx. 3 socios). */
function aiNegotiate(g: GameState, prop: Proposal, proposer: string): Proposal {
  const def = getDef(g, prop.procedureId);
  // pasos del camino principal (sin vetos ni alternativas)
  const main: ReturnType<typeof getDef>['steps'] = [];
  let cur: string | null = def.first;
  while (cur) {
    const st = def.steps.find((x) => x.id === cur)!;
    if (st.kind === 'votacion' && st.chamber) main.push(st);
    cur = st.next;
  }
  const ep = party(g, proposer);
  for (let k = 0; k < 3; k++) {
    const pv = previewVotes(g, prop, proposer);
    let short: { rows: (typeof pv.chambers)[number]['rows'] } | null = null;
    for (const st of main) {
      const ch = pv.chambers.find((c) => c.chamber.id === st.chamber)!;
      const m = stepMajority(g, st);
      if (!m) continue;
      const need = m.kind === 'simple' ? ch.no + 1 : m.kind === 'absoluta' ? Math.floor(ch.members / 2) + 1 : Math.ceil((ch.members * m.num) / m.den);
      if (ch.yes < need) {
        short = ch;
        break;
      }
    }
    if (!short) break;
    const cand = short.rows.filter((r) => r.choice !== 'si' && r.party.id !== g.playerParty && !prop.concessions.some((c) => c.partyId === r.party.id)).sort((a, b) => Math.hypot(a.party.econ - ep.econ, a.party.social - ep.social) - Math.hypot(b.party.econ - ep.econ, b.party.social - ep.social))[0];
    if (!cand) break;
    prop = addConcession(prop, cand.party.id, cand.party.regionalGroups ? 'inversion-territorial' : 'prioridad', cand.party.short);
  }
  return prop;
}

function formationTurn(g: GameState) {
  if (g.phase !== 'formacion' || !g.government.formation) return;
  if (deadlinePassed(g)) {
    const d = nextSunday(addDays(g.date, num(g, 'es.elecciones.plazo')));
    g.schedule = [{ date: d, offices: ['congreso', 'senado'], reason: 'Disolución por falta de investidura (art. 99.5)' }];
    addLog(g, 'gobierno', 'Disolución: ningún candidato obtuvo la confianza en dos meses', `Nuevas elecciones el ${fmtDate(d)}. El Gobierno sigue en funciones.`, 'juridica');
    g.phase = 'gobierno';
    g.playerRole = isPlayerExecutive(g) ? 'gobierno' : 'oposicion';
    g.government.formation = undefined;
    return;
  }
  const f = g.government.formation;
  const king = kingsCandidate(g, playerDeals(g));
  if (king === g.playerParty) return; // el jugador decide cuándo someterse a la votación
  const tried = f.attempts.filter((a) => a.candidateParty === king).length;
  if (tried >= 2) return;
  const pv = (f.offers.__playerVote as VoteChoice | undefined) ?? undefined;
  if (!pv && !g.decisions.some((d) => d.kind === 'voto-investidura')) {
    g.counters.seq++;
    g.decisions.push({ id: `dec-${g.counters.seq}`, kind: 'voto-investidura', title: `Investidura de ${party(g, king).leader} (${party(g, king).short})`, detail: 'El Rey ha propuesto a este candidato. ¿Qué votará su grupo? Su abstención puede permitir la investidura en segunda votación.', deadline: addDays(g.date, 31), options: [{ id: 'si', label: 'Votar sí', explain: 'Apoya la investidura.' }, { id: 'abstencion', label: 'Abstenerse', explain: 'No apoya, pero no bloquea en la segunda votación.' }, { id: 'no', label: 'Votar no', explain: 'Se opone a la investidura.' }] });
    return;
  }
  if (g.decisions.some((d) => d.kind === 'voto-investidura')) {
    const d = g.decisions.find((x) => x.kind === 'voto-investidura')!;
    if (cmp(g.date, d.deadline) <= 0) return;
    g.decisions = g.decisions.filter((x) => x !== d);
  }
  investiture(g, king, aiDeals(g, king), pv ?? 'no');
  if (g.government.formation) delete g.government.formation.offers.__playerVote;
}

// ------------------------------------------------------------------ elecciones e instalación

function holdElection(g: GameState, offices: string[]) {
  const c = getCountry(g.country);
  const out = runElection(g, offices, g.date);
  for (const r of out.results) g.elections.push(r);
  if (g.elections.length > 30) g.elections.splice(0, g.elections.length - 30);
  for (const rc of out.replaceChambers) {
    const legs = out.legislators.filter((l) => l.chamber === rc.chamber);
    const res = out.results.find((r) => r.office === rc.chamber)!;
    g.installs.push({ date: c.installationDate(rc.chamber, g.date, g), office: rc.chamber, legislators: legs, seatIds: rc.seatIds, electionId: res.id });
  }
  if (out.presidentWinner) {
    const res = out.results.find((r) => r.office === 'presidencia')!;
    g.installs.push({ date: c.installationDate('presidencia', g.date, g), office: 'presidencia', winner: out.presidentWinner, electionId: res.id });
  }
  const me = playerParty(g);
  const summary = out.results.map((r) => (r.office === 'presidencia' ? `Presidencia: ${party(g, r.winner!).short}` : `${c.chambers.find((x) => x.id === r.office)?.short}: ${party(g, Object.entries(r.seats ?? {}).sort((a, b) => b[1] - a[1])[0][0]).short} primera fuerza`)).join(' · ');
  addLog(g, 'eleccion', `Elecciones del ${fmtDate(g.date)}`, `${summary}. Participación simulada ${fmtNum(out.results[0].turnout * 100, 1)} %.`, 'simulacion', { results: out.results.map((r) => r.id) });
  g.schedule = c.nextElections(g, g.date);
  g.phase = 'resultados';
  g.lastElectionShown = out.results[0]?.id;
  g.campaign = { round: 0, visited: [], focus: [], mobilization: {}, debateDone: false };
  // la popularidad acumulada de campaña se atenúa
  for (const p of g.parties) p.valence *= 0.6;
  me.funds += 40;
}

function applyInstall(g: GameState, ins: GameState['installs'][number]) {
  const c = getCountry(g.country);
  if (ins.office === 'presidencia' && ins.winner) {
    const w = party(g, ins.winner);
    const barred = ins.winner === g.government.executiveParty && g.country === 'sv' && str(g, 'sv.presidente.reeleccion') !== 'permitida';
    const usBarred = g.country === 'us' && ins.winner === g.government.executiveParty && (g.government.termsServed[g.government.executiveName] ?? 0) >= num(g, 'us.presidente.limite') && num(g, 'us.presidente.limite') > 0;
    let leader = ins.winner === g.playerParty ? g.candidateName : w.leader;
    if (barred || usBarred) {
      leader = `${leader.split(' ')[0]} (relevo de ${w.short})`;
      if (ins.winner === g.playerParty) g.candidateName = leader;
      else w.leader = leader;
    }
    g.government = { executiveParty: ins.winner, executiveName: leader, coalition: [ins.winner], supportParties: [], since: ins.date, termsServed: { ...g.government.termsServed, [leader]: (g.government.termsServed[leader] ?? 0) + 1 } };
    g.playerRole = ins.winner === g.playerParty ? 'gobierno' : 'oposicion';
    addLog(g, 'gobierno', `Toma de posesión: ${leader} (${w.short})`, `${c.executive.title} desde el ${fmtDate(ins.date)}.`, 'juridica');
    g.economy.approval = Math.max(g.economy.approval, 50);
    return;
  }
  if (ins.legislators) {
    if (ins.seatIds) {
      const ids = new Set(ins.seatIds);
      g.legislators = g.legislators.filter((l) => !(l.chamber === ins.office && ids.has(l.id))).concat(ins.legislators);
    } else g.legislators = g.legislators.filter((l) => l.chamber !== ins.office).concat(ins.legislators);
    const ch = c.chambers.find((x) => x.id === ins.office)!;
    addLog(g, 'gobierno', `Se constituye: ${ch.name}`, `Nueva composición desde el ${fmtDate(ins.date)}.`, 'juridica');
    resumeAfterLegislature(g, ins.office, ins.date);
    if (g.country === 'es' && ins.office === 'congreso') {
      g.government.formation = { attempts: [], offers: {}, caretaker: g.government.executiveParty };
      assignRegional(g);
      if (g.phase === 'gobierno' || g.phase === 'resultados') g.phase = g.phase === 'resultados' ? 'resultados' : 'formacion';
      addLog(g, 'investidura', 'Comienzan las consultas para la investidura', 'El Rey consulta con los representantes de los grupos políticos (art. 99.1).', 'juridica');
    }
  }
}

/** Tras ver los resultados, continuar. */
export function acknowledgeResults(g0: GameState): GameState {
  const g = clone(g0);
  if (g.phase !== 'resultados') return g;
  if (g.country === 'es') g.phase = g.government.formation ? 'formacion' : 'gobierno';
  else g.phase = 'gobierno';
  g.playerRole = isPlayerExecutive(g) ? 'gobierno' : g.phase === 'gobierno' && g.installs.some((i) => i.office === 'presidencia' && i.winner === g.playerParty) ? 'candidato' : 'oposicion';
  if (g.phase === 'formacion') g.playerRole = 'candidato';
  return g;
}

// ------------------------------------------------------------------ turno

export function advanceTurn(g0: GameState): GameState {
  if (g0.phase === 'resultados') return acknowledgeResults(g0);
  const g = clone(g0);
  const c = getCountry(g.country);
  const from = g.date;
  let target = addMonths(from, 1);
  const ne = nextElection(g);
  if (ne && cmp(ne.date, from) > 0 && cmp(ne.date, target) <= 0) target = ne.date;
  const before = indicators(g) as unknown as Record<string, number>;
  const logStart = g.log.length;

  // hitos intermedios: tomas de posesión e inicio de ejercicio fiscal
  const fyStartDate = fiscalYearStart(c, fiscalYearOf(c, target));
  const milestones: { date: ISODate; run: () => void }[] = [];
  for (const ins of g.installs.filter((i) => cmp(i.date, from) > 0 && cmp(i.date, target) <= 0))
    milestones.push({ date: ins.date, run: () => { g.date = ins.date; applyInstall(g, ins); g.installs = g.installs.filter((x) => x !== ins); } });
  if (cmp(fyStartDate, from) > 0 && cmp(fyStartDate, target) <= 0)
    milestones.push({ date: fyStartDate, run: () => startFiscalYear(g, fiscalYearOf(c, target)) });
  milestones.sort((a, b) => cmp(a.date, b.date));
  for (const m of milestones) {
    processProcedures(g, m.date, hooks);
    m.run();
  }
  g.date = target;
  processProcedures(g, target, hooks);

  // economía y eventos del mes
  const ext = externalEvents(g.seed, g.country, g.startDate, g.date);
  const endo = endogenousEvents(g);
  for (const ev of [...ext, ...endo]) addLog(g, 'evento', ev.title, ev.detail, 'simulacion', { externo: ev.kind === 'externo', efecto: ev.effect });
  const contributions = stepEconomy(g, [...ext, ...endo]);

  // IA y formación de gobierno
  aiTurn(g);
  formationTurn(g);
  // campaña de la IA: pequeñas variaciones simétricas de popularidad
  if (campaignOpen(g)) {
    const r = stream(g.seed, 'campana-ia', g.date);
    for (const p of g.parties) if (!p.isPlayer) p.valence += r.normal(0, 0.015);
    g.campaign.round++;
  }

  // elección
  if (ne && ne.date === target) holdElection(g, ne.offices);
  if (campaignOpen(g) || g.counters.turn % 3 === 0) takePoll(g);

  g.counters.turn++;
  snapshot(g);
  const after = indicators(g) as unknown as Record<string, number>;
  const deltas: Record<string, number> = {};
  for (const k of Object.keys(after)) deltas[k] = after[k] - before[k];
  const report: TurnReport = { from, to: target, deltas, contributions, notes: g.log.slice(logStart).map((l) => l.title) };
  g.reports.push(report);
  if (g.reports.length > 24) g.reports.shift();
  return g;
}

function startFiscalYear(g: GameState, fy: number) {
  const c = getCountry(g.country);
  g.date = fiscalYearStart(c, fy);
  if (g.pendingFiscal && g.pendingFiscal.fiscalYear === fy) {
    g.fiscal = g.pendingFiscal;
    g.pendingFiscal = undefined;
    addLog(g, 'economia', `Comienza el ejercicio ${fy} con presupuesto aprobado`, 'Las nuevas asignaciones se aplican desde hoy.', 'juridica');
  } else {
    g.fiscal = { ...g.fiscal, fiscalYear: fy, approvedBy: 'prorroga' };
    const rule = g.country === 'us' ? 'us.presupuesto.sin-aprobar' : g.country === 'es' ? 'es.presupuestos' : 'sv.presupuesto.prorroga';
    addLog(g, 'economia', `Ejercicio ${fy} sin presupuesto aprobado: prórroga`, `${g.rules[rule].plain} Los importes nominales no cambian, por lo que la inflación reduce su valor real.`, 'juridica');
  }
}

/** Avanza turnos hasta una fecha (p. ej. la toma de posesión), procesando cada mes. */
export function advanceUntil(g0: GameState, date: ISODate, maxTurns = 12): GameState {
  let g = g0;
  for (let i = 0; i < maxTurns && cmp(g.date, date) < 0 && g.phase !== 'resultados'; i++) g = advanceTurn(g);
  return g;
}

export { seatMap, chamberSize, composition, aggregate, territoryVote };
export type { Legislator, ElectionResult, PendingDecision };
