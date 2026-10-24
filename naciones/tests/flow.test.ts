import { acknowledgeResults, advanceTurn, campaignAction, isPlayerExecutive, makeBudgetProposal, makePolicyProposal, submitProposal } from '../src/engine/game';
import { parseSave, serialize } from '../src/engine/save/save';
import { news } from '../src/engine/news';
import type { CountryId, GameState } from '../src/engine/types';
import { game } from './helpers';

function until(g: GameState, pred: (g: GameState) => boolean, max = 24): GameState {
  let x = g;
  for (let i = 0; i < max && !pred(x); i++) x = x.phase === 'resultados' ? acknowledgeResults(x) : advanceTurn(x);
  return x;
}

describe.each(['sv', 'us', 'es'] as CountryId[])('recorrido completo (%s)', (country) => {
  test('país → campaña → elecciones → gobierno u oposición → propuesta → votación → consecuencias → guardar y continuar', () => {
    let g = game(country, `flujo-${country}`);
    // campaña
    g = campaignAction(g, { kind: 'mensaje', issues: ['empleo', 'salud'] }).game;
    g = campaignAction(g, { kind: 'publicidad', amount: 20 }).game;
    expect(g.log.length).toBeGreaterThan(0);
    // elecciones
    g = until(g, (x) => x.phase === 'resultados');
    expect(g.elections.length).toBeGreaterThan(0);
    g = acknowledgeResults(g);
    // gobierno constituido (en España puede hacer falta repetir elecciones: se avanza hasta tener Ejecutivo estable)
    g = until(g, (x) => x.phase === 'gobierno' && x.installs.length === 0, 30);
    expect(g.phase).toBe('gobierno');
    expect(['gobierno', 'oposicion']).toContain(isPlayerExecutive(g) ? 'gobierno' : 'oposicion');
    // propuesta: presupuesto si gobierna; si no, una ley desde la oposición
    const before = g.procedures.length;
    const prop = isPlayerExecutive(g) ? makeBudgetProposal(g, { ...g.fiscal.spendingPct, salud: (g.fiscal.spendingPct.salud ?? 3) * 1.05 }) : makePolicyProposal(g, 'sectorial', { 'regulacion-ambiental': (g.fiscal.levers['regulacion-ambiental'] ?? 50) + 10 });
    const sub = submitProposal(g, prop);
    if (sub.check.ok) {
      g = sub.game;
      expect(g.procedures.length).toBe(before + 1);
    } else {
      // requisito de iniciativa no cumplido (p. ej. sin escaños): el motor lo explica
      expect(sub.check.errors.length).toBeGreaterThan(0);
    }
    // votación y consecuencias
    g = until(g, (x) => x.procedures.filter((p) => p.status !== 'en-tramite').length > 0 || x.reports.length > 40, 8);
    expect(g.log.some((l) => l.kind === 'votacion')).toBe(true);
    const rep = g.reports[g.reports.length - 1];
    expect(rep.contributions.some((c) => c.kind === 'decision' || c.kind === 'evento' || c.kind === 'aleatorio')).toBe(true);
    // noticias sólo a partir de entradas del registro
    for (const n of news(g)) expect(g.log.some((l) => l.id === n.logId && l.title === n.headline)).toBe(true);
    // guardar y continuar
    const loaded = parseSave(serialize(g, 'flujo')).state!;
    const cont = advanceTurn(loaded);
    expect(cont.date > g.date).toBe(true);
  });
});
