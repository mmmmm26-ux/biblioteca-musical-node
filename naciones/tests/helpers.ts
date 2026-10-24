import { getCountry } from '../src/data/countries';
import { acknowledgeResults, advanceTurn, newGame } from '../src/engine/game';
import type { CountryId, GameState, Legislator } from '../src/engine/types';

export function game(country: CountryId, seed = 'prueba', mode: 'nuevo' | 'existente' = 'nuevo', baseParty?: string): GameState {
  return newGame({ country, difficulty: 'normal', seed, partyMode: mode, baseParty, party: { name: 'Partido de Prueba', short: 'PP0', color: '#555', econ: 0, social: 0, priorities: ['empleo', 'salud', 'educacion'] }, leader: 'Persona Prueba', promises: [] });
}

/** Sustituye la composición de una cámara (para probar mayorías de forma controlada). */
export function setComposition(g: GameState, chamber: string, seats: Record<string, number>, discipline = 1) {
  g.legislators = g.legislators.filter((l) => l.chamber !== chamber);
  let i = 0;
  for (const [party, n] of Object.entries(seats)) {
    const p = g.parties.find((x) => x.id === party)!;
    for (let k = 0; k < n; k++) {
      const terr = getCountry(g.country).territories[i % getCountry(g.country).territories.length].id;
      const l: Legislator = { id: `${chamber}-t-${i++}`, chamber, territory: terr, party, econ: p.econ, social: p.social, discipline, termEnds: '2099-01-01' };
      g.legislators.push(l);
    }
  }
}

/** Lleva la partida a la fase de gobierno con el jugador al frente del Ejecutivo. */
export function governing(g: GameState): GameState {
  g.phase = 'gobierno';
  g.playerRole = 'gobierno';
  g.government = { executiveParty: g.playerParty, executiveName: g.candidateName, coalition: [g.playerParty], supportParties: [], since: g.date, termsServed: { [g.candidateName]: 1 } };
  // aleja las elecciones para probar trámites sin interferencias del calendario electoral
  g.schedule = g.schedule.map((s) => ({ ...s, date: '2031-11-30' }));
  return g;
}

export function toElection(g: GameState): GameState {
  let x = g;
  for (let i = 0; i < 10 && x.phase !== 'resultados'; i++) x = advanceTurn(x);
  return x;
}

export { acknowledgeResults, advanceTurn };
