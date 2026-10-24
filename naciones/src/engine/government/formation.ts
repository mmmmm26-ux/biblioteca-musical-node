import { fmtNum } from '../calendar';
import { addDays, cmp } from '../calendar';
import { chamberSize, composition } from '../electoral/elections';
import { passes } from '../legal/majority';
import { num } from '../legal/rules';
import { stream } from '../rng';
import type { GameState, Party, VoteTally } from '../types';

// Formación de gobierno en sistemas parlamentarios (España, art. 99 CE).
// Ganar las elecciones no basta: el candidato necesita la confianza del Congreso.

export type DealKind = 'coalicion' | 'programa' | 'territorial' | 'abstencion';

export const DEALS: Record<DealKind, { label: string; explain: string; maxDistance: number; vote: 'si' | 'abstencion'; cost: number }> = {
  coalicion: { label: 'Gobierno de coalición', explain: 'El partido entra en el Gobierno con ministerios. Votará a favor y apoyará sus leyes, pero exigirá que se reflejen sus prioridades.', maxDistance: 0.75, vote: 'si', cost: 0 },
  programa: { label: 'Acuerdo programático', explain: 'Apoyo externo a cambio de incluir una de sus prioridades en el programa de gobierno.', maxDistance: 0.95, vote: 'si', cost: 0 },
  territorial: { label: 'Acuerdo de inversión territorial', explain: 'Apoyo a cambio de inversiones en su territorio (coste presupuestario: 0,1 % del PIB al año).', maxDistance: 1.2, vote: 'si', cost: 0.1 },
  abstencion: { label: 'Pedir la abstención', explain: 'El partido no vota a favor, pero se abstiene para permitir la investidura en segunda votación.', maxDistance: 1.35, vote: 'abstencion', cost: 0 },
};

function dist(a: Party, b: Party): number {
  return Math.sqrt((a.econ - b.econ) ** 2 + (a.social - b.social) ** 2);
}

export interface DealAnswer {
  accepted: boolean;
  reason: string;
}

/** Respuesta de un partido a una oferta. Depende de distancia ideológica, de su relación con la alternativa y de un componente incierto con semilla. */
export function answerDeal(game: GameState, candidate: string, partyId: string, kind: DealKind): DealAnswer {
  const cand = game.parties.find((p) => p.id === candidate)!;
  const party = game.parties.find((p) => p.id === partyId)!;
  const d = dist(cand, party);
  const deal = DEALS[kind];
  const r = stream(game.seed, 'pacto', game.date, candidate, partyId, kind);
  const regional = !!party.regionalGroups;
  let limit = deal.maxDistance + r.normal(0, 0.08);
  if (kind === 'territorial' && !regional) limit -= 0.35; // la inversión territorial pesa más para partidos territoriales
  if (kind === 'coalicion' && regional) limit -= 0.15;
  // si el partido está más cerca de otro candidato viable, exige más
  const rivals = game.parties.filter((p) => p.id !== candidate && p.id !== partyId && (composition(game, 'congreso')[p.id] ?? 0) >= 30);
  const closer = rivals.some((p) => dist(p, party) < d - 0.25);
  if (closer) limit -= 0.25;
  const accepted = d <= limit;
  const reason = accepted
    ? `${party.short} acepta: la distancia programática (${fmtNum(d, 2)}) es asumible para este tipo de acuerdo.`
    : `${party.short} rechaza: ${closer ? 'prefiere negociar con una alternativa más cercana y ' : ''}la distancia programática (${fmtNum(d, 2)}) es demasiado grande para un ${deal.label.toLowerCase()}.`;
  return { accepted, reason };
}

export interface InvestitureEstimate {
  tally: VoteTally;
  byParty: Record<string, 'si' | 'no' | 'abstencion'>;
  first: boolean;
  second: boolean;
}

/** Voto de investidura de cada grupo según acuerdos y distancias (sin acuerdo, los partidos lejanos votan no). */
export function investitureVotes(game: GameState, candidate: string, deals: Record<string, string>, playerChoice?: 'si' | 'no' | 'abstencion'): InvestitureEstimate {
  const comp = composition(game, 'congreso');
  const members = chamberSize(game, 'congreso');
  const cand = game.parties.find((p) => p.id === candidate)!;
  const byParty: InvestitureEstimate['byParty'] = {};
  const t: VoteTally = { yes: 0, no: 0, abstain: 0, absent: 0, members };
  for (const p of game.parties) {
    const seats = comp[p.id] ?? 0;
    if (!seats) continue;
    let v: 'si' | 'no' | 'abstencion';
    if (p.id === candidate) v = 'si';
    else if (p.id === game.playerParty && playerChoice) v = playerChoice;
    else if (deals[p.id]) v = DEALS[deals[p.id] as DealKind].vote;
    else v = dist(cand, p) < 0.35 ? 'abstencion' : 'no';
    byParty[p.id] = v;
    if (v === 'si') t.yes += seats;
    else if (v === 'no') t.no += seats;
    else t.abstain += seats;
  }
  return { tally: t, byParty, first: passes({ kind: 'absoluta' }, t), second: passes({ kind: 'simple' }, t) };
}

/** El candidato rival construye acuerdos con los partidos más cercanos. */
export function aiDeals(game: GameState, candidate: string): Record<string, string> {
  const cand = game.parties.find((p) => p.id === candidate)!;
  const comp = composition(game, 'congreso');
  const deals: Record<string, string> = {};
  const others = game.parties.filter((p) => p.id !== candidate && p.id !== game.playerParty && (comp[p.id] ?? 0) > 0).sort((a, b) => dist(a, cand) - dist(b, cand));
  for (const p of others) {
    for (const k of ['programa', 'territorial', 'abstencion'] as DealKind[]) {
      if (answerDeal(game, candidate, p.id, k).accepted) {
        deals[p.id] = k;
        break;
      }
    }
  }
  return deals;
}

export function formationDeadline(game: GameState): string | undefined {
  const f = game.government.formation;
  if (!f?.firstVoteOn) return undefined;
  return addDays(f.firstVoteOn, num(game, 'es.investidura.plazo'));
}

export function deadlinePassed(game: GameState): boolean {
  const d = formationDeadline(game);
  return !!d && cmp(game.date, d) > 0;
}

/** Candidato que propondría el Rey: el que suma más apoyos esperados (simplificación de las consultas). */
export function kingsCandidate(game: GameState, playerDeals: Record<string, string>): string {
  const comp = composition(game, 'congreso');
  const big = game.parties.filter((p) => (comp[p.id] ?? 0) >= 20).sort((a, b) => (comp[b.id] ?? 0) - (comp[a.id] ?? 0)).slice(0, 2);
  let best = big[0]?.id ?? game.parties[0].id;
  let bestScore = -Infinity;
  for (const p of big) {
    const deals = p.id === game.playerParty ? playerDeals : aiDeals(game, p.id);
    const est = investitureVotes(game, p.id, deals);
    const score = est.tally.yes - est.tally.no;
    if (score > bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best;
}
