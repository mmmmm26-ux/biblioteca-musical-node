import { getCountry } from '../../data/countries';
import { castVeto, castVote, partyChoice, partyStance, proposalSupport, seatImpact, type VoteChoice } from '../actors/voting';
import { addDays, cmp } from '../calendar';
import { chamberSize, composition } from '../electoral/elections';
import { stream } from '../rng';
import type { GameState, ISODate, Majority, ProcedureDef, ProcedureInstance, StepDef, StepRecord } from '../types';
import { describeMajority } from './majority';
import { num } from './rules';

// Motor de procedimientos: cada norma avanza por una secuencia de pasos con condiciones verificables.
// No existe ningún atajo: el único modo de que una propuesta llegue a "vigente" es superar cada paso.

export interface ProcedureHooks {
  applyLaw: (game: GameState, proc: ProcedureInstance) => void;
  dissolve: (game: GameState, proc: ProcedureInstance) => void;
  log: (game: GameState, kind: 'procedimiento' | 'votacion' | 'rechazo', title: string, detail: string, data?: Record<string, unknown>) => void;
  playerVote: (game: GameState, proc: ProcedureInstance, step: StepDef) => VoteChoice | undefined;
  /** Decisión pendiente del jugador (sanción o solicitud de referéndum). Devuelve la opción elegida o undefined si aún no decide. */
  playerDecision: (game: GameState, proc: ProcedureInstance, step: StepDef, deadline: ISODate) => string | undefined | 'esperando';
}

export function getDef(game: GameState, id: string): ProcedureDef {
  const d = getCountry(game.country).procedures.find((p) => p.id === id);
  if (!d) throw new Error(`Procedimiento desconocido: ${id}`);
  return d;
}

export function getStep(def: ProcedureDef, id: string): StepDef {
  const s = def.steps.find((x) => x.id === id);
  if (!s) throw new Error(`Paso desconocido ${id} en ${def.id}`);
  return s;
}

/** Mayoría efectiva de un paso (puede depender de reglas modificadas en la partida). */
export function stepMajority(game: GameState, step: StepDef, date: ISODate = game.date): Majority | null {
  if (step.majorityFromRule) {
    const v = num(game, step.majorityFromRule, date);
    if (v <= 0.5) return null; // la regla ya no exige mayoría cualificada: el paso se omite
    return { kind: 'cualificada', num: Math.round(v * 100), den: 100, base: 'miembros' };
  }
  return step.majority ?? null;
}

export function describeStep(game: GameState, step: StepDef): string {
  const parts: string[] = [];
  const m = stepMajority(game, step);
  if (step.kind === 'votacion' && m) parts.push(describeMajority(m, step.chamber ? chamberSize(game, step.chamber) : undefined));
  if (step.kind === 'votacion' && !m && step.majorityFromRule) parts.push('Paso suprimido por una reforma del reglamento');
  if (step.kind === 'veto-camara' && m) parts.push(`Veto si lo apoya: ${describeMajority(m, step.chamber ? chamberSize(game, step.chamber) : undefined)}`);
  if (step.kind === 'ratificacion-territorial' && step.fraction) parts.push(`Se necesita la aprobación de ${step.fraction.num}/${step.fraction.den} de los territorios`);
  if (step.kind === 'solicitud-referendum' && step.requestFraction) parts.push(`Lo puede pedir ${step.requestFraction.num}/${step.requestFraction.den} de los miembros de cualquier cámara`);
  if (step.days !== undefined && step.days > 0) parts.push(`${step.daysKind === 'legal' ? 'Plazo legal' : 'Duración aproximada del modelo'}: ${step.days} días`);
  if (step.kind === 'nueva-legislatura') parts.push('Espera a que se instale la siguiente legislatura tras elecciones');
  if (step.kind === 'disolucion-elecciones') parts.push('Disuelve las Cortes y convoca elecciones');
  if (step.explain) parts.push(step.explain);
  return parts.join(' · ');
}

export function startProcedure(game: GameState, def: ProcedureDef, inst: Omit<ProcedureInstance, 'id' | 'defId' | 'startedOn' | 'currentStep' | 'nextActionOn' | 'status' | 'log'>): ProcedureInstance {
  const first = getStep(def, def.first);
  game.counters.seq++;
  const p: ProcedureInstance = {
    ...inst,
    id: `proc-${game.counters.seq}`,
    defId: def.id,
    startedOn: game.date,
    currentStep: first.id,
    nextActionOn: addDays(game.date, first.days ?? 0),
    status: 'en-tramite',
    log: [{ stepId: 'inicio', label: 'Presentación', date: game.date, outcome: 'info', detail: `Iniciado como ${def.name}.` }],
    meta: {},
  };
  game.procedures.push(p);
  return p;
}

