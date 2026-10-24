import { getCountry } from '../../data/countries';
import { SEGMENTS, segmentMix } from '../../data/segments';
import type { CountryModule } from '../country';
import { segmentCenter } from '../electoral/voters';
import { monthsBetween } from '../calendar';
import type { GameEvent } from '../events';
import { stream } from '../rng';
import type { Contribution, CountryId, EconomyState, FiscalPolicy, GameState, IssueId } from '../types';

// Modelo macro-fiscal mensual simplificado (capa C). Ecuaciones y parámetros en docs/MODELO.md.
// Unidades: PIB y deuda en miles de millones de moneda nominal; tasas en %; índices de servicios 0-100.

export const SERVICES = ['salud', 'educacion', 'seguridad', 'infraestructura'] as const;
const TAU: Record<string, number> = { salud: 18, educacion: 48, seguridad: 12, infraestructura: 36 };
/** Peso del gasto del nivel de gobierno controlado por el jugador en la calidad del servicio (federalismo). */
const SERVICE_WEIGHT: Record<CountryId, Record<string, number>> = {
  sv: {},
  us: { educacion: 0.15, seguridad: 0.5, salud: 0.6, infraestructura: 0.4 },
  es: { seguridad: 0.8, infraestructura: 0.7 },
};
const MIN_WAGE_U: Record<CountryId, number> = { sv: 0.04, es: 0.03, us: 0.012 };
const NEUTRAL_REAL_RATE: Record<CountryId, number> = { sv: 1.5, es: 0.5, us: 1.0 };

export function otherRevenuePct(c: CountryModule): number {
  const spend = c.budget.reduce((a, b) => a + b.basePct, 0) + c.economy.interestPct;
  const taxes = c.taxes.reduce((a, b) => a + b.basePct, 0);
  return spend - c.economy.deficitPct - taxes;
}

export function initEconomy(c: CountryModule): EconomyState {
  const B = c.economy;
  const priceHistory: number[] = [];
  const realHistory: number[] = [];
  for (let k = 12; k >= 0; k--) {
    priceHistory.push(1 / Math.pow(1 + B.inflation / 100, k / 12));
    realHistory.push(100 / Math.pow(1 + B.potentialGrowth / 100, k / 12));
  }
  const monthGDP = B.nominalGDP / 12;
  const debt = (B.debtPct / 100) * B.nominalGDP;
  const intM = (B.interestPct / 100) * monthGDP;
  const spendM = (c.budget.reduce((a, b) => a + b.basePct, 0) / 100) * monthGDP;
  const revM = spendM + intM - (B.deficitPct / 100) * monthGDP;
  return {
    realIndex: 100,
    potentialIndex: 100,
    priceLevel: 1,
    priceHistory,
    realHistory,
    inflation: B.inflation,
    coreInflation: B.inflation,
    unemployment: B.unemployment,
    naturalUnemployment: B.naturalUnemployment,
    poverty: B.poverty,
    policyRate: B.policyRate,
    effectiveDebtRate: (B.interestPct / B.debtPct) * 100,
    debt,
    nominalGDPBase: B.nominalGDP,
    privateShock: 0,
    impulses: {},
    services: { salud: 50, educacion: 50, seguridad: 50, infraestructura: 50 },
    absorbed: Object.fromEntries(c.budget.map((b) => [b.id, 1])),
    adminCapacity: 50,
    environment: 50,
    trust: 50,
    approval: 50,
    segmentApproval: Object.fromEntries(SEGMENTS.map((s) => [s.id, 50])),
    flows: { rev: Array(12).fill(revM), spend: Array(12).fill(spendM), int: Array(12).fill(intM), gdp: Array(12).fill(monthGDP) },
    shocks: { prices: 0, trust: 0, approval: 0, rate: 0, services: {} },
  };
}

export function baseLevers(c: CountryModule): Record<string, number> {
  const lv: Record<string, number> = {};
  for (const t of c.taxes) lv[t.id] = t.base;
  for (const r of c.regulations) lv[r.id] = r.base;
  if (c.id === 'es') lv.financiacion = 100;
  return lv;
}

/** % del PIB efectivo por categoría (las competencias territoriales dependen de la financiación). */
export function effectivePct(c: CountryModule, pct: Record<string, number>, levers: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of c.budget) {
    if (!b.adjustable && b.competence === 'territorial') out[b.id] = b.basePct * ((levers.financiacion ?? 100) / 100);
    else out[b.id] = pct[b.id] ?? b.basePct;
  }
  return out;
}

