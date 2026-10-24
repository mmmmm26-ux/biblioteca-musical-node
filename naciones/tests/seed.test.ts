import { externalEvents } from '../src/engine/events';
import { advanceTurn, campaignAction } from '../src/engine/game';
import { game } from './helpers';

function strip(g: ReturnType<typeof game>) {
  return JSON.stringify({ ...g, id: '', createdAt: '' });
}

describe('reproducibilidad con semilla', () => {
  test('misma semilla y mismas decisiones → mismo estado', () => {
    let a = game('es', 'semilla-x');
    let b = game('es', 'semilla-x');
    for (let i = 0; i < 4; i++) {
      a = advanceTurn(campaignAction(a, { kind: 'publicidad', amount: 10 }).game);
      b = advanceTurn(campaignAction(b, { kind: 'publicidad', amount: 10 }).game);
    }
    expect(strip(a)).toBe(strip(b));
  });

  test('otra semilla → otra partida', () => {
    let a = game('sv', 's1');
    let b = game('sv', 's2');
    for (let i = 0; i < 3; i++) {
      a = advanceTurn(a);
      b = advanceTurn(b);
    }
    expect(strip(a)).not.toBe(strip(b));
  });

  test('los eventos externos dependen sólo de la semilla y del mes (comparables entre ramas)', () => {
    const e1 = externalEvents('rama', 'sv', '2026-11-01', '2028-03-01');
    const e2 = externalEvents('rama', 'sv', '2026-11-01', '2028-03-01');
    expect(e1).toEqual(e2);
    let x = game('sv', 'rama');
    let y = game('sv', 'rama');
    y = campaignAction(y, { kind: 'publicidad', amount: 30 }).game;
    for (let i = 0; i < 6; i++) {
      x = advanceTurn(x);
      y = advanceTurn(y);
    }
    const ev = (g: typeof x) => g.log.filter((l) => l.kind === 'evento' && (l.data as { externo?: boolean })?.externo).map((l) => `${l.date}:${l.title}`);
    expect(ev(x)).toEqual(ev(y));
  });
});
