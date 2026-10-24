import { getCountry } from '../../data/countries';
import { SEGMENTS, segmentMix } from '../../data/segments';
import { dhondt, hareLargestRemainder } from '../electoral/allocation';
import { chamberSize, seatMap } from '../electoral/elections';
import { segmentCenter } from '../electoral/voters';
import { passes, requiredYes } from '../legal/majority';
import { num, str } from '../legal/rules';
import { stream } from '../rng';
import type { GameState, Majority, Party, ProcedureInstance, Proposal, StepDef, StepRecord, VoteTally } from '../types';

// Actores y negociación (capa C). Cada partido evalúa una propuesta por:
//  - acercamiento o alejamiento de las políticas respecto a su posición,
//  - su relación con el Gobierno (coalición, apoyo u oposición),
//  - concesiones negociadas,
//  - presión de la opinión pública y, en reformas electorales, su interés en escaños.

export const STANCE_PARAMS = { policy: 3, govSupport: 0.55, govOpposition: 0.25, opposePlayerGov: 0.1, popularity: 0.6, reformCaution: 0.12, seats: 4, threshold: 0.08 };

export function postPolicy(game: GameState, p: Proposal): { econ: number; social: number } {
  return { econ: game.policy.econ + p.position.econ * p.intensity * 0.6, social: game.policy.social + p.position.social * p.intensity * 0.6 };
}

/** Porcentaje del electorado que prefiere el estado tras la propuesta frente al actual (0..1). */
export function proposalSupport(game: GameState, p: Proposal): number {
  const post = postPolicy(game, p);
  const sq = game.policy;
  const mix = segmentMix(game.country, 0.75);
  const nodes = [-1.5, -0.75, 0, 0.75, 1.5];
  const w = nodes.map((x) => Math.exp((-x * x) / 2));
  const ws = w.reduce((a, b) => a + b, 0);
  let yes = 0;
  const ctr = segmentCenter(game.country);
  for (const s of SEGMENTS) {
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const ve = s.econ + s.spread * nodes[i] - ctr.econ;
        const vs = s.social + s.spread * nodes[j] - ctr.social;
        const dPost = (ve - post.econ) ** 2 + (vs - post.social) ** 2;
        const dSq = (ve - sq.econ) ** 2 + (vs - sq.social) ** 2;
        const pref = 1 / (1 + Math.exp(-6 * (dSq - dPost)));
        yes += (mix[s.id] ?? 0) * (w[i] / ws) * (w[j] / ws) * pref;
      }
  }
  return yes;
}

/** Variación de escaños (fracción de la cámara) que cada partido espera de una reforma electoral, recalculada con los votos de la última elección. */
export function seatImpact(game: GameState, p: Proposal): Record<string, number> {
  if (p.kind !== 'reforma' || !p.reformId) return {};
  const c = getCountry(game.country);
  const reform = c.reforms.find((r) => r.id === p.reformId);
  if (!reform) return {};
  const chamber = game.country === 'sv' ? 'asamblea' : game.country === 'es' ? 'congreso' : null;
  if (!chamber) return {};
  const last = [...game.elections].reverse().find((e) => e.office === chamber);
  if (!last) return {};
  const relevant = ['sv.asamblea.formula', 'sv.asamblea.diputados', 'es.congreso.barrera', 'es.congreso.diputados', 'es.congreso.circunscripcion'];
  if (!relevant.includes(reform.ruleId)) return {};
  const alloc = (override: Record<string, unknown>) => {
    const g2: GameState = { ...game, amendments: [...game.amendments, { id: 'tmp', ruleId: reform.ruleId, previous: 0, value: override.value as never, effectiveFrom: '0000-01-01', procedureId: 'tmp', label: '', transitional: '' }] };
    const seats = override.apply ? seatMap(g2, chamber, game.date) : seatMap(game, chamber, game.date);
    const formula = game.country === 'sv' ? str(override.apply ? g2 : game, 'sv.asamblea.formula') : 'dhondt';
    const thr = game.country === 'es' ? num(override.apply ? g2 : game, 'es.congreso.barrera') : 0;
    const national = game.country === 'es' && str(override.apply ? g2 : game, 'es.congreso.circunscripcion') === 'nacional';
    const tot: Record<string, number> = {};
    if (national) {
      const votes = Object.fromEntries(Object.entries(last.national).map(([k, v]) => [k, v * 1000]));
      const n = Object.values(seats).reduce((a, b) => a + b, 0);
      Object.assign(tot, dhondt(votes, n, thr).seats);
      return { tot, n };
    }
    let n = 0;
    for (const [t, sh] of Object.entries(last.byTerritory)) {
      const k = seats[t] ?? 0;
      n += k;
      const votes = Object.fromEntries(Object.entries(sh.shares).map(([a, b]) => [a, b * 1000]));
      const s = formula === 'hare' ? hareLargestRemainder(votes, k, thr) : dhondt(votes, k, thr).seats;
      for (const [a, b] of Object.entries(s)) tot[a] = (tot[a] ?? 0) + b;
    }
    return { tot, n };
  };
  const now = alloc({ apply: false });
  const after = alloc({ apply: true, value: p.reformValue });
  const out: Record<string, number> = {};
  for (const party of game.parties) out[party.id] = (after.tot[party.id] ?? 0) / Math.max(1, after.n) - (now.tot[party.id] ?? 0) / Math.max(1, now.n);
  return out;
}

