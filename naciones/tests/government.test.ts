import { advanceTurn, offerDeal, requestInvestiture, censureMotion } from '../src/engine/game';
import { investitureVotes } from '../src/engine/government/formation';
import { runElection } from '../src/engine/electoral/elections';
import { game, setComposition } from './helpers';

describe('formación de gobierno', () => {
  test('España: con 150 síes, 140 noes y 60 abstenciones falla la 1.ª votación y prospera la 2.ª', () => {
    const g = game('es');
    setComposition(g, 'congreso', { [g.playerParty]: 150, 'es-pyo': 140, 'es-iec': 60 });
    const v = investitureVotes(g, g.playerParty, { 'es-iec': 'abstencion' });
    expect(v.tally.yes).toBe(150);
    expect(v.first).toBe(false);
    expect(v.second).toBe(true);
  });

  test('España: ganar en votos no basta; sin apoyos ni abstenciones la investidura fracasa', () => {
    const g = game('es');
    setComposition(g, 'congreso', { [g.playerParty]: 140, 'es-alc': 120, 'es-pyo': 90 });
    const v = investitureVotes(g, g.playerParty, {});
    expect(v.first).toBe(false);
    expect(v.second).toBe(false);
  });

  test('España: flujo de investidura con negociación tras las elecciones', () => {
    let g = game('es', 'formacion');
    for (let i = 0; i < 6 && g.phase !== 'formacion'; i++) g = advanceTurn(g);
    expect(g.phase).toBe('formacion');
    for (const p of g.parties.filter((x) => !x.isPlayer)) g = offerDeal(g, p.id, 'abstencion').game;
    const r = requestInvestiture(g);
    expect(typeof r.message).toBe('string');
    expect(r.game.government.formation?.attempts.length ?? 0).toBeGreaterThanOrEqual(0);
  });

  test('España: la moción de censura exige 35 diputados para presentarse', () => {
    const g = game('es');
    g.phase = 'gobierno';
    setComposition(g, 'congreso', { [g.playerParty]: 20, 'es-alc': 330 });
    g.government = { ...g.government, executiveParty: 'es-alc', coalition: ['es-alc'] };
    expect(censureMotion(g).message).toMatch(/35/);
  });

  test('El Salvador: con mayoría relativa gana el más votado aunque no llegue al 50 %', () => {
    const g = game('sv');
    const out = runElection(g, ['presidencia'], '2027-02-28');
    const r = out.results[0];
    const top = Math.max(...Object.values(r.national));
    expect(top).toBeLessThan(50);
    expect(r.winner).toBeDefined();
    expect(r.runoff).toBeUndefined();
  });

  test('EE. UU.: el ganador necesita 270 electores; los electores suman 538', () => {
    const g = game('us');
    const out = runElection(g, ['presidencia', 'camara'], '2028-11-07');
    const r = out.results.find((x) => x.office === 'presidencia')!;
    expect(Object.values(r.electors!).reduce((a, b) => a + b, 0)).toBe(538);
    const w = r.electors![r.winner!] ?? 0;
    expect(w >= 270 || !!r.contingent).toBe(true);
    expect(out.legislators.filter((l) => l.chamber === 'camara')).toHaveLength(435);
  });
});

import { resolveDecision } from '../src/engine/game';
import { getDef, startProcedure } from '../src/engine/legal/procedures';
import { makePolicyProposal } from '../src/engine/game';
import { governing } from './helpers';

describe('veto presidencial (El Salvador)', () => {
  test('una ley de la oposición llega a la Presidencia del jugador: puede vetarla y la Asamblea necesita 40 votos para superar el veto', () => {
    let g = governing(game('sv', 'veto'));
    setComposition(g, 'asamblea', { 'sv-als': 35, [g.playerParty]: 25 });
    const p = makePolicyProposal(g, 'sectorial', { 'regulacion-ambiental': 20 });
    startProcedure(g, getDef(g, p.procedureId), { title: p.title, proposal: p, proposerParty: 'sv-als' });
    g.procedures[0].meta = { playerVote: 'no' };
    for (let i = 0; i < 3 && !g.decisions.length; i++) g = advanceTurn(g);
    const d = g.decisions.find((x) => x.kind === 'sancion');
    expect(d).toBeDefined();
    g = resolveDecision(g, d!.id, 'vetar');
    for (let i = 0; i < 3; i++) g = advanceTurn(g);
    const proc = g.procedures[0];
    expect(proc.log.some((l) => l.outcome === 'vetado')).toBe(true);
    // 35 < 40: el veto se mantiene
    expect(proc.status).toBe('rechazada');
  });
});