function record(proc: ProcedureInstance, step: StepDef, date: ISODate, outcome: StepRecord['outcome'], detail: string, tally?: StepRecord['tally']) {
  proc.log.push({ stepId: step.id, label: step.label, date, outcome, detail, tally });
}

function goTo(game: GameState, def: ProcedureDef, proc: ProcedureInstance, next: string | null | undefined, date: ISODate, hooks: ProcedureHooks, failed = false) {
  if (next === null || next === undefined) {
    if (failed) {
      proc.status = 'rechazada';
      proc.currentStep = null;
      hooks.log(game, 'rechazo', `Rechazada: ${proc.title}`, `La propuesta no superó el paso «${proc.log[proc.log.length - 1]?.label}».`, { procedureId: proc.id });
    } else {
      proc.currentStep = null;
    }
    return;
  }
  const s = getStep(def, next);
  proc.currentStep = s.id;
  proc.nextActionOn = addDays(date, s.days ?? 0);
}

/** Procesa todos los pasos con fecha <= hasta. */
export function processProcedures(game: GameState, until: ISODate, hooks: ProcedureHooks): void {
  let guard = 0;
  let progressed = true;
  while (progressed && guard++ < 500) {
    progressed = false;
    for (const proc of game.procedures) {
      if (proc.status !== 'en-tramite' || !proc.currentStep) continue;
      if (cmp(proc.nextActionOn, until) > 0) continue;
      if (proc.meta?.waitingLegislature) continue;
      const def = getDef(game, proc.defId);
      const step = getStep(def, proc.currentStep);
      const date = proc.nextActionOn;
      const saved = game.date;
      game.date = date; // las reglas se evalúan en la fecha del paso
      const done = runStep(game, def, proc, step, date, hooks);
      game.date = saved;
      if (done) progressed = true;
    }
  }
}

