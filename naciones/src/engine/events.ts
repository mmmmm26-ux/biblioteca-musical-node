import { monthsBetween } from './calendar';
import { stream } from './rng';
import type { CountryId, GameState } from './types';

// Eventos. Las probabilidades y magnitudes son PARÁMETROS DEL JUEGO (capa C), no estimaciones científicas.
// Los eventos externos dependen SOLO de la semilla y del mes: dos ramas de la misma partida los comparten.

export interface EventEffect {
  gap?: number; // choque a la actividad (fracción del PIB)
  prices?: number; // choque al nivel de precios (%)
  rate?: number; // choque a tipos de mercado (pp)
  approval?: number; // puntos
  trust?: number; // puntos
  services?: Record<string, number>; // puntos de índice
  emergencySpend?: number; // gasto extraordinario (% del PIB anual, una vez)
}

export interface GameEvent {
  id: string;
  kind: 'externo' | 'endogeno';
  title: string;
  detail: string;
  effect: EventEffect;
}

interface ExternalDef {
  id: string;
  title: string;
  detail: string;
  p: Partial<Record<CountryId, number>> & { base: number };
  effect: (c: CountryId) => EventEffect;
}

const EXTERNAL: ExternalDef[] = [
  { id: 'recesion-global', title: 'Desaceleración de la economía mundial', detail: 'Cae la demanda de los principales socios comerciales.', p: { base: 0.012 }, effect: (c) => ({ gap: c === 'us' ? -0.012 : -0.016 }) },
  { id: 'auge-global', title: 'Repunte del comercio mundial', detail: 'Mejora la demanda exterior.', p: { base: 0.012 }, effect: () => ({ gap: 0.007 }) },
  { id: 'petroleo-alza', title: 'Sube el precio internacional del petróleo', detail: 'Encarece el transporte y la energía.', p: { base: 0.02 }, effect: (c) => ({ prices: c === 'sv' ? 1.2 : 0.8, gap: -0.003 }) },
  { id: 'petroleo-baja', title: 'Baja el precio internacional del petróleo', detail: 'Abarata la energía importada.', p: { base: 0.015 }, effect: (c) => ({ prices: c === 'sv' ? -0.8 : -0.5, gap: 0.002 }) },
  { id: 'tipos-globales', title: 'Endurecimiento financiero internacional', detail: 'Suben los tipos de interés exigidos a los Estados.', p: { base: 0.01 }, effect: (c) => ({ rate: c === 'sv' ? 1.2 : c === 'es' ? 0.6 : 0.4 }) },
  { id: 'desastre', title: 'Desastre natural', detail: 'Tormentas, inundaciones o un sismo dañan infraestructura y viviendas.', p: { base: 0.01, sv: 0.02 }, effect: (c) => ({ gap: c === 'us' ? -0.002 : -0.006, services: { infraestructura: -5, salud: -1 }, emergencySpend: c === 'us' ? 0.1 : 0.3, approval: 0 }) },
  { id: 'remesas', title: 'Caen las remesas', detail: 'Empeora el empleo de la diáspora y llegan menos remesas.', p: { base: 0, sv: 0.015 }, effect: () => ({ gap: -0.008 }) },
  { id: 'epidemia', title: 'Brote epidémico', detail: 'Aumenta la presión sobre los servicios de salud.', p: { base: 0.002 }, effect: () => ({ gap: -0.01, services: { salud: -6 }, emergencySpend: 0.4 }) },
];

export function externalEvents(seed: string, country: CountryId, start: string, date: string): GameEvent[] {
  const m = monthsBetween(start, date);
  const r = stream(seed, 'eventos', m);
  const out: GameEvent[] = [];
  for (const d of EXTERNAL) {
    const p = d.p[country] ?? d.p.base;
    if (r.next() < p) out.push({ id: `${d.id}-${m}`, kind: 'externo', title: d.title, detail: d.detail, effect: d.effect(country) });
  }
  return out;
}

export function endogenousEvents(game: GameState): GameEvent[] {
  const m = monthsBetween(game.startDate, game.date);
  const r = stream(game.seed, 'endogeno', m);
  const out: GameEvent[] = [];
  const g = Object.fromEntries(game.groups.map((x) => [x.id, x]));
  const e = game.economy;
  if (g.sindicatos && g.sindicatos.mood < -0.45 && r.chance(0.22))
    out.push({ id: `huelga-${m}`, kind: 'endogeno', title: `${g.sindicatos.name} convoca una huelga general`, detail: 'Protesta contra las políticas económicas y laborales vigentes.', effect: { gap: -0.002, approval: -1.5, trust: -0.5 } });
  if (g.empresas && g.empresas.mood < -0.45 && r.chance(0.25))
    out.push({ id: `inversion-${m}`, kind: 'endogeno', title: `${g.empresas.name} anuncia recortes de inversión`, detail: 'Las empresas posponen proyectos por el entorno de políticas.', effect: { gap: -0.003 } });
  if (g.empresas && g.empresas.mood > 0.45 && r.chance(0.2))
    out.push({ id: `inversion-mas-${m}`, kind: 'endogeno', title: `${g.empresas.name} anuncia nuevas inversiones`, detail: 'Las empresas perciben un entorno favorable.', effect: { gap: 0.002 } });
  if (((g.civil && g.civil.mood < -0.45) || e.trust < 35) && r.chance(0.18))
    out.push({ id: `protesta-${m}`, kind: 'endogeno', title: 'Movilizaciones ciudadanas', detail: 'Organizaciones civiles protestan por los servicios públicos o la calidad institucional.', effect: { approval: -1.5, trust: -1 } });
  const pScandal = 0.006 + 0.02 * Math.max(0, (50 - e.adminCapacity) / 50);
  if (game.government.executiveParty && r.chance(pScandal))
    out.push({ id: `escandalo-${m}`, kind: 'endogeno', title: 'Escándalo en la administración', detail: 'Un alto cargo ficticio es investigado por irregularidades en contratos. (Hecho ficticio generado por el juego.)', effect: { approval: -4, trust: -2.5 } });
  return out;
}
