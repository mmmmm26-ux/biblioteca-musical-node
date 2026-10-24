import type { IssueId, Segment } from '../engine/types';

// Segmentos del electorado. Son PARÁMETROS DEL JUEGO (capa C), no mediciones.
// Cada segmento tiene una dispersión amplia: dentro de un mismo grupo hay votantes de todo el espectro.
// Las posiciones medias son moderadas y aproximadamente simétricas para no dar ventaja a ninguna ideología.

export const SEGMENTS: Segment[] = [
  { id: 'jovenes', name: 'Jóvenes urbanos', desc: 'Menores de 30 años en ciudades: estudiantes y primeros empleos.', econ: -0.15, social: -0.35, spread: 0.5, turnout: 0.52,
    priorities: { empleo: 0.3, 'costo-vida': 0.25, medioambiente: 0.2, educacion: 0.15, instituciones: 0.1 } },
  { id: 'asalariados', name: 'Trabajadores asalariados', desc: 'Empleo formal en industria y servicios.', econ: -0.22, social: 0.05, spread: 0.45, turnout: 0.63,
    priorities: { empleo: 0.3, 'costo-vida': 0.3, salud: 0.15, seguridad: 0.15, impuestos: 0.1 } },
  { id: 'profesionales', name: 'Clase media profesional', desc: 'Técnicos y profesionales con estudios superiores.', econ: 0.1, social: -0.18, spread: 0.45, turnout: 0.75,
    priorities: { impuestos: 0.2, educacion: 0.2, salud: 0.15, instituciones: 0.2, 'costo-vida': 0.15, infraestructura: 0.1 } },
  { id: 'empresarios', name: 'Pequeños empresarios y autónomos', desc: 'Comercios, talleres y trabajadores por cuenta propia.', econ: 0.38, social: 0.12, spread: 0.42, turnout: 0.72,
    priorities: { impuestos: 0.35, empleo: 0.2, seguridad: 0.15, infraestructura: 0.15, instituciones: 0.15 } },
  { id: 'rural', name: 'Población rural', desc: 'Agricultura, pueblos y ciudades pequeñas.', econ: 0.02, social: 0.32, spread: 0.45, turnout: 0.62,
    priorities: { infraestructura: 0.25, salud: 0.2, seguridad: 0.2, 'costo-vida': 0.2, empleo: 0.15 } },
  { id: 'jubilados', name: 'Personas jubiladas', desc: 'Mayores de 65 años.', econ: -0.12, social: 0.25, spread: 0.45, turnout: 0.8,
    priorities: { salud: 0.35, 'costo-vida': 0.3, seguridad: 0.2, instituciones: 0.15 } },
  { id: 'precarios', name: 'Trabajo informal o precario', desc: 'Empleo temporal, informal o sin protección social.', econ: -0.33, social: 0.12, spread: 0.5, turnout: 0.46,
    priorities: { empleo: 0.35, 'costo-vida': 0.3, seguridad: 0.2, salud: 0.15 } },
];

export const ISSUES: Record<IssueId, { name: string; desc: string }> = {
  empleo: { name: 'Empleo', desc: 'Crear trabajo y mejorar salarios.' },
  'costo-vida': { name: 'Costo de vida', desc: 'Precios, inflación y poder adquisitivo.' },
  salud: { name: 'Salud', desc: 'Acceso y calidad de la atención sanitaria.' },
  educacion: { name: 'Educación', desc: 'Escuelas, universidades y formación.' },
  seguridad: { name: 'Seguridad', desc: 'Delito, policía y justicia.' },
  impuestos: { name: 'Impuestos', desc: 'Carga tributaria y uso del dinero público.' },
  medioambiente: { name: 'Medioambiente', desc: 'Clima, contaminación y recursos naturales.' },
  instituciones: { name: 'Instituciones', desc: 'Transparencia, corrupción y equilibrio de poderes.' },
  infraestructura: { name: 'Infraestructura', desc: 'Carreteras, agua, energía y transporte.' },
};

/** Composición del electorado por país (pesos base, parámetro de juego). */
export const COUNTRY_MIX: Record<string, Record<string, number>> = {
  sv: { jovenes: 0.16, asalariados: 0.18, profesionales: 0.1, empresarios: 0.12, rural: 0.16, jubilados: 0.08, precarios: 0.2 },
  us: { jovenes: 0.14, asalariados: 0.22, profesionales: 0.2, empresarios: 0.12, rural: 0.1, jubilados: 0.17, precarios: 0.05 },
  es: { jovenes: 0.12, asalariados: 0.22, profesionales: 0.17, empresarios: 0.11, rural: 0.08, jubilados: 0.22, precarios: 0.08 },
};

/** Ajusta la composición según el grado de urbanización del territorio. */
export function segmentMix(country: string, urban: number): Record<string, number> {
  const base = COUNTRY_MIX[country];
  const mod: Record<string, number> = {
    jovenes: 0.6 + urban * 0.8,
    profesionales: 0.5 + urban,
    rural: Math.max(0.05, 1.9 - urban * 2),
  };
  const out: Record<string, number> = {};
  let tot = 0;
  for (const [k, w] of Object.entries(base)) {
    out[k] = w * (mod[k] ?? 1);
    tot += out[k];
  }
  for (const k of Object.keys(out)) out[k] /= tot;
  return out;
}
