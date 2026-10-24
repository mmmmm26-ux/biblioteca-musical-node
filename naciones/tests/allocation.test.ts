import { dhondt, distributeWithMinimum, hareLargestRemainder, huntingtonHill } from '../src/engine/electoral/allocation';
import es from '../src/data/countries/es';
import sv from '../src/data/countries/sv';
import us from '../src/data/countries/us';

describe('fórmulas de reparto', () => {
  test('D’Hondt: ejemplo clásico de 8 escaños', () => {
    const r = dhondt({ A: 100000, B: 80000, C: 30000, D: 20000 }, 8);
    expect(r.seats).toEqual({ A: 4, B: 3, C: 1, D: 0 });
  });
  test('D’Hondt con barrera del 3 %: una lista por debajo no obtiene escaño', () => {
    const r = dhondt({ A: 600, B: 371, C: 29 }, 36, 0.03);
    expect(r.seats.C).toBe(0);
    const r2 = dhondt({ A: 600, B: 371, C: 29 }, 36, 0);
    expect(r2.seats.C).toBeGreaterThan(0);
  });
  test('Hare favorece más a los pequeños que D’Hondt en el mismo caso', () => {
    const v = { A: 4700, B: 1600, C: 1400, D: 1300, E: 1000 };
    const d = dhondt(v, 10).seats;
    const h = hareLargestRemainder(v, 10);
    expect(Object.values(h).reduce((a, b) => a + b, 0)).toBe(10);
    expect(h.A).toBeLessThanOrEqual(d.A);
    expect(h.E).toBeGreaterThanOrEqual(d.E);
  });
  test('Huntington-Hill reproduce el reparto de 435 escaños del Censo 2020', () => {
    const pop = Object.fromEntries(us.territories.filter((t) => t.short !== 'DC').map((t) => [t.id, t.pop]));
    const hh = huntingtonHill(pop, 435);
    const official = us.rules.find((r) => r.id === 'us.camara.reparto')!.value as Record<string, number>;
    const diffs = Object.keys(official).filter((k) => hh[k] !== official[k]);
    expect(diffs).toEqual([]);
  });
  test('Totales: 60 diputados (SV), 350 (ES), 435 representantes y 538 electores (EE. UU.)', () => {
    const svSeats = sv.rules.find((r) => r.id === 'sv.asamblea.reparto')!.value as Record<string, number>;
    expect(Object.values(svSeats).reduce((a, b) => a + b, 0)).toBe(60);
    expect(svSeats['sv-ss']).toBe(11);
    expect(svSeats['sv-ext']).toBe(6);
    const esSeats = es.rules.find((r) => r.id === 'es.congreso.reparto')!.value as Record<string, number>;
    expect(Object.values(esSeats).reduce((a, b) => a + b, 0)).toBe(350);
    expect(esSeats['es-m']).toBe(38);
    expect(esSeats['es-ca']).toBe(8);
    expect(us.territories.reduce((a, t) => a + t.seats.camara, 0)).toBe(435);
    expect(us.territories.reduce((a, t) => a + t.seats.electores, 0)).toBe(538);
    expect(es.territories.reduce((a, t) => a + t.seats.senado, 0)).toBe(209);
  });
  test('Reparto con mínimo por circunscripción conserva el total', () => {
    const pop = Object.fromEntries(es.territories.map((t) => [t.id, t.pop]));
    const r = distributeWithMinimum(pop, 400, 2, { 'es-ce': 1, 'es-ml': 1 });
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(400);
    expect(Math.min(...Object.entries(r).filter(([k]) => k !== 'es-ce' && k !== 'es-ml').map(([, v]) => v))).toBeGreaterThanOrEqual(2);
  });
  test('Senado de EE. UU.: cada estado en dos clases distintas; 33/33/34', () => {
    const count: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const t of us.territories.filter((x) => x.short !== 'DC')) {
      expect(new Set(t.senateClasses).size).toBe(2);
      for (const c of t.senateClasses!) count[c]++;
    }
    expect(count).toEqual({ 1: 33, 2: 33, 3: 34 });
  });
});
