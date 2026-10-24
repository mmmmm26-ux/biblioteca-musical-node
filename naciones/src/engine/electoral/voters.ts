import { SEGMENTS, segmentMix } from '../../data/segments';
import type { CountryModule } from '../country';
import type { CountryId, IssueId, Party, Territory } from '../types';

// Modelo de voto probabilístico (capa C, supuestos explícitos en docs/MODELO.md).
// Cada segmento se representa con 25 votantes "tipo" repartidos alrededor de su posición media,
// así un mismo grupo social contiene votantes de posiciones distintas.

const NODES = [-1.5, -0.75, 0, 0.75, 1.5];
const RAW_W = NODES.map((x) => Math.exp((-x * x) / 2));
const W_SUM = RAW_W.reduce((a, b) => a + b, 0);
const W = RAW_W.map((w) => w / W_SUM);

export const VOTE_PARAMS = {
  distance: 2.2, // peso de la distancia ideológica
  valence: 1.2, // peso de la popularidad/competencia percibida
  strength: 0.8, // implantación organizativa
  issues: 1.2, // coincidencia de prioridades
  focusBoost: 0.6, // énfasis de campaña en un tema
  identity: 1.6, // voto a partidos territoriales donde hay identidad propia
  viabilityShare: 0.15, // en sistemas mayoritarios, partidos por debajo de este voto esperado pierden apoyo útil
  viabilityPenalty: 1.5,
  urbanSocial: 0.3, // las zonas rurales son algo más tradicionales en el eje social (patrón empírico general)
};

const centers = new Map<string, { econ: number; social: number }>();

/**
 * Centro del electorado de un país (media ponderada por población de todas las posiciones).
 * Las posiciones de los votantes se miden respecto a este centro, de modo que ninguna orientación
 * parte con ventaja por la forma en que se definieron los segmentos (supuesto de neutralidad).
 */
export function countryCenter(c: CountryModule): { econ: number; social: number } {
  const hit = centers.get(c.id);
  if (hit) return hit;
  let e = 0, s = 0, w = 0;
  for (const t of c.territories) {
    const mix = segmentMix(c.id, t.urban);
    for (const seg of SEGMENTS) {
      const k = (mix[seg.id] ?? 0) * t.pop;
      e += k * (seg.econ + t.lean.econ);
      s += k * (seg.social + t.lean.social + (0.5 - t.urban) * VOTE_PARAMS.urbanSocial);
      w += k;
    }
  }
  const out = { econ: e / w, social: s / w };
  centers.set(c.id, out);
  return out;
}

/** Centro de los segmentos con la composición nacional media (para apoyo ciudadano y aprobación). */
export function segmentCenter(country: CountryId): { econ: number; social: number } {
  const mix = segmentMix(country, 0.75);
  let e = 0, s = 0;
  for (const seg of SEGMENTS) {
    e += (mix[seg.id] ?? 0) * seg.econ;
    s += (mix[seg.id] ?? 0) * seg.social;
  }
  return { econ: e, social: s };
}

export interface VoteCtx {
  country: CountryId;
  parties: Party[];
  valenceAdj: Record<string, number>;
  mobilization: Record<string, Record<string, number>>;
  focus: Record<string, IssueId[]>;
  viability?: Record<string, number>;
  plurality: boolean;
  turnoutFactor: number;
  noise?: Record<string, number>;
  center: { econ: number; social: number };
}

export function partiesIn(t: Territory, parties: Party[]): Party[] {
  return parties.filter((p) => !p.regionalGroups || (t.group !== undefined && p.regionalGroups.includes(t.group)));
}

export interface TerritoryVote {
  shares: Record<string, number>;
  votes: Record<string, number>;
  total: number;
  electorate: number;
  turnout: number;
}

