import { advanceTurn, makeBudgetProposal, submitProposal } from '../src/engine/game';
import { indicators, stepEconomy } from '../src/engine/economy/model';
import type { GameState } from '../src/engine/types';
import { game, governing, setComposition } from './helpers';


describe('coherencia presupuestaria', () => {
  test('cada mes: deuda nueva = deuda anterior + gasto + intereses − ingresos', () => {
    let g = game('sv', 'cuentas');
    for (let i = 0; i < 18; i++) {
      const before = g.economy.debt;
      g = advanceTurn(g);
      if (g.phase === 'resultados') g = { ...g, phase: 'gobierno' } as GameState;
      const f = g.economy.flows;
      const deficit = f.spend[11] + f.int[11] - f.rev[11];
      expect(g.economy.debt).toBeCloseTo(before + deficit, 6);
    }
  });

  test('al inicio reproduce el déficit y la deuda observados', () => {
    for (const c of ['sv', 'us', 'es'] as const) {
      const ind = indicators(game(c));
      const expected = { sv: [3.0, 88], us: [5.9, 99.8], es: [2.4, 101] }[c];
      expect(ind.deficit).toBeCloseTo(expected[0], 3);
      expect(ind.deuda).toBeCloseTo(expected[1], 3);
    }
  });

  test('más gasto no mejora todo: sube el déficit y la calidad del servicio responde con retraso', () => {
    const base = governing(game('sv', 'gasto'));
    setComposition(base, 'asamblea', { [base.playerParty]: 60 });
    const pct = { ...base.fiscal.spendingPct, salud: 4.5 };
    let a = submitProposal(base, makeBudgetProposal(base, pct)).game;
    let b = base;
    for (let i = 0; i < 16; i++) {
      a = advanceTurn(a);
      b = advanceTurn(b);
    }
    const ia = indicators(a), ib = indicators(b);
    expect(a.procedures.find((p) => p.proposal.kind === 'presupuesto')?.status).toBe('vigente');
    expect(ia.deficit).toBeGreaterThan(ib.deficit);
    expect(ia.salud).toBeGreaterThan(ib.salud);
    // el servicio no salta de golpe: tras un año sigue lejos de su objetivo de largo plazo
    expect(ia.salud - ib.salud).toBeLessThan(15);
  });

  test('sin presupuesto aprobado se prorroga el anterior en términos nominales', () => {
    let g = governing(game('sv', 'prorroga'));
    setComposition(g, 'asamblea', { 'sv-als': 60 });
    const nominal = { ...g.fiscal.spendingNominal };
    for (let i = 0; i < 14; i++) g = advanceTurn(g);
    expect(g.log.some((l) => /prórroga/.test(l.title))).toBe(true);
    expect(g.fiscal.spendingNominal.salud).toBeCloseTo(nominal.salud, 6);
  });

  test('el banco central y el BCE no son controlables: el tipo del BCE no responde a la economía española', () => {
    let g = game('es');
    const r0 = g.economy.policyRate;
    for (let i = 0; i < 6; i++) g = advanceTurn(g);
    expect(g.economy.policyRate).toBe(r0);
    void stepEconomy;
  });
});