export function partyStance(game: GameState, party: Party, p: Proposal, proposer: string, impact?: Record<string, number>): { stance: number; reasons: string[] } {
  const P = STANCE_PARAMS;
  const reasons: string[] = [];
  const sq = game.policy;
  const post = postPolicy(game, p);
  const dSq = (party.econ - sq.econ) ** 2 + (party.social - sq.social) ** 2;
  const dPost = (party.econ - post.econ) ** 2 + (party.social - post.social) ** 2;
  let s = P.policy * (dSq - dPost);
  reasons.push(s > 0.02 ? 'acerca las políticas a su programa' : s < -0.02 ? 'aleja las políticas de su programa' : 'efecto ideológico neutro');
  const gov = game.government;
  const inGov = gov.coalition.includes(party.id);
  const support = gov.supportParties.includes(party.id);
  const proposerInGov = gov.coalition.includes(proposer);
  if (proposer === party.id) {
    s += 1;
    reasons.push('es su propia propuesta');
  } else if (proposerInGov && (inGov || support)) {
    s += inGov ? P.govSupport : P.govSupport * 0.5;
    reasons.push(inGov ? 'forma parte del Gobierno' : 'tiene un acuerdo de apoyo con el Gobierno');
  } else if (proposerInGov && !inGov) {
    s -= P.govOpposition;
    reasons.push('está en la oposición');
  } else if (!proposerInGov && inGov) {
    s -= P.govOpposition;
    reasons.push('la propuesta viene de la oposición');
  }
  const conc = p.concessions.filter((c) => c.partyId === party.id).reduce((a, c) => a + c.value, 0);
  if (conc) {
    s += conc;
    reasons.push('ha obtenido concesiones');
  }
  const pop = proposalSupport(game, p) - 0.5;
  s += P.popularity * pop;
  if (Math.abs(pop) > 0.05) reasons.push(pop > 0 ? 'la propuesta es popular' : 'la propuesta es impopular');
  if (p.kind === 'reforma') s -= P.reformCaution;
  const imp = impact?.[party.id] ?? 0;
  if (Math.abs(imp) > 0.002) {
    s += P.seats * imp * 10;
    reasons.push(imp > 0 ? 'ganaría escaños con la nueva regla' : 'perdería escaños con la nueva regla');
  }
  return { stance: s, reasons };
}

export type VoteChoice = 'si' | 'no' | 'abstencion';

export function partyChoice(stance: number): VoteChoice {
  if (stance > STANCE_PARAMS.threshold) return 'si';
  if (stance < -STANCE_PARAMS.threshold) return 'no';
  return 'abstencion';
}

/** Votación en una cámara. Las posiciones del grupo del jugador se respetan (`playerVote`). */
export function castVote(game: GameState, proc: ProcedureInstance, step: StepDef, majority: Majority, playerVote?: VoteChoice): { tally: VoteTally; required: number; passed: boolean; byParty: Record<string, { yes: number; no: number; abstain: number }>; record: StepRecord['tally'] } {
  const chamber = step.chamber!;
  const members = chamberSize(game, chamber);
  const legs = game.legislators.filter((l) => l.chamber === chamber);
  const impact = seatImpact(game, proc.proposal);
  const partyPos: Record<string, VoteChoice> = {};
  for (const party of game.parties) {
    if (party.id === game.playerParty && playerVote) partyPos[party.id] = playerVote;
    else partyPos[party.id] = partyChoice(partyStance(game, party, proc.proposal, proc.proposerParty, impact).stance);
  }
  const byParty: Record<string, { yes: number; no: number; abstain: number }> = {};
  const r = stream(game.seed, 'voto', proc.id, step.id, game.date);
  const t: VoteTally = { yes: 0, no: 0, abstain: 0, absent: 0, members };
  for (const l of legs) {
    let v = partyPos[l.party] ?? 'abstencion';
    // disciplina: un legislador puede apartarse si su propia posición lo aleja mucho de la línea del partido
    if (!(l.party === game.playerParty && playerVote) && r.next() > l.discipline) {
      const fake = { ...game.parties.find((x) => x.id === l.party)!, econ: l.econ, social: l.social };
      v = partyChoice(partyStance(game, fake, proc.proposal, proc.proposerParty, impact).stance);
    }
    byParty[l.party] = byParty[l.party] ?? { yes: 0, no: 0, abstain: 0 };
    if (v === 'si') (t.yes++, byParty[l.party].yes++);
    else if (v === 'no') (t.no++, byParty[l.party].no++);
    else (t.abstain++, byParty[l.party].abstain++);
  }
  t.absent = Math.max(0, members - legs.length);
  let passed = passes(majority, t);
  // EE. UU.: empate en el Senado lo decide el Vicepresidente (partido del Ejecutivo)
  if (game.country === 'us' && chamber === 'senado' && majority.kind === 'simple' && t.yes === t.no) {
    passed = partyPos[game.government.executiveParty] === 'si';
  }
  const required = requiredYes(majority, t);
  return { tally: t, required, passed, byParty, record: { ...t, required, chamber, byParty } };
}

/** Votos de "no" (para vetos de segunda cámara). */
export function castVeto(game: GameState, proc: ProcedureInstance, step: StepDef, majority: Majority, playerVote?: VoteChoice) {
  const res = castVote(game, proc, step, majority, playerVote);
  const vetoTally: VoteTally = { yes: res.tally.no, no: res.tally.yes, abstain: res.tally.abstain, absent: res.tally.absent, members: res.tally.members };
  const vetoed = passes(majority, vetoTally);
  return { ...res, vetoed, vetoRequired: requiredYes(majority, vetoTally) };
}