export function territoryVote(t: Territory, ctx: VoteCtx, shift: { econ: number; social: number } = { econ: 0, social: 0 }): TerritoryVote {
  const ps = partiesIn(t, ctx.parties);
  const mix = segmentMix(ctx.country, t.urban);
  const acc: Record<string, number> = Object.fromEntries(ps.map((p) => [p.id, 0]));
  let turnoutSum = 0;
  const P = VOTE_PARAMS;
  const urbanShift = (0.5 - t.urban) * P.urbanSocial;
  const totalMob = ps.reduce((a, p) => a + (ctx.mobilization[p.id]?.[t.id] ?? 0), 0);
  const base: Record<string, number> = {};
  for (const p of ps) {
    let b = P.valence * (p.valence + (ctx.valenceAdj[p.id] ?? 0)) + P.strength * (p.strength - 0.5) + (ctx.mobilization[p.id]?.[t.id] ?? 0) + (ctx.noise?.[p.id] ?? 0);
    if (p.regionalGroups) b += P.identity * (t.identity ?? 0);
    else b -= 0.2 * (t.identity ?? 0);
    if (ctx.plurality && ctx.viability) {
      const s = ctx.viability[p.id] ?? 0;
      if (s < P.viabilityShare) b -= P.viabilityPenalty * (1 - s / P.viabilityShare);
    }
    base[p.id] = b;
  }
  const u = new Array(ps.length).fill(0);
  for (const seg of SEGMENTS) {
    const w = mix[seg.id] ?? 0;
    if (w <= 0) continue;
    const turnout = Math.min(0.95, Math.max(0.15, seg.turnout * ctx.turnoutFactor * (1 + 0.04 * totalMob)));
    turnoutSum += w * turnout;
    const issueTerm = ps.map((p) => {
      let s = 0;
      for (const iss of p.priorities) s += (seg.priorities[iss] ?? 0) * (1 + (ctx.focus[p.id]?.includes(iss) ? P.focusBoost : 0));
      return P.issues * s;
    });
    for (let i = 0; i < NODES.length; i++) {
      for (let j = 0; j < NODES.length; j++) {
        const ve = seg.econ + t.lean.econ + shift.econ + seg.spread * NODES[i] - ctx.center.econ;
        const vs = seg.social + t.lean.social + urbanShift + shift.social + seg.spread * NODES[j] - ctx.center.social;
        let max = -Infinity;
        for (let k = 0; k < ps.length; k++) {
          const p = ps[k];
          const d = (ve - p.econ) ** 2 + (vs - p.social) ** 2;
          u[k] = -P.distance * d + base[p.id] + issueTerm[k];
          if (u[k] > max) max = u[k];
        }
        let z = 0;
        for (let k = 0; k < ps.length; k++) {
          u[k] = Math.exp(u[k] - max);
          z += u[k];
        }
        const mass = w * turnout * W[i] * W[j];
        for (let k = 0; k < ps.length; k++) acc[ps[k].id] += (mass * u[k]) / z;
      }
    }
  }
  const electorate = t.pop * 1000 * 0.75;
  const tot = Object.values(acc).reduce((a, b) => a + b, 0);
  const shares: Record<string, number> = {};
  const votes: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc)) {
    shares[k] = tot > 0 ? v / tot : 0;
    votes[k] = Math.round((v / Math.max(tot, 1e-9)) * electorate * turnoutSum);
  }
  return { shares, votes, total: Object.values(votes).reduce((a, b) => a + b, 0), electorate, turnout: turnoutSum };
}

/** Agrega votos de varios territorios. */
export function aggregate(list: TerritoryVote[]): { shares: Record<string, number>; votes: Record<string, number>; total: number; turnout: number } {
  const votes: Record<string, number> = {};
  let total = 0;
  let electorate = 0;
  for (const tv of list) {
    for (const [p, v] of Object.entries(tv.votes)) votes[p] = (votes[p] ?? 0) + v;
    total += tv.total;
    electorate += tv.electorate;
  }
  const shares: Record<string, number> = {};
  for (const [p, v] of Object.entries(votes)) shares[p] = total > 0 ? v / total : 0;
  return { shares, votes, total, turnout: electorate > 0 ? total / electorate : 0 };
}