function runStep(game: GameState, def: ProcedureDef, proc: ProcedureInstance, step: StepDef, date: ISODate, hooks: ProcedureHooks): boolean {
  switch (step.kind) {
    case 'votacion': {
      const m = stepMajority(game, step, date);
      if (!m) {
        record(proc, step, date, 'info', 'Paso omitido: la regla vigente ya no exige esta votación.');
        goTo(game, def, proc, step.next, date, hooks);
        return true;
      }
      const res = castVote(game, proc, step, m, hooks.playerVote(game, proc, step));
      const detail = `${res.tally.yes} a favor, ${res.tally.no} en contra, ${res.tally.abstain} abstenciones. Necesarios: ${m.kind === 'simple' ? 'más síes que noes' : res.required}.`;
      record(proc, step, date, res.passed ? 'superado' : 'no-superado', detail, res.record);
      hooks.log(game, 'votacion', `${res.passed ? 'Aprobado' : 'No aprobado'} en ${step.institution}: ${proc.title}`, detail, { procedureId: proc.id, step: step.id, tally: res.record });
      if (res.passed) goTo(game, def, proc, step.next, date, hooks);
      else goTo(game, def, proc, step.onFail, date, hooks, step.onFail === null || step.onFail === undefined);
      return true;
    }
    case 'veto-camara': {
      const m = stepMajority(game, step, date)!;
      const res = castVeto(game, proc, step, m, hooks.playerVote(game, proc, step));
      const detail = `${res.tally.no} votos por el veto (se necesitan ${res.vetoRequired}), ${res.tally.yes} en contra del veto.`;
      record(proc, step, date, res.vetoed ? 'vetado' : 'superado', detail, res.record);
      hooks.log(game, 'votacion', res.vetoed ? `${step.institution} veta: ${proc.title}` : `${step.institution} no veta: ${proc.title}`, detail, { procedureId: proc.id, step: step.id });
      if (res.vetoed) goTo(game, def, proc, step.onFail, date, hooks, !step.onFail);
      else goTo(game, def, proc, step.next, date, hooks);
      return true;
    }
    case 'espera': {
      record(proc, step, date, 'superado', step.daysKind === 'legal' ? 'Transcurrió el plazo legal.' : 'Concluyó la fase (duración del modelo).');
      goTo(game, def, proc, step.next, date, hooks);
      return true;
    }
    case 'sancion': {
      if (!step.vetoAllowed) {
        record(proc, step, date, 'superado', `${step.institution}: sanción (acto debido, sin veto).`);
        goTo(game, def, proc, step.next, date, hooks);
        return true;
      }
      const exec = game.government.executiveParty;
      let veto = false;
      let how = '';
      if (exec === game.playerParty && proc.proposerParty !== game.playerParty) {
        const d = hooks.playerDecision(game, proc, step, addDays(date, 0));
        if (d === 'esperando') return false;
        veto = d === 'vetar';
        how = d === undefined ? 'El plazo venció sin decisión: el proyecto se tiene por sancionado (simplificación).' : veto ? 'La Presidencia (jugador) veta el proyecto.' : 'La Presidencia (jugador) sanciona el proyecto.';
      } else if (exec === proc.proposerParty) {
        how = 'El Ejecutivo sanciona su propia iniciativa.';
      } else {
        const party = game.parties.find((p) => p.id === exec);
        const st = party ? partyStance(game, party, proc.proposal, proc.proposerParty, seatImpact(game, proc.proposal)).stance : 0;
        veto = st < -0.25;
        how = veto ? 'El Ejecutivo veta el proyecto por desacuerdo político.' : 'El Ejecutivo sanciona el proyecto.';
      }
      record(proc, step, date, veto ? 'vetado' : 'superado', how);
      hooks.log(game, 'procedimiento', veto ? `Veto presidencial: ${proc.title}` : `Sanción: ${proc.title}`, how, { procedureId: proc.id });
      if (veto) goTo(game, def, proc, step.onFail, date, hooks, !step.onFail);
      else goTo(game, def, proc, step.next, date, hooks);
      return true;
    }
    case 'solicitud-referendum': {
      const frac = step.requestFraction!;
      const requesters: string[] = [];
      for (const ch of getCountry(game.country).chambers) {
        const need = Math.ceil((chamberSize(game, ch.id) * frac.num) / frac.den);
        const comp = composition(game, ch.id);
        for (const party of game.parties) {
          const seats = comp[party.id] ?? 0;
          if (seats < need) continue;
          let wants = false;
          if (party.id === game.playerParty) {
            const d = hooks.playerDecision(game, proc, step, date);
            if (d === 'esperando') return false;
            wants = d === 'pedir';
          } else wants = partyChoice(partyStance(game, party, proc.proposal, proc.proposerParty).stance) === 'no';
          if (wants && !requesters.includes(party.short)) requesters.push(`${party.short} (${ch.short})`);
        }
      }
      if (requesters.length) {
        record(proc, step, date, 'no-superado', `Solicitan referéndum: ${requesters.join(', ')}.`);
        hooks.log(game, 'procedimiento', `Se pedirá un referéndum sobre: ${proc.title}`, `Solicitantes: ${requesters.join(', ')}.`, { procedureId: proc.id });
        goTo(game, def, proc, step.onFail, date, hooks);
      } else {
        record(proc, step, date, 'superado', 'Nadie con la fracción necesaria pidió referéndum.');
        goTo(game, def, proc, step.next, date, hooks);
      }
      return true;
    }
    case 'referendum': {
      const r = stream(game.seed, 'referendum', proc.id);
      const base = proposalSupport(game, proc.proposal);
      const yes = Math.max(0.05, Math.min(0.95, base + ((game.economy.approval - 50) / 100) * 0.3 + r.normal(0, 0.03)));
      const turnout = 0.35 + 0.3 * r.next();
      const ok = yes > 0.5;
      const detail = `Sí ${(yes * 100).toFixed(1)} % · No ${((1 - yes) * 100).toFixed(1)} % · Participación ${(turnout * 100).toFixed(0)} % (resultado simulado).`;
      record(proc, step, date, ok ? 'superado' : 'no-superado', detail);
      hooks.log(game, 'votacion', `Referéndum ${ok ? 'aprobado' : 'rechazado'}: ${proc.title}`, detail, { procedureId: proc.id });
      if (ok) goTo(game, def, proc, step.next, date, hooks);
      else goTo(game, def, proc, step.onFail, date, hooks, true);
      return true;
    }
    case 'ratificacion-territorial': {
      const c = getCountry(game.country);
      const states = c.territories.filter((t) => (t.seats.senado ?? 0) > 0);
      const meta = proc.meta!;
      if (!meta.ratStart) meta.ratStart = date;
      const decided = String(meta.ratDecided ?? '').split(',').filter(Boolean);
      let yes = Number(meta.ratYes ?? 0);
      let no = Number(meta.ratNo ?? 0);
      const need = Math.ceil((states.length * step.fraction!.num) / step.fraction!.den);
      const r = stream(game.seed, 'ratificacion', proc.id, date);
      const support = proposalSupport(game, proc.proposal);
      for (const s of states) {
        if (decided.includes(s.id)) continue;
        if (r.next() > 0.12) continue; // cada mes algunas legislaturas deciden
        const gov = game.regional.find((g) => g.group === s.id);
        const party = game.parties.find((p) => p.id === gov?.party);
        let st = party ? partyStance(game, party, proc.proposal, proc.proposerParty).stance : 0;
        st += (support - 0.5) + (s.lean.social * proc.proposal.position.social > 0 ? 0.15 : -0.1) * Math.sign(proc.proposal.position.social || 0);
        if (proc.proposal.reformId === 'us-voto-popular') st -= (s.seats.electores ?? 3) <= 5 ? 0.35 : 0;
        decided.push(s.id);
        if (st > 0.05) yes++;
        else no++;
      }
      meta.ratDecided = decided.join(',');
      meta.ratYes = yes;
      meta.ratNo = no;
      const deadline = addDays(String(meta.ratStart), step.days ?? 2555);
      if (yes >= need) {
        record(proc, step, date, 'superado', `${yes} estados han ratificado (necesarios ${need}).`);
        hooks.log(game, 'procedimiento', `Ratificada por ${yes} estados: ${proc.title}`, `Se alcanzó la mayoría de 3/4 de los estados.`, { procedureId: proc.id });
        goTo(game, def, proc, step.next, date, hooks);
      } else if (states.length - no < need || cmp(date, deadline) >= 0) {
        record(proc, step, date, 'no-superado', `${yes} ratificaciones y ${no} rechazos: ya no es posible llegar a ${need} en plazo.`);
        goTo(game, def, proc, null, date, hooks, true);
      } else {
        proc.nextActionOn = addDays(date, 30);
        if (decided.length && !meta.ratLogged) {
          meta.ratLogged = true;
          hooks.log(game, 'procedimiento', `Comienza la ratificación estatal: ${proc.title}`, `Se necesitan ${need} estados. Cada mes algunas legislaturas deciden.`, { procedureId: proc.id });
        }
      }
      return true;
    }
    case 'disolucion-elecciones': {
      record(proc, step, date, 'info', 'Se disuelven las Cortes y se convocan elecciones. La reforma continuará con las nuevas Cámaras.');
      hooks.dissolve(game, proc);
      proc.meta!.waitingLegislature = step.chamber ?? 'congreso';
      proc.currentStep = step.next;
      return true;
    }
    case 'nueva-legislatura': {
      record(proc, step, date, 'en-espera', 'A la espera de la siguiente legislatura.');
      proc.meta!.waitingLegislature = step.chamber ?? 'asamblea';
      proc.currentStep = step.next;
      return true;
    }
    case 'publicacion': {
      proc.publishedOn = date;
      record(proc, step, date, 'superado', `Publicada el ${date}.`);
      goTo(game, def, proc, step.next, date, hooks);
      return true;
    }
    case 'vigencia': {
      proc.inForceOn = date;
      proc.status = 'vigente';
      proc.currentStep = null;
      record(proc, step, date, 'superado', `En vigor desde el ${date}${proc.publishedOn && proc.publishedOn !== date ? ` (publicada el ${proc.publishedOn})` : ''}.`);
      hooks.applyLaw(game, proc);
      return true;
    }
  }
}

/** Reanuda los procedimientos que esperaban una nueva legislatura. */
export function resumeAfterLegislature(game: GameState, chamber: string, installed: ISODate): void {
  for (const p of game.procedures) {
    if (p.status === 'en-tramite' && p.meta?.waitingLegislature === chamber) {
      delete p.meta.waitingLegislature;
      const def = getDef(game, p.defId);
      const s = p.currentStep ? getStep(def, p.currentStep) : null;
      p.nextActionOn = addDays(installed, s?.days ?? 30);
      p.log.push({ stepId: 'legislatura', label: 'Nueva legislatura instalada', date: installed, outcome: 'info', detail: 'El procedimiento continúa con la nueva composición.' });
    }
  }
}

