import { ceilFrac, passes, requiredYes, thresholdOverMembers } from '../src/engine/legal/majority';
import type { VoteTally } from '../src/engine/types';

const t = (yes: number, no: number, abstain: number, members: number): VoteTally => ({ yes, no, abstain, absent: members - yes - no - abstain, members });

describe('mayorías', () => {
  test('mayoría simple: más síes que noes; las abstenciones no cuentan', () => {
    expect(passes({ kind: 'simple' }, t(150, 140, 60, 350))).toBe(true);
    expect(passes({ kind: 'simple' }, t(140, 140, 70, 350))).toBe(false);
  });
  test('mayoría absoluta del Congreso español: 176 de 350', () => {
    expect(requiredYes({ kind: 'absoluta' }, t(0, 0, 0, 350))).toBe(176);
    expect(passes({ kind: 'absoluta' }, t(175, 10, 165, 350))).toBe(false);
    expect(passes({ kind: 'absoluta' }, t(176, 174, 0, 350))).toBe(true);
  });
  test('El Salvador: 31 (mitad más uno), 40 (2/3) y 45 (3/4) de 60 diputados electos', () => {
    expect(thresholdOverMembers({ kind: 'absoluta' }, 60)).toBe(31);
    expect(thresholdOverMembers({ kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, 60)).toBe(40);
    expect(thresholdOverMembers({ kind: 'cualificada', num: 3, den: 4, base: 'miembros' }, 60)).toBe(45);
  });
  test('España: 3/5 (210) y 2/3 (234) de 350 sin errores de coma flotante', () => {
    expect(ceilFrac(350, 3, 5)).toBe(210);
    expect(ceilFrac(350, 2, 3)).toBe(234);
  });
  test('EE. UU.: 2/3 de los presentes (no de los miembros) y cloture de 60', () => {
    const m = { kind: 'cualificada' as const, num: 2, den: 3, base: 'presentes' as const };
    expect(passes(m, t(280, 140, 0, 435))).toBe(true); // 420 presentes → 280
    expect(passes(m, t(279, 141, 0, 435))).toBe(false);
    expect(requiredYes({ kind: 'cualificada', num: 60, den: 100, base: 'miembros' }, t(0, 0, 0, 100))).toBe(60);
  });
});