export function potentialNominal(game: GameState): number {
  const e = game.economy;
  return e.nominalGDPBase * (e.potentialIndex / 100) * e.priceLevel;
}

export function makeFiscal(game: GameState | null, c: CountryModule, pct: Record<string, number>, levers: Record<string, number>, fiscalYear: number, approvedBy: FiscalPolicy['approvedBy']): FiscalPolicy {
  // Presupuesto en términos nominales para el ejercicio: se calcula sobre el PIB esperado a mitad de año,
  // de modo que un presupuesto "neutral" no expande ni contrae la economía en promedio.
  const midYear = 1 + (c.economy.potentialGrowth + c.economy.inflationTarget) / 200;
  const gdp = (game ? potentialNominal(game) : c.economy.nominalGDP) * midYear;
  const eff = effectivePct(c, pct, levers);
  return {
    spendingPct: { ...pct },
    spendingNominal: Object.fromEntries(Object.entries(eff).map(([k, v]) => [k, (v / 100) * gdp])),
    fiscalYear,
    approvedBy,
    levers: { ...levers },
  };
}

export function initFiscal(c: CountryModule, fiscalYear: number): FiscalPolicy {
  const pct = Object.fromEntries(c.budget.map((b) => [b.id, b.basePct]));
  return makeFiscal(null, c, pct, baseLevers(c), fiscalYear, 'inicial');
}

function taxFactor(c: CountryModule, lv: Record<string, number>, id: string): number {
  const t = c.taxes.find((x) => x.id === id);
  if (!t || t.base === 0) return 1;
  return (lv[id] ?? t.base) / t.base;
}

