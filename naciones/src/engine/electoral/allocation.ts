// Fórmulas de asignación de escaños. Funciones puras, probadas en tests/allocation.test.ts.

export type Votes = Record<string, number>;

/** Partidos que superan una barrera (fracción de votos válidos de la circunscripción). */
export function applyThreshold(votes: Votes, threshold: number, validTotal?: number): Votes {
  const total = validTotal ?? Object.values(votes).reduce((a, b) => a + b, 0);
  const out: Votes = {};
  for (const [p, v] of Object.entries(votes)) if (total > 0 && v / total >= threshold) out[p] = v;
  return out;
}

export interface QuotientRow {
  party: string;
  divisor: number;
  quotient: number;
  seat: boolean;
}

/**
 * Método D'Hondt: se divide el voto de cada partido entre 1, 2, 3, ... y se asignan los escaños
 * a los cocientes más altos. Empates: se favorece al partido con más votos totales (art. 163.1.d LOREG
 * en España resuelve empates de forma similar; aquí es la regla general del juego).
 */
export function dhondt(votes: Votes, seats: number, threshold = 0, validTotal?: number): { seats: Record<string, number>; table: QuotientRow[] } {
  const eligible = applyThreshold(votes, threshold, validTotal);
  const rows: QuotientRow[] = [];
  for (const [party, v] of Object.entries(eligible)) {
    for (let d = 1; d <= seats; d++) rows.push({ party, divisor: d, quotient: v / d, seat: false });
  }
  rows.sort((a, b) => b.quotient - a.quotient || (eligible[b.party] ?? 0) - (eligible[a.party] ?? 0) || a.party.localeCompare(b.party));
  const out: Record<string, number> = {};
  for (const p of Object.keys(votes)) out[p] = 0;
  for (let i = 0; i < Math.min(seats, rows.length); i++) {
    rows[i].seat = true;
    out[rows[i].party] = (out[rows[i].party] ?? 0) + 1;
  }
  return { seats: out, table: rows };
}

/** Cociente Hare con restos mayores. */
export function hareLargestRemainder(votes: Votes, seats: number, threshold = 0): Record<string, number> {
  const eligible = applyThreshold(votes, threshold);
  const total = Object.values(eligible).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const p of Object.keys(votes)) out[p] = 0;
  if (total <= 0 || seats <= 0) return out;
  const quota = total / seats;
  const rem: { p: string; r: number; v: number }[] = [];
  let assigned = 0;
  for (const [p, v] of Object.entries(eligible)) {
    const q = Math.floor(v / quota);
    out[p] = q;
    assigned += q;
    rem.push({ p, r: v / quota - q, v });
  }
  rem.sort((a, b) => b.r - a.r || b.v - a.v || a.p.localeCompare(b.p));
  for (let i = 0; assigned < seats && i < rem.length; i++, assigned++) out[rem[i % rem.length].p] += 1;
  return out;
}

/** Mayoría relativa: gana quien tiene más votos. */
export function plurality(votes: Votes): string {
  return Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
}

/**
 * Método Huntington-Hill (de "proporciones iguales"), usado para repartir los escaños de la
 * Cámara de Representantes entre estados (2 U.S.C. § 2a). Cada estado recibe 1 escaño y los
 * restantes se asignan por prioridad P / sqrt(n(n+1)).
 */
export function huntingtonHill(pop: Record<string, number>, seats: number): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = Object.keys(pop);
  for (const k of keys) out[k] = 1;
  let left = seats - keys.length;
  while (left > 0) {
    let best = '';
    let bestP = -1;
    for (const k of keys) {
      const n = out[k];
      const pr = pop[k] / Math.sqrt(n * (n + 1));
      if (pr > bestP) {
        bestP = pr;
        best = k;
      }
    }
    out[best] += 1;
    left--;
  }
  return out;
}

/**
 * Reparto de escaños entre circunscripciones con mínimo inicial por circunscripción y el resto
 * proporcional a la población por restos mayores (estilo art. 162 LOREG).
 */
export function distributeWithMinimum(pop: Record<string, number>, total: number, minimum: number, fixed: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const free = Object.keys(pop).filter((k) => fixed[k] === undefined);
  let remaining = total;
  for (const [k, v] of Object.entries(fixed)) {
    out[k] = v;
    remaining -= v;
  }
  for (const k of free) {
    out[k] = minimum;
    remaining -= minimum;
  }
  if (remaining < 0) throw new Error('Escaños insuficientes para el mínimo por circunscripción');
  const sub: Record<string, number> = {};
  for (const k of free) sub[k] = pop[k];
  const extra = hareLargestRemainder(sub, remaining);
  for (const k of free) out[k] += extra[k];
  return out;
}
