import type { Majority, VoteTally } from '../types';

// Motor de mayorías. Funciones puras y probadas en tests/majority.test.ts.

/** techo(a*num/den) en aritmética entera, para evitar errores de coma flotante. */
export function ceilFrac(a: number, num: number, den: number): number {
  return Math.floor((a * num + den - 1) / den);
}

/** Número mínimo de votos a favor necesarios. Para mayoría simple depende de los votos en contra. */
export function requiredYes(m: Majority, t: VoteTally): number {
  switch (m.kind) {
    case 'simple':
      return t.no + 1;
    case 'absoluta':
      return Math.floor(t.members / 2) + 1;
    case 'cualificada': {
      const base = m.base === 'miembros' ? t.members : t.yes + t.no + t.abstain;
      return ceilFrac(base, m.num, m.den);
    }
  }
}

export function passes(m: Majority, t: VoteTally): boolean {
  if (m.kind === 'simple') return t.yes > t.no;
  return t.yes >= requiredYes(m, t);
}

/** Umbral fijo de una mayoría sobre miembros (para mostrarlo antes de votar). */
export function thresholdOverMembers(m: Majority, members: number): number | null {
  if (m.kind === 'absoluta') return Math.floor(members / 2) + 1;
  if (m.kind === 'cualificada' && m.base === 'miembros') return ceilFrac(members, m.num, m.den);
  if (m.kind === 'cualificada') return ceilFrac(members, m.num, m.den); // si todos están presentes
  return null;
}

export function describeMajority(m: Majority, members?: number): string {
  switch (m.kind) {
    case 'simple':
      return 'Mayoría simple (más votos a favor que en contra)';
    case 'absoluta':
      return members ? `Mayoría absoluta: ${Math.floor(members / 2) + 1} de ${members} miembros` : 'Mayoría absoluta de los miembros';
    case 'cualificada': {
      const frac = `${m.num}/${m.den}`;
      const nombre = fracName(m.num, m.den);
      if (m.base === 'miembros')
        return members ? `Mayoría cualificada de ${nombre} (${frac}) de los miembros: ${ceilFrac(members, m.num, m.den)} de ${members}` : `Mayoría cualificada de ${nombre} de los miembros`;
      return `Mayoría cualificada de ${nombre} (${frac}) de los presentes${members ? ` (${ceilFrac(members, m.num, m.den)} si asisten los ${members})` : ''}`;
    }
  }
}

function fracName(num: number, den: number): string {
  const k = `${num}/${den}`;
  return ({ '2/3': 'dos tercios', '3/5': 'tres quintos', '3/4': 'tres cuartos', '1/2': 'la mitad' } as Record<string, string>)[k] ?? k;
}