export function yoy(arr: number[]): number {
  if (arr.length < 13) return 0;
  return (arr[arr.length - 1] / arr[arr.length - 13] - 1) * 100;
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export interface Indicators {
  crecimiento: number;
  inflacion: number;
  desempleo: number;
  pobreza: number;
  deuda: number;
  deficit: number;
  ingresos: number;
  gastos: number;
  intereses: number;
  servicios: number;
  salud: number;
  educacion: number;
  seguridad: number;
  infraestructura: number;
  medioambiente: number;
  confianza: number;
  aprobacion: number;
  capacidad: number;
  tipo: number;
  brecha: number;
}

export function indicators(game: GameState): Indicators {
  const e = game.economy;
  const gdp12 = sum(e.flows.gdp);
  const s = e.services;
  return {
    crecimiento: yoy(e.realHistory),
    inflacion: yoy(e.priceHistory),
    desempleo: e.unemployment,
    pobreza: e.poverty,
    deuda: (e.debt / gdp12) * 100,
    deficit: ((sum(e.flows.spend) + sum(e.flows.int) - sum(e.flows.rev)) / gdp12) * 100,
    ingresos: (sum(e.flows.rev) / gdp12) * 100,
    gastos: (sum(e.flows.spend) / gdp12) * 100,
    intereses: (sum(e.flows.int) / gdp12) * 100,
    servicios: (s.salud + s.educacion + s.seguridad + s.infraestructura) / 4,
    salud: s.salud,
    educacion: s.educacion,
    seguridad: s.seguridad,
    infraestructura: s.infraestructura,
    medioambiente: e.environment,
    confianza: e.trust,
    aprobacion: e.approval,
    capacidad: e.adminCapacity,
    tipo: e.policyRate,
    brecha: (e.realIndex / e.potentialIndex - 1) * 100,
  };
}

const ISSUE_OF: Record<string, IssueId> = { salud: 'salud', educacion: 'educacion', seguridad: 'seguridad', infraestructura: 'infraestructura' };

/** Avanza la economía un mes y devuelve la descomposición de los cambios. */
export function stepEconomy(game: GameState, events: GameEvent[]): Contribution[] {
  const c = getCountry(game.country);
  const B = c.economy;
  const e = game.economy;
  const f = game.fiscal;
  const lv = f.levers;
  const m = monthsBetween(game.startDate, game.date);
  const rnd = stream(game.seed, 'ruido', m);
  const out: Contribution[] = [];
  const add = (indicator: string, kind: Contribution['kind'], label: string, value: number) => {
    if (Math.abs(value) > 1e-4) out.push({ indicator, kind, label, value });
  };
  const before = indicators(game);

  // 1. eventos
  let evGap = 0, evPrices = 0, evRate = 0, evApp = 0, evTrust = 0, evSpend = 0;
  const evServices: Record<string, number> = {};
  for (const ev of events) {
    evGap += ev.effect.gap ?? 0;
    evPrices += ev.effect.prices ?? 0;
    evRate += ev.effect.rate ?? 0;
    evApp += ev.effect.approval ?? 0;
    evTrust += ev.effect.trust ?? 0;
    evSpend += ev.effect.emergencySpend ?? 0;
    for (const [k, v] of Object.entries(ev.effect.services ?? {})) evServices[k] = (evServices[k] ?? 0) + v;
  }

  // 2. crecimiento potencial (efectos de largo plazo)
  const q = e.services;
  const potAdj =
    0.3 * ((q.infraestructura - 50) / 50) + 0.3 * ((q.educacion - 50) / 50) + 0.2 * ((e.trust - 50) / 50) + 0.1 * ((e.adminCapacity - 50) / 50) -
    0.4 * (taxFactor(c, lv, 'sociedades') - 1) - 0.3 * (taxFactor(c, lv, 'renta') - 1) - (c.id === 'us' ? 0.02 * ((lv.aranceles ?? 10) - 10) : 0);
  e.potentialIndex *= 1 + (B.potentialGrowth + potAdj) / 1200;

  // 3. impulso fiscal (con demoras)
  const potMonthReal = (B.nominalGDP * (e.potentialIndex / 100)) / 12;
  const eff = f.spendingNominal;
  let fiscalGap = 0;
  let prevFiscalGap = 0;
  for (const b of c.budget) {
    const real = (eff[b.id] ?? 0) / 12 / e.priceLevel;
    const neutral = (b.basePct / 100) * potMonthReal;
    const target = (real - neutral) / potMonthReal;
    const prev = e.impulses[b.id] ?? 0;
    const now = prev + (target - prev) / Math.max(1, b.lag);
    e.impulses[b.id] = now;
    const k = b.multiplier * B.openness;
    fiscalGap += k * now;
    prevFiscalGap += k * prev;
    add('actividad', 'decision', `Gasto en ${b.name.toLowerCase()}`, k * (now - prev) * 100);
  }
  for (const t of c.taxes) {
    if (t.basePct === 0) continue;
    const target = (taxFactor(c, lv, t.id) - 1) * (t.basePct / 100);
    const key = `tax-${t.id}`;
    const prev = e.impulses[key] ?? 0;
    const now = prev + (target - prev) / 4;
    e.impulses[key] = now;
    const k = t.multiplier * B.openness;
    fiscalGap += k * now;
    prevFiscalGap += k * prev;
    add('actividad', 'decision', `${t.name}`, k * (now - prev) * 100);
  }
  const regBase = c.regulations.find((r) => r.id === 'regulacion-ambiental')?.base ?? 50;
  {
    const target = -0.0004 * ((lv['regulacion-ambiental'] ?? regBase) - regBase);
    const prev = e.impulses.regulacion ?? 0;
    const now = prev + (target - prev) / 12;
    e.impulses.regulacion = now;
    fiscalGap += now;
    prevFiscalGap += prev;
    add('actividad', 'decision', 'Costes de adaptación a la regulación ambiental', (now - prev) * 100);
  }

  // 4. política monetaria (no la controla el jugador)
  if (B.monetary === 'propia') {
    const target = NEUTRAL_REAL_RATE[c.id] + before.inflacion + 0.5 * (before.inflacion - B.inflationTarget) + 0.5 * before.brecha;
    const step = Math.max(-0.25, Math.min(0.25, target - e.policyRate));
    e.policyRate = Math.max(0, Math.round((e.policyRate + step) * 100) / 100);
  }
  const realRate = e.policyRate - e.coreInflation;
  const monTarget = -0.004 * (realRate - NEUTRAL_REAL_RATE[c.id]) * (B.monetary === 'propia' ? 1 : 0.5);
  const monPrev = e.impulses.monetaria ?? 0;
  const monNow = monPrev + (monTarget - monPrev) / 6;
  e.impulses.monetaria = monNow;
  add('actividad', 'institucional', B.monetary === 'propia' ? 'Política monetaria del banco central (independiente)' : B.monetary === 'eurosistema' ? 'Tipos del BCE (factor externo)' : 'Tipos internacionales (economía dolarizada)', (monNow - monPrev) * 100);

  // 5. demanda privada
  const biz = game.groups.find((g) => g.id === 'empresas')?.mood ?? 0;
  const noiseGap = rnd.normal(0, 0.0012);
  const decay = -0.07 * e.privateShock;
  e.privateShock = e.privateShock + decay + evGap + noiseGap + 0.0003 * biz;
  add('actividad', 'tendencia', 'Disipación gradual de choques anteriores', decay * 100);
  add('actividad', 'evento', 'Eventos externos', evGap * 100);
  add('actividad', 'aleatorio', 'Variación aleatoria de la demanda privada', noiseGap * 100);
  add('actividad', 'decision', 'Confianza empresarial ante las políticas', 0.0003 * biz * 100);
  const gap = e.privateShock + fiscalGap + monNow;
  void prevFiscalGap;
  e.realIndex = e.potentialIndex * (1 + gap);
  e.realHistory.push(e.realIndex);
  if (e.realHistory.length > 13) e.realHistory.shift();

  // 6. inflación
  const mw = lv['salario-minimo'] ?? 100;
  const coreTarget = B.inflationTarget + 30 * gap + 0.01 * (mw - 100);
  const corePrev = e.coreInflation;
  e.coreInflation = 0.9 * corePrev + 0.1 * coreTarget;
  const infNoise = rnd.normal(0, 0.05);
  const level = e.shocks.prices * 0.35;
  e.shocks.prices -= level;
  const monthly = e.coreInflation / 12 + level + evPrices / 3 + infNoise;
  e.priceLevel *= 1 + monthly / 100;
  e.priceHistory.push(e.priceLevel);
  if (e.priceHistory.length > 13) e.priceHistory.shift();
  e.inflation = yoy(e.priceHistory);
  add('inflacion', 'decision', 'Impuestos indirectos y aranceles (traslado a precios)', level * 12);
  add('inflacion', 'evento', 'Precios internacionales', (evPrices / 3) * 12);
  add('inflacion', 'aleatorio', 'Variación aleatoria de precios', infNoise * 12);
  add('inflacion', 'tendencia', 'Inflación subyacente (presión de demanda y expectativas)', e.coreInflation - corePrev);

  // 7. desempleo
  const empImp = e.impulses.empleo ?? 0;
  const natTarget = B.naturalUnemployment - 100 * empImp + MIN_WAGE_U[c.id] * (mw - 100) + 2 * (taxFactor(c, lv, 'cotizaciones') - 1);
  const natPrev = e.naturalUnemployment;
  e.naturalUnemployment += (natTarget - natPrev) / 36;
  const uPrev = e.unemployment;
  const uTarget = e.naturalUnemployment - B.okun * gap * 100;
  const uNoise = rnd.normal(0, 0.03);
  e.unemployment = Math.max(1, uPrev + 0.25 * (uTarget - uPrev) + uNoise);
  add('desempleo', 'decision', 'Políticas de empleo, salario mínimo y cotizaciones (efecto estructural lento)', e.naturalUnemployment - natPrev);
  add('desempleo', 'tendencia', 'Ajuste al ciclo económico (ley de Okun)', 0.25 * (uTarget - uPrev) - (e.naturalUnemployment - natPrev));
  add('desempleo', 'aleatorio', 'Variación aleatoria', uNoise);

  // 8. servicios, capacidad administrativa y medioambiente
  const sw = SERVICE_WEIGHT[c.id];
  for (const k of SERVICES) {
    const b = c.budget.find((x) => x.service === k);
    if (!b) continue;
    const real = (eff[b.id] ?? 0) / 12 / e.priceLevel;
    const baseReal = (b.basePct / 100) * potMonthReal;
    const ratio = baseReal > 0 ? real / baseReal : 1;
    const maxStep = 0.004 + 0.012 * (e.adminCapacity / 100);
    const absPrev = e.absorbed[b.id] ?? 1;
    const absNow = ratio > absPrev ? Math.min(ratio, absPrev + maxStep) : ratio;
    e.absorbed[b.id] = absNow;
    const w = sw[k] ?? 1;
    const effRatio = Math.max(0.2, 1 + w * (absNow - 1));
    const target = 50 + 35 * Math.log(effRatio);
    const before = q[k];
    q[k] = Math.max(0, Math.min(100, q[k] + (target - q[k]) / TAU[k] + (evServices[k] ?? 0)));
    add(k, 'decision', 'Gasto efectivamente ejecutado (con demoras)', (target - before) / TAU[k]);
    if (evServices[k]) add(k, 'evento', 'Daños por eventos', evServices[k]);
    if (absNow < ratio - 0.005) add(k, 'institucional', 'Límite de capacidad administrativa (parte del aumento aún no se ejecuta)', 0);
  }
  for (const b of c.budget) if (!b.service) {
    const real = (eff[b.id] ?? 0) / 12 / e.priceLevel;
    const baseReal = (b.basePct / 100) * potMonthReal;
    e.absorbed[b.id] = baseReal > 0 ? real / baseReal : 1;
  }
  const adm = c.budget.find((b) => b.id === 'administracion');
  const admRatio = adm ? e.absorbed[adm.id] ?? 1 : 1;
  const admTarget = 50 + 25 * Math.log(Math.max(0.3, admRatio)) + 0.15 * (e.trust - 50);
  e.adminCapacity += (admTarget - e.adminCapacity) / 24;
  const envRatio = e.absorbed.medioambiente ?? 1;
  const envTarget = 50 + 0.5 * ((lv['regulacion-ambiental'] ?? regBase) - regBase) + 20 * Math.log(Math.max(0.3, envRatio)) - 150 * Math.max(0, gap);
  const envPrev = e.environment;
  e.environment += (envTarget - envPrev) / 36;
  add('medioambiente', 'decision', 'Regulación y gasto ambiental (efecto lento)', e.environment - envPrev);

  // 9. cuentas públicas (coherencia: déficit = gasto + intereses − ingresos; deuda += déficit)
  const nomMonth = (B.nominalGDP * (e.realIndex / 100) * e.priceLevel) / 12;
  const compliance = 1 + (e.adminCapacity - 50) / 500;
  let rev = (otherRevenuePct(c) / 100) * nomMonth;
  for (const t of c.taxes) {
    let fct = taxFactor(c, lv, t.id);
    if (t.id === 'aranceles') fct *= Math.max(0.3, 1 - 0.01 * ((lv.aranceles ?? t.base) - t.base));
    rev += (t.basePct / 100) * fct * nomMonth * (1 + gap) * compliance;
  }
  const stabilizers = ((0.1 * (e.unemployment - B.unemployment)) / 100) * nomMonth;
  const emergency = (evSpend / 100) * nomMonth * 12;
  const spend = Object.values(eff).reduce((a, b) => a + b, 0) / 12 + stabilizers + emergency;
  const interest = (e.effectiveDebtRate / 100) * e.debt / 12;
  const deficit = spend + interest - rev;
  e.debt += deficit;
  e.flows.rev.push(rev);
  e.flows.spend.push(spend);
  e.flows.int.push(interest);
  e.flows.gdp.push(nomMonth);
  for (const k of ['rev', 'spend', 'int', 'gdp'] as const) if (e.flows[k].length > 12) e.flows[k].shift();
  e.shocks.rate = e.shocks.rate * 0.97 + evRate;
  const mid = indicators(game);
  const market = B.marketRate + 0.05 * Math.max(0, mid.deuda - B.riskThreshold) + 0.15 * Math.max(0, mid.deficit - 3) + (50 - e.trust) * 0.01 + e.shocks.rate + 0.7 * (e.policyRate - B.policyRate);
  e.effectiveDebtRate += (market - e.effectiveDebtRate) / 72;
  add('deuda', 'tendencia', 'Déficit del mes (gasto + intereses − ingresos)', (deficit / sum(e.flows.gdp)) * 100);
  if (emergency > 0) add('deuda', 'evento', 'Gasto de emergencia por eventos', (emergency / sum(e.flows.gdp)) * 100);
  add('deuda', 'tendencia', 'Efecto del crecimiento del PIB nominal sobre la ratio', mid.deuda - before.deuda - (deficit / sum(e.flows.gdp)) * 100);

  // 10. pobreza
  const protImp = e.impulses.proteccion ?? 0;
  const povTarget = B.poverty + 0.6 * (e.unemployment - B.unemployment) - 200 * protImp + 0.25 * Math.max(0, mid.inflacion - 3) - 0.03 * (mw - 100);
  const povPrev = e.poverty;
  e.poverty = Math.max(1, povPrev + (povTarget - povPrev) / 12);
  add('pobreza', 'decision', 'Transferencias, empleo, precios y salario mínimo', e.poverty - povPrev);

  // 11. confianza institucional
  e.shocks.trust = e.shocks.trust * 0.97 + evTrust;
  const trustTarget = 50 + 0.15 * (mid.servicios - 50) + 0.1 * (e.adminCapacity - 50) + e.shocks.trust;
  const trustPrev = e.trust;
  e.trust = Math.max(0, Math.min(100, trustPrev + (trustTarget - trustPrev) / 12));
  add('confianza', 'evento', 'Eventos y escándalos', evTrust / 12);
  add('confianza', 'tendencia', 'Servicios públicos y capacidad administrativa', e.trust - trustPrev - evTrust / 12);

  // 12. aprobación por segmentos (electores heterogéneos)
  e.shocks.approval = e.shocks.approval * 0.85 + evApp;
  const mix = segmentMix(c.id, 0.75);
  const since = game.government.since ? monthsBetween(game.government.since, game.date) : 99;
  const honey = 8 * Math.pow(0.5, since / 6);
  const avgTax = (taxFactor(c, lv, 'renta') + taxFactor(c, lv, 'consumo') + taxFactor(c, lv, 'cotizaciones')) / 3;
  let target = 0;
  let econPart = 0, servPart = 0, alignPart = 0, taxPart = 0;
  const ctr = segmentCenter(c.id);
  for (const s of SEGMENTS) {
    const econ = -3 * (e.unemployment - B.unemployment) - 2 * Math.max(0, mid.inflacion - 2.5) * (1 + (s.priorities['costo-vida'] ?? 0));
    let serv = 0;
    for (const k of SERVICES) serv += (s.priorities[ISSUE_OF[k]] ?? 0) * (q[k] - 50) * 1.2;
    const tax = -(s.priorities.impuestos ?? 0) * (avgTax - 1) * 40;
    const se = s.econ - ctr.econ, ss = s.social - ctr.social;
    const d1 = (se - game.policy.econ) ** 2 + (ss - game.policy.social) ** 2;
    const d0 = se ** 2 + ss ** 2;
    const align = -12 * (d1 - d0);
    const sat = Math.max(0, Math.min(100, 50 + econ + serv + tax + align + honey + e.shocks.approval));
    e.segmentApproval[s.id] = sat;
    const w = mix[s.id] ?? 0;
    target += w * sat;
    econPart += w * econ;
    servPart += w * serv;
    alignPart += w * align;
    taxPart += w * tax;
  }
  const appPrev = e.approval;
  const appNoise = rnd.normal(0, 0.6);
  e.approval = Math.max(3, Math.min(97, appPrev + 0.3 * (target - appPrev) + appNoise));
  const moved = e.approval - appPrev - appNoise;
  const parts = [
    ['tendencia', 'Situación económica (empleo y precios)', econPart],
    ['decision', 'Calidad de los servicios públicos', servPart],
    ['decision', 'Orientación de las políticas frente a las preferencias de cada grupo', alignPart],
    ['decision', 'Carga tributaria percibida', taxPart],
    ['institucional', 'Efecto "luna de miel" del nuevo gobierno', honey],
    ['evento', 'Eventos y escándalos', e.shocks.approval],
  ] as const;
  const totalAbs = parts.reduce((a, p) => a + Math.abs(p[2]), 0) || 1;
  for (const [kind, label, v] of parts) add('aprobacion', kind, label, (moved * Math.abs(v)) / totalAbs * Math.sign(v || 1));
  add('aprobacion', 'aleatorio', 'Variación aleatoria de la opinión pública', appNoise);

  // 13. organizaciones: estado de ánimo según políticas vigentes
  for (const g of game.groups) {
    let s = 0;
    for (const [k, dir] of Object.entries(g.prefs)) {
      const t = c.taxes.find((x) => x.id === k);
      const r = c.regulations.find((x) => x.id === k);
      const b = c.budget.find((x) => x.id === k);
      let rel = 0;
      if (t && t.base) rel = ((lv[k] ?? t.base) - t.base) / t.base;
      else if (r && r.base) rel = ((lv[k] ?? r.base) - r.base) / r.base;
      else if (b) rel = (e.absorbed[b.id] ?? 1) - 1;
      else if (k === 'instituciones') rel = (e.trust - 50) / 50;
      s += dir * rel * 4;
    }
    g.mood = Math.tanh(s);
  }
  return out;
}
