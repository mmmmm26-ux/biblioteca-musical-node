import type { InterestGroup } from '../../engine/types';

// Organizaciones ficticias con objetivos distintos. Sus preferencias son parámetros del juego (capa C).
// Signo: +1 prefieren que la palanca/categoría suba, -1 que baje.
export function makeGroups(business: string, unions: string, civil: string): InterestGroup[] {
  return [
    { id: 'empresas', name: business, kind: 'empresas', mood: 0, prefs: { sociedades: -1, renta: -0.5, cotizaciones: -0.8, 'salario-minimo': -0.7, 'regulacion-ambiental': -0.5, infraestructura: 1, aranceles: -0.3 } },
    { id: 'sindicatos', name: unions, kind: 'sindicatos', mood: 0, prefs: { 'salario-minimo': 1, proteccion: 0.8, empleo: 0.8, salud: 0.4, consumo: -0.5, administracion: 0.3 } },
    { id: 'civil', name: civil, kind: 'civil', mood: 0, prefs: { medioambiente: 0.8, 'regulacion-ambiental': 0.8, salud: 0.5, educacion: 0.7, instituciones: 1 } },
  ];
}
