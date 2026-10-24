import { advanceTurn } from '../src/engine/game';
import { createBranch, deleteSlot, listSlots, loadSlot, parseSave, saveSlot, serialize } from '../src/engine/save/save';
import { game } from './helpers';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('guardado y recuperación', () => {
  test('exportar e importar conserva la partida y se puede continuar', () => {
    let g = game('us', 'guardar');
    g = advanceTurn(advanceTurn(g));
    const r = parseSave(serialize(g, 'prueba'));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(g));
    const next = advanceTurn(r.state!);
    expect(next.date > g.date).toBe(true);
    expect(JSON.stringify(advanceTurn(g))).toBe(JSON.stringify(next));
  });

  test('archivo manipulado o mal formado → rechazado', () => {
    const g = game('sv');
    const text = serialize(g, 'x');
    const tampered = text.replace('"debt":', '"debt":1+');
    expect(parseSave(tampered).ok).toBe(false);
    const obj = JSON.parse(text);
    obj.state.economy.debt = 1;
    expect(parseSave(JSON.stringify(obj)).errors.join(' ')).toMatch(/suma de verificación/);
    expect(parseSave('{"hola":1}').ok).toBe(false);
    expect(parseSave('no es json').ok).toBe(false);
    const bad = JSON.parse(text);
    bad.state.country = 'xx';
    expect(parseSave(JSON.stringify(bad)).ok).toBe(false);
  });

  test('una partida con otra versión de reglas conserva sus reglas y avisa', () => {
    const g = game('es');
    g.rulesetVersion = '2025-01-01';
    g.rules['es.congreso.barrera'] = { ...g.rules['es.congreso.barrera'], value: 0.07 };
    const r = parseSave(serialize(g, 'antigua'));
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/versión de reglas/);
    expect(r.state!.rules['es.congreso.barrera'].value).toBe(0.07);
  });

  test('ranuras locales y ramas', () => {
    const st = mem();
    const g = game('sv', 'ranura');
    saveSlot(st, 'a', 'A', g);
    const b = createBranch(g, 'Rama B');
    saveSlot(st, 'b', 'B', b);
    expect(listSlots(st)).toHaveLength(2);
    expect(loadSlot(st, 'b').state!.branchLabel).toBe('Rama B');
    expect(loadSlot(st, 'b').state!.id).toBe(g.id);
    deleteSlot(st, 'a');
    expect(listSlots(st).map((s) => s.id)).toEqual(['b']);
  });
});
