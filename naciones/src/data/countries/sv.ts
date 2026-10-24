import type { CountryModule, ReformRouting } from '../../engine/country';
import type { GameState, RuleValue, ScheduledElection } from '../../engine/types';
import { addDays, cmp, lastSunday, year } from '../../engine/calendar';
import { num, ruleAt } from '../../engine/legal/rules';
import { makeGroups } from './groups';
import { rule } from './helpers';

// EL SALVADOR — República presidencial y unitaria. Asamblea Legislativa unicameral.
// Versión de reglas: 2026-10-23. Ver docs/FUENTES.md.

const REFORM_ROUTES = [
  { id: 'misma', label: 'Misma legislatura: acuerdo (31) y ratificación con 3/4 (45)', procedureId: 'sv.reforma.misma' },
  { id: 'dos', label: 'Dos legislaturas: acuerdo (31) y ratificación por la siguiente Asamblea con 2/3 (40)', procedureId: 'sv.reforma.dos' },
];

function constitutional(game: GameState, ruleId: string, value: RuleValue, extraNotes: string[] = []): ReformRouting {
  const same = ruleAt(game, ruleId).value === value;
  return {
    allowed: !same,
    normType: 'constitucion',
    procedureId: 'sv.reforma.misma',
    routes: REFORM_ROUTES,
    blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
    notes: [
      'Requiere reforma constitucional (art. 248). La iniciativa corresponde a diputados; el Presidente no puede presentarla directamente.',
      'No interviene la Presidencia con sanción ni veto en la reforma constitucional (simplificación habitual; pendiente de cotejo).',
      ...extraNotes,
    ],
    initiators: 'Diputados de la Asamblea Legislativa (mínimo 10 según art. 248; pendiente de cotejo)',
    ruleIds: ['sv.reforma.iniciativa', 'sv.reforma.acuerdo', 'sv.reforma.ratificacion', 'sv.reforma.petreas'],
  };
}

function ordinaryLaw(game: GameState, ruleId: string, value: RuleValue, notes: string[] = []): ReformRouting {
  const same = ruleAt(game, ruleId).value === value;
  return {
    allowed: !same,
    normType: 'ley-ordinaria',
    procedureId: 'sv.ley',
    blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
    notes: ['Se modifica el Código Electoral (ley secundaria): basta la mayoría de 31 votos y la sanción presidencial, que puede vetar.', ...notes],
    initiators: 'Diputados o el Presidente por medio de sus ministros (art. 133)',
    ruleIds: ['sv.ley.mayoria', 'sv.veto'],
  };
}

const sv: CountryModule = {
  id: 'sv',
  name: 'El Salvador',
  officialName: 'República de El Salvador',
  status: 'completo',
  system: {
    executive: 'presidencial',
    territorial: 'unitario',
    label: 'República presidencial unitaria',
    summary:
      'El Presidente es jefe de Estado y de Gobierno y se elige por voto directo. La Asamblea Legislativa (unicameral, 60 diputados) aprueba leyes y presupuesto. El Estado es unitario: los 14 departamentos no tienen gobiernos propios con competencias legislativas.',
  },
  rulesetVersion: '2026-10-23',
  territoryLabel: 'Circunscripciones',
  sources: [
    { id: 'sv-const', title: 'Constitución de la República de El Salvador (1983), texto con reformas', publisher: 'Asamblea Legislativa de El Salvador', url: 'https://www.asamblea.gob.sv/', kind: 'constitucion', published: '1983-12-16', inForce: '1983-12-20', note: 'Decreto Constituyente n.º 38. El texto oficial no pudo descargarse desde el entorno de desarrollo; los artículos marcados «pendiente de cotejo» deben verificarse en el portal oficial.' },
    { id: 'sv-ref2025', title: 'Reforma de los arts. 75, 80, 133, 152 y 154 y disposición transitoria (acordada y ratificada el 31 de julio de 2025)', publisher: 'Asamblea Legislativa — nota oficial', url: 'https://www.asamblea.gob.sv/node/13645', kind: 'reforma', note: 'Aprobada con 57 de 60 votos. La fecha exacta de publicación en el Diario Oficial no se cotejó.' },
    { id: 'sv-ref248', title: 'Reforma del art. 248 (acordada el 29-abr-2024, ratificada el 29-ene-2025)', publisher: 'Diario Oficial (reportado por Diario El Mundo)', url: 'https://diario.elmundo.sv/politica/vigente-reforma-constitucional-que-agiliza-reformas-a-la-constitucion', kind: 'reforma', published: '2025-01-29', inForce: '2025-02-06' },
    { id: 'sv-ref79', title: 'Reforma del art. 79: circunscripción de salvadoreños en el exterior (ratificada el 7-may-2026)', publisher: 'Asamblea Legislativa', url: 'https://www.asamblea.gob.sv/node/13956', kind: 'reforma', note: 'Ratificada con 57 votos según reportes de prensa.' },
    { id: 'sv-ce2026', title: 'Código Electoral, art. 13 (reforma publicada en el Diario Oficial el 15-may-2026; vigente desde el 23-may-2026)', publisher: 'Reportado por Infobae; autoridad: Tribunal Supremo Electoral', url: 'https://www.infobae.com/el-salvador/2026/05/29/el-salvador-vigente-la-reforma-que-resta-cinco-diputados-a-san-salvador-y-dos-a-la-libertad-para-otorgarlos-a-la-diaspora/', kind: 'secundaria', published: '2026-05-15', inForce: '2026-05-23' },
    { id: 'sv-ce2023', title: 'Código Electoral, arts. 13 y 217 (reforma de 2023: 60 diputados y método D’Hondt)', publisher: 'Diario El Mundo; estudio de IDEA Internacional', url: 'https://www.idea.int/sites/default/files/2023-07-07-estudio-constitucional-de-las-reformas-electorales-en-el-salvador.pdf', kind: 'secundaria', note: 'Reforma de junio de 2023 (fecha exacta de publicación en el Diario Oficial no cotejada). Aplicada por primera vez en las elecciones de 2024.' },
    { id: 'sv-tse', title: 'Calendario electoral 2027 (elecciones el 28-feb-2027)', publisher: 'Tribunal Supremo Electoral (reportado por Diario El Mundo)', url: 'https://diario.elmundo.sv/politica/el-salvador-a-un-ano-de-las-proximas-elecciones-generales-tras-reforma-constitucional', kind: 'secundaria' },
    { id: 'sv-ref208', title: 'Reforma de los arts. 79 y 208 (integración del TSE), ratificada el 7-may-2026', publisher: 'Prensa Latina', url: 'https://www.prensa-latina.cu/2026/05/07/asamblea-de-el-salvador-ratifica-dos-reformas-constitucionales/', kind: 'secundaria' },
    { id: 'sv-dl333', title: 'Decreto Legislativo de régimen de excepción (2022), considerandos sobre arts. 29, 30 y 131 ord. 27', publisher: 'Corte Suprema de Justicia — Centro de Documentación Judicial', url: 'https://www.jurisprudencia.gob.sv/DocumentosBoveda/D/2/2020-2029/2022/03/EE856.PDF', kind: 'decreto', published: '2022-03-27' },
    { id: 'sv-veto', title: 'Texto del art. 137 y su reforma de 1997 (Decreto 873)', publisher: 'Corte Suprema de Justicia — Centro de Documentación Judicial', url: 'https://www.jurisprudencia.gob.sv/DocumentosBoveda/R/2/1980-1989/1983/12/8E1E6.HTML', kind: 'constitucion' },
    { id: 'sv-ct', title: 'Código de Trabajo (fijación del salario mínimo)', publisher: 'Asamblea Legislativa', url: 'https://www.asamblea.gob.sv/', kind: 'ley' },
    { id: 'sv-lim', title: 'Ley de Integración Monetaria (2001)', publisher: 'Asamblea Legislativa', url: 'https://www.asamblea.gob.sv/', kind: 'ley', inForce: '2001-01-01' },
    { id: 'sv-bcr', title: 'PIB nominal 2025 (BCR) y crecimiento (FMI)', publisher: 'Reportado por Infobae', url: 'https://www.infobae.com/el-salvador/2026/06/01/nayib-bukele-llega-a-su-segundo-ano-de-gestion-con-crecimiento-economico-mejora-en-inversion-y-reservas-pero-con-retos-fiscales/', kind: 'estadistica' },
    { id: 'sv-moodys', title: 'Deuda pública 2025 (88,3 % del PIB, Moody’s)', publisher: 'Diario El Mundo', url: 'https://diario.elmundo.sv/economia/moodys-preve-mayor-crecimiento-economico-pero-advierte-alto-peso-de-deuda-e-intereses-en-el-salvador', kind: 'estadistica' },
    { id: 'sv-cepal', title: 'Balance preliminar de las economías de América Latina y el Caribe (déficit SPNF con pensiones 2025)', publisher: 'CEPAL', url: 'https://repositorio.cepal.org/', kind: 'estadistica' },
    { id: 'sv-onec', title: 'Censo 2024 y Encuesta de Hogares de Propósitos Múltiples', publisher: 'Oficina Nacional de Estadística y Censos (BCR)', url: 'https://onec.bcr.gob.sv/', kind: 'estadistica', note: 'Poblaciones por departamento usadas como pesos aproximados.' },
  ],
  rules: [
    rule('sv.forma-gobierno', 'ejecutivo', 'Forma y sistema de gobierno', 'El Salvador es una república con gobierno republicano, democrático y representativo y un sistema presidencial: el Presidente no depende de la confianza de la Asamblea.', 'presidencial', 'constitucion', 'sv-const', 'Arts. 83, 85 y 86', 'por-cotejar'),
    rule('sv.presidente.mandato', 'ejecutivo', 'Duración del mandato presidencial', 'El período presidencial dura seis años (antes eran cinco).', 6, 'constitucion', 'sv-ref2025', 'Art. 154 (reforma de 2025)', 'contrastada', { verificationNote: 'Confirmado por la nota oficial de la Asamblea y varias fuentes de prensa.' }),
    rule('sv.presidente.transitoria', 'ejecutivo', 'Disposición transitoria de 2025', 'El período iniciado el 1-jun-2024 termina anticipadamente el 1-jun-2027 para unificar las elecciones en 2027.', '2027-06-01', 'constitucion', 'sv-ref2025', 'Disposición transitoria', 'contrastada'),
    rule('sv.presidente.metodo', 'electoral', 'Método de elección presidencial', 'Gana la candidatura con más votos (mayoría relativa). La reforma de 2025 eliminó la segunda vuelta.', 'relativa', 'constitucion', 'sv-ref2025', 'Art. 80 (reforma de 2025)', 'contrastada'),
    rule('sv.presidente.reeleccion', 'ejecutivo', 'Reelección presidencial', 'Tras la reforma de 2025 no se prohíbe la reelección presidencial (se suprimió el impedimento del art. 152).', 'permitida', 'constitucion', 'sv-ref2025', 'Arts. 75 y 152 (reforma de 2025)', 'contrastada', {
      controversy: 'El art. 248 declara irreformables los artículos sobre la alternabilidad en el ejercicio de la Presidencia. Partidos de oposición y organizaciones de derechos humanos consideran la reforma inconstitucional. El juego no resuelve esa controversia.',
    }),
    rule('sv.presidente.requisitos', 'ejecutivo', 'Requisitos para ser Presidente', 'Ser salvadoreño por nacimiento, hijo de padre o madre salvadoreño, mayor de 30 años, de moralidad e instrucción notorias, con derechos de ciudadano en los seis años anteriores y afiliado a un partido político.', 'texto', 'constitucion', 'sv-const', 'Art. 151', 'por-cotejar'),
    rule('sv.presidente.inicio', 'ejecutivo', 'Inicio del mandato presidencial', 'El mandato comienza el 1 de junio.', '06-01', 'constitucion', 'sv-const', 'Art. 154', 'por-cotejar'),
    rule('sv.asamblea.diputados', 'legislativo', 'Número de diputados', 'La Asamblea Legislativa tiene 60 diputados (eran 84 hasta la reforma de 2023).', 60, 'ley-ordinaria', 'sv-ce2023', 'Código Electoral, art. 13', 'contrastada'),
    rule('sv.asamblea.reparto', 'electoral', 'Diputados por circunscripción (elección de 2027)', 'Hay una circunscripción por departamento (mínimo dos diputados) y, desde 2026, una circunscripción en el exterior con 6 diputados, que se restaron a San Salvador (16→11) y La Libertad (7→6).',
      { 'sv-ss': 11, 'sv-ll': 6, 'sv-ext': 6, 'sv-sa': 5, 'sv-sm': 5, 'sv-so': 5, 'sv-us': 4, 'sv-ah': 3, 'sv-lp': 3, 'sv-ch': 2, 'sv-cu': 2, 'sv-ca': 2, 'sv-sv': 2, 'sv-mo': 2, 'sv-lu': 2 },
      'ley-ordinaria', 'sv-ce2026', 'Código Electoral, art. 13 (reforma de 2026)', 'contrastada', { published: '2026-05-15', inForce: '2026-05-23', verificationNote: 'Reparto de los seis escaños del exterior confirmado en varias fuentes de prensa; detalles finos pendientes de cotejo con el Diario Oficial.' }),
    rule('sv.asamblea.formula', 'electoral', 'Fórmula de asignación de escaños', 'En cada circunscripción los escaños se reparten con el método D’Hondt (cocientes sucesivos), que tiende a favorecer a los partidos grandes frente al sistema anterior de cociente y restos.', 'dhondt', 'ley-ordinaria', 'sv-ce2023', 'Código Electoral, art. 217', 'contrastada'),
    rule('sv.circunscripcion.exterior', 'electoral', 'Circunscripción en el exterior', 'Los salvadoreños residentes en el exterior eligen diputados propios.', true, 'constitucion', 'sv-ref79', 'Art. 79 (reforma de 2026)', 'contrastada'),
    rule('sv.asamblea.mandato', 'legislativo', 'Duración del mandato de los diputados', 'Los diputados se eligen por tres años y pueden ser reelegidos.', 3, 'constitucion', 'sv-const', 'Art. 124', 'contrastada', { verificationNote: 'Confirmado con fuente secundaria; artículo pendiente de cotejo literal.' }),
    rule('sv.asamblea.inicio', 'legislativo', 'Inicio de la legislatura', 'La nueva Asamblea se instala el 1 de mayo.', '05-01', 'constitucion', 'sv-const', 'Art. 124', 'por-cotejar'),
    rule('sv.ley.mayoria', 'legislativo', 'Mayoría para aprobar leyes', 'Las leyes se aprueban con al menos la mitad más uno de los diputados electos: 31 de 60.', 'absoluta', 'constitucion', 'sv-const', 'Art. 123', 'por-cotejar'),
    rule('sv.iniciativa', 'legislativo', 'Iniciativa de ley', 'Pueden proponer leyes los diputados, el Presidente por medio de sus ministros, la Corte Suprema (en materias judiciales) y los concejos municipales (en impuestos municipales).', 'texto', 'constitucion', 'sv-ref2025', 'Art. 133', 'por-cotejar', { verificationNote: 'El art. 133 fue modificado en la reforma de julio de 2025; el contenido exacto del cambio no se cotejó.' }),
    rule('sv.veto', 'legislativo', 'Veto presidencial', 'El Presidente tiene 8 días hábiles para sancionar o vetar. La Asamblea puede superar el veto con 2/3 de los diputados electos (40 de 60).', 8, 'constitucion', 'sv-veto', 'Art. 137', 'contrastada'),
    rule('sv.veto.inconstitucionalidad', 'judicial', 'Veto por inconstitucionalidad', 'Si el Presidente veta por considerar inconstitucional un proyecto y la Asamblea lo ratifica, decide la Corte Suprema de Justicia; si lo declara constitucional, el Presidente debe sancionarlo.', 'corte', 'constitucion', 'sv-veto', 'Art. 138', 'contrastada', { verificationNote: 'El juego no modela todavía esta vía: todos los vetos se tratan como vetos por razones de conveniencia (simplificación).' }),
    rule('sv.vigencia', 'legislativo', 'Entrada en vigor de las leyes', 'Una ley permanente obliga al menos ocho días después de su publicación en el Diario Oficial, salvo que fije otro plazo mayor.', 8, 'constitucion', 'sv-const', 'Art. 140', 'por-cotejar'),
    rule('sv.presupuesto', 'presupuesto', 'Procedimiento presupuestario', 'El Consejo de Ministros elabora el proyecto de presupuesto y lo presenta a la Asamblea al menos tres meses antes del inicio del ejercicio; la Asamblea lo decreta.', 'texto', 'constitucion', 'sv-const', 'Arts. 131 ord. 8, 167 ord. 3 y 227', 'por-cotejar'),
    rule('sv.presupuesto.prorroga', 'presupuesto', 'Si no se aprueba el presupuesto', 'En el juego, si no hay presupuesto aprobado al empezar el año, se mantiene el anterior en términos nominales.', 'prorroga', 'ley-ordinaria', 'sv-const', '—', 'simplificacion'),
    rule('sv.reforma.iniciativa', 'reforma', 'Iniciativa de reforma constitucional', 'La reforma sólo puede ser propuesta por diputados, en un número no menor de diez.', 10, 'constitucion', 'sv-const', 'Art. 248', 'por-cotejar', { verificationNote: 'El mínimo de diez diputados procede del texto conocido del art. 248; no se cotejó en esta versión.' }),
    rule('sv.reforma.acuerdo', 'reforma', 'Acuerdo de reforma', 'La Asamblea acuerda la reforma con el voto de la mitad más uno de los diputados electos (31).', 'absoluta', 'constitucion', 'sv-const', 'Art. 248', 'por-cotejar'),
    rule('sv.reforma.ratificacion', 'reforma', 'Ratificación de la reforma', 'Desde 2025 hay dos vías: ratificación por la siguiente Asamblea con 2/3 de los diputados electos (40), o por la misma Asamblea con 3/4 (45).', '2/3-siguiente|3/4-misma', 'constitucion', 'sv-ref248', 'Art. 248 (reforma de 2024-2025)', 'contrastada', { published: '2025-01-29', inForce: '2025-02-06' }),
    rule('sv.reforma.petreas', 'reforma', 'Cláusulas irreformables', 'No pueden reformarse en ningún caso los artículos sobre la forma y sistema de gobierno, el territorio y la alternabilidad en el ejercicio de la Presidencia.', 'forma-gobierno|territorio|alternabilidad', 'constitucion', 'sv-const', 'Art. 248, inciso cuarto', 'contrastada', {
      controversy: 'Existe controversia sobre si la reforma de 2025 que permite la reelección es compatible con esta cláusula.',
    }),
    rule('sv.control', 'judicial', 'Control de constitucionalidad', 'La Sala de lo Constitucional de la Corte Suprema declara la inconstitucionalidad de leyes; cualquier ciudadano puede pedirlo.', 'sala', 'constitucion', 'sv-const', 'Arts. 174 y 183', 'por-cotejar'),
    rule('sv.magistrados', 'judicial', 'Elección de magistrados', 'La Asamblea elige a los magistrados de la Corte Suprema con 2/3 de los diputados electos.', 'texto', 'constitucion', 'sv-const', 'Arts. 131 ord. 19 y 186', 'por-cotejar'),
    rule('sv.tse', 'electoral', 'Tribunal Supremo Electoral', 'Una reforma de 2026 retira a los partidos la facultad de proponer magistrados del TSE, aplicable desde 2027.', 'texto', 'constitucion', 'sv-ref208', 'Art. 208 (reforma de 2026)', 'contrastada', { verificationNote: 'Confirmado con fuentes de prensa; texto pendiente de cotejo.' }),
    rule('sv.emergencia', 'emergencia', 'Suspensión de garantías (régimen de excepción)', 'La Asamblea puede suspender ciertas garantías en casos graves (guerra, invasión, rebelión, catástrofe, epidemia, graves perturbaciones del orden público), con 2/3 de los diputados electos en votación nominal y pública. El plazo máximo es de 30 días, prorrogable por períodos iguales mediante nuevo decreto.', 30, 'constitucion', 'sv-dl333', 'Arts. 29, 30 y 131 ord. 27', 'contrastada', { verificationNote: 'El juego muestra estas reglas pero todavía no permite declarar un régimen de excepción (pendiente).' }),
    rule('sv.territorio', 'territorial', 'Organización territorial', 'Estado unitario: 14 departamentos y, desde 2024, 44 municipios. Los municipios eligen concejos, pero el juego no simula elecciones municipales.', 'unitario', 'constitucion', 'sv-const', 'Arts. 200-203; Ley Especial de Reestructuración Municipal (2023)', 'por-cotejar'),
    rule('sv.destitucion', 'control', 'Control y destitución', 'No existe moción de censura contra el Presidente ni disolución de la Asamblea. La Asamblea puede interpelar a ministros y declarar si hay lugar a formación de causa (antejuicio).', 'sin-censura', 'constitucion', 'sv-const', 'Arts. 131 ord. 34 y 236', 'por-cotejar'),
    rule('sv.moneda', 'economia', 'Política monetaria', 'El país está dolarizado: no hay política monetaria propia; los tipos de interés dependen de las condiciones internacionales y del riesgo país.', 'dolarizada', 'ley-ordinaria', 'sv-lim', 'Ley de Integración Monetaria', 'por-cotejar'),
    rule('sv.salario-minimo', 'economia', 'Salario mínimo', 'El Consejo Nacional del Salario Mínimo propone y el Ejecutivo lo fija por decreto.', 'decreto', 'ley-ordinaria', 'sv-ct', 'Código de Trabajo, arts. 155-159', 'por-cotejar'),
    rule('sv.elecciones.fecha', 'electoral', 'Fecha de las elecciones', 'Las elecciones de 2027 se celebran el 28 de febrero. Para elecciones posteriores el juego usa el último domingo de febrero.', '2027-02-28', 'ley-ordinaria', 'sv-tse', 'Convocatoria del TSE', 'contrastada', { verificationNote: 'La regla para fechas posteriores a 2027 es una simplificación del juego.' }),
  ],
  territories: [
    { id: 'sv-ah', name: 'Ahuachapán', short: 'AH', pop: 335, urban: 0.5, lean: { econ: 0, social: 0.05 }, grid: [0, 1], seats: {} },
    { id: 'sv-sa', name: 'Santa Ana', short: 'SA', pop: 545, urban: 0.62, lean: { econ: 0, social: 0.03 }, grid: [1, 0], seats: {} },
    { id: 'sv-so', name: 'Sonsonate', short: 'SO', pop: 470, urban: 0.55, lean: { econ: 0, social: 0.03 }, grid: [1, 2], seats: {} },
    { id: 'sv-ll', name: 'La Libertad', short: 'LL', pop: 830, urban: 0.78, lean: { econ: 0.03, social: -0.03 }, grid: [2, 1], seats: {} },
    { id: 'sv-ch', name: 'Chalatenango', short: 'CH', pop: 185, urban: 0.38, lean: { econ: -0.03, social: 0.05 }, grid: [3, 0], seats: {} },
    { id: 'sv-ss', name: 'San Salvador', short: 'SS', pop: 1550, urban: 0.95, lean: { econ: -0.02, social: -0.05 }, grid: [3, 1], seats: {} },
    { id: 'sv-lp', name: 'La Paz', short: 'LP', pop: 340, urban: 0.5, lean: { econ: 0, social: 0.03 }, grid: [3, 2], seats: {} },
    { id: 'sv-cu', name: 'Cuscatlán', short: 'CU', pop: 255, urban: 0.55, lean: { econ: 0, social: 0.03 }, grid: [4, 1], seats: {} },
    { id: 'sv-ca', name: 'Cabañas', short: 'CA', pop: 150, urban: 0.4, lean: { econ: -0.02, social: 0.06 }, grid: [5, 0], seats: {} },
    { id: 'sv-sv', name: 'San Vicente', short: 'SV', pop: 175, urban: 0.45, lean: { econ: -0.02, social: 0.05 }, grid: [5, 1], seats: {} },
    { id: 'sv-us', name: 'Usulután', short: 'US', pop: 340, urban: 0.45, lean: { econ: -0.02, social: 0.05 }, grid: [5, 2], seats: {} },
    { id: 'sv-sm', name: 'San Miguel', short: 'SM', pop: 470, urban: 0.6, lean: { econ: -0.02, social: 0.03 }, grid: [6, 1], seats: {} },
    { id: 'sv-mo', name: 'Morazán', short: 'MO', pop: 175, urban: 0.35, lean: { econ: -0.04, social: 0.06 }, grid: [7, 0], seats: {} },
    { id: 'sv-lu', name: 'La Unión', short: 'LU', pop: 230, urban: 0.42, lean: { econ: -0.02, social: 0.05 }, grid: [7, 1], seats: {} },
    { id: 'sv-ext', name: 'Exterior', short: 'EXT', pop: 520, urban: 0.9, lean: { econ: 0.05, social: 0 }, grid: [8, 2], seats: {} },
  ],
  chambers: [{ id: 'asamblea', name: 'Asamblea Legislativa', short: 'Asamblea', membersRule: 'sv.asamblea.diputados', termRule: 'sv.asamblea.mandato', system: 'dhondt', seatKey: 'asamblea', discipline: 0.92 }],
  executive: { title: 'Presidente de la República', kind: 'presidencial', methodRule: 'sv.presidente.metodo', termRule: 'sv.presidente.mandato', limitRule: 'sv.presidente.reeleccion', headOfState: 'Presidente de la República' },
  parties: [
    { id: 'sv-mnc', name: 'Movimiento Nación Cívica', short: 'MNC', color: '#2a9d8f', econ: 0.05, social: 0.3, priorities: ['seguridad', 'empleo', 'infraestructura'], strength: 0.65, establishedSeats: true },
    { id: 'sv-fpp', name: 'Frente Popular Progresista', short: 'FPP', color: '#c1121f', econ: -0.55, social: -0.15, priorities: ['empleo', 'salud', 'costo-vida'], strength: 0.55, establishedSeats: true },
    { id: 'sv-als', name: 'Alianza Liberal Salvadoreña', short: 'ALS', color: '#1d4e89', econ: 0.55, social: 0.3, priorities: ['impuestos', 'empleo', 'seguridad'], strength: 0.55, establishedSeats: true },
    { id: 'sv-pcc', name: 'Partido Cambio Ciudadano', short: 'PCC', color: '#e9a23b', econ: -0.05, social: -0.45, priorities: ['instituciones', 'educacion', 'medioambiente'], strength: 0.35, establishedSeats: true },
  ],
  interestGroups: makeGroups('Gremial empresarial (ficticia)', 'Confederación sindical (ficticia)', 'Red de organizaciones ciudadanas (ficticia)'),
  economy: {
    currency: 'US$',
    nominalGDP: 36.7,
    gdpYear: 2025,
    debtPct: 88,
    deficitPct: 3.0,
    unemployment: 5.0,
    inflation: 1.0,
    poverty: 27,
    povertyDef: 'Hogares en pobreza monetaria (aprox.)',
    potentialGrowth: 2.5,
    naturalUnemployment: 5.0,
    okun: 0.4,
    openness: 0.6,
    policyRate: 3.75,
    monetary: 'dolarizada',
    monetaryNote: 'Economía dolarizada: no hay banco central que fije tipos. El juego toma el tipo de referencia de EE. UU. como factor externo y añade una prima de riesgo país.',
    marketRate: 7.0,
    riskThreshold: 60,
    interestPct: 4.0,
    inflationTarget: 2.0,
    fiscalYearStartMonth: 1,
    observed: [
      { key: 'pib', label: 'PIB nominal 2025', value: '36 708 millones de US$', sourceId: 'sv-bcr', year: '2025', verification: 'contrastada' },
      { key: 'deuda', label: 'Deuda pública', value: '≈ 88 % del PIB (87,2–88,3 según fuente y definición)', sourceId: 'sv-moodys', year: '2025', verification: 'contrastada' },
      { key: 'deficit', label: 'Déficit del sector público no financiero con pensiones', value: '≈ 3,0 % del PIB', sourceId: 'sv-cepal', year: '2025', verification: 'contrastada' },
      { key: 'desempleo', label: 'Desempleo', value: '≈ 5 %', sourceId: 'sv-onec', year: '2024-2025', verification: 'por-cotejar' },
      { key: 'inflacion', label: 'Inflación', value: '≈ 1 %', sourceId: 'sv-onec', year: '2025', verification: 'por-cotejar' },
      { key: 'pobreza', label: 'Pobreza monetaria (hogares)', value: '≈ 27 %', sourceId: 'sv-onec', year: '2024', verification: 'por-cotejar' },
    ],
  },
  budget: [
    { id: 'salud', name: 'Salud', desc: 'Hospitales, unidades de salud y medicamentos.', basePct: 3.0, competence: 'nacional', adjustable: true, multiplier: 0.6, lag: 6, service: 'salud', issue: 'salud' },
    { id: 'educacion', name: 'Educación', desc: 'Escuelas, docentes y becas.', basePct: 3.6, competence: 'nacional', adjustable: true, multiplier: 0.6, lag: 6, service: 'educacion', issue: 'educacion' },
    { id: 'seguridad', name: 'Seguridad y defensa', desc: 'Policía, fuerza armada, prisiones y justicia penal.', basePct: 2.6, competence: 'nacional', adjustable: true, multiplier: 0.5, lag: 4, service: 'seguridad', issue: 'seguridad' },
    { id: 'infraestructura', name: 'Infraestructura', desc: 'Carreteras, agua y obras públicas.', basePct: 2.4, competence: 'nacional', adjustable: true, multiplier: 0.8, lag: 10, service: 'infraestructura', issue: 'infraestructura' },
    { id: 'proteccion', name: 'Protección social y pensiones', desc: 'Pensiones públicas, subsidios y transferencias.', basePct: 4.5, competence: 'nacional', adjustable: true, multiplier: 0.7, lag: 3, issue: 'costo-vida' },
    { id: 'empleo', name: 'Políticas de empleo', desc: 'Formación laboral, intermediación y programas de empleo.', basePct: 0.3, competence: 'nacional', adjustable: true, multiplier: 0.6, lag: 8, issue: 'empleo' },
    { id: 'medioambiente', name: 'Medioambiente', desc: 'Gestión de riesgos, cuencas y protección ambiental.', basePct: 0.3, competence: 'nacional', adjustable: true, multiplier: 0.5, lag: 12, issue: 'medioambiente' },
    { id: 'administracion', name: 'Administración general y municipios', desc: 'Órganos del Estado, transferencias a municipios y otros servicios.', basePct: 6.8, competence: 'nacional', adjustable: true, multiplier: 0.45, lag: 4, issue: 'instituciones' },
  ],
  taxes: [
    { id: 'renta', name: 'Impuesto sobre la renta (personas)', desc: 'Índice de la carga efectiva (100 = legislación actual).', basePct: 3.5, unit: 'indice', base: 100, min: 80, max: 130, step: 5, multiplier: -0.35, competence: 'nacional' },
    { id: 'sociedades', name: 'Impuesto sobre la renta (empresas)', desc: 'Índice de la carga efectiva sobre empresas.', basePct: 3.0, unit: 'indice', base: 100, min: 80, max: 130, step: 5, multiplier: -0.25, competence: 'nacional' },
    { id: 'consumo', name: 'IVA', desc: 'Tipo general del impuesto al valor agregado (%).', basePct: 8.5, unit: 'tipo', base: 13, min: 10, max: 18, step: 1, multiplier: -0.4, competence: 'nacional', note: 'Tipo general del 13 % (Ley del IVA; pendiente de cotejo).' },
    { id: 'cotizaciones', name: 'Cotizaciones a la seguridad social', desc: 'Índice de cotizaciones públicas (salud).', basePct: 2.0, unit: 'indice', base: 100, min: 80, max: 130, step: 5, multiplier: -0.3, competence: 'nacional' },
  ],
  regulations: [
    { id: 'salario-minimo', name: 'Salario mínimo', desc: 'Índice del salario mínimo real (100 = actual).', base: 100, min: 90, max: 130, step: 5, unit: 'índice', normType: 'decreto-ejecutivo', procedureId: 'sv.decreto', competence: 'Ejecutivo, a propuesta del Consejo Nacional del Salario Mínimo', enabled: true, ruleIds: ['sv.salario-minimo'], econDir: -0.8, socialDir: 0 },
    { id: 'regulacion-ambiental', name: 'Exigencia ambiental', desc: 'Nivel de exigencia de la regulación ambiental (0-100).', base: 40, min: 10, max: 90, step: 10, unit: 'nivel', normType: 'ley-ordinaria', procedureId: 'sv.ley', competence: 'Asamblea Legislativa', enabled: true, ruleIds: ['sv.ley.mayoria'], econDir: -0.4, socialDir: -0.3 },
    { id: 'aranceles', name: 'Aranceles', desc: 'Arancel medio a importaciones.', base: 0, min: 0, max: 0, step: 1, unit: '%', normType: 'ley-ordinaria', procedureId: 'sv.ley', competence: 'Compromisos regionales', enabled: false, disabledReason: 'El Salvador forma parte del arancel centroamericano y del CAFTA-DR; el juego no modela cambios arancelarios unilaterales (pendiente).', ruleIds: [], econDir: 0, socialDir: 0 },
  ],
  reforms: [
    {
      id: 'sv-segunda-vuelta', title: 'Restablecer la segunda vuelta presidencial', area: 'electoral', ruleId: 'sv.presidente.metodo',
      question: '¿Debe exigirse mayoría absoluta para ganar la Presidencia, con segunda vuelta entre los dos más votados?',
      options: [{ value: 'absoluta-2v', label: 'Mayoría absoluta con segunda vuelta' }, { value: 'relativa', label: 'Mayoría relativa (vigente)' }],
      classify: (v, g) => constitutional(g, 'sv.presidente.metodo', v),
      transitional: { kind: 'siguiente-eleccion', office: 'presidencia', text: 'Se aplica desde la siguiente elección presidencial posterior a su entrada en vigor.' },
      qualitative: {
        legal: 'Cambia el art. 80: si nadie supera el 50 % de los votos válidos, se celebra una segunda votación entre las dos candidaturas más votadas.',
        political: 'Suele favorecer candidaturas capaces de sumar apoyos amplios y obliga a alianzas en la segunda vuelta.',
        social: 'Puede aumentar la legitimidad percibida del ganador; añade una segunda jornada electoral.',
        economic: 'Coste organizativo de una posible segunda jornada (no cuantificado).',
        beneficiaries: ['Candidaturas con apoyos transversales', 'Partidos que negocian alianzas'],
        costs: ['Partidos con base fiel pero minoritaria', 'Presupuesto electoral'],
        uncertainty: 'El efecto real depende del número de candidaturas y de la fragmentación. Escenario cualitativo, sin cifra.',
        timeline: 'Trámite de semanas a años según la vía; efecto en la próxima elección presidencial.',
      },
      position: { econ: 0, social: -0.2 }, intensity: 0.3,
    },
    {
      id: 'sv-mandato', title: 'Cambiar la duración del mandato presidencial', area: 'ejecutivo', ruleId: 'sv.presidente.mandato',
      question: '¿Cuántos años debe durar el mandato presidencial?',
      options: [{ value: 5, label: '5 años' }, { value: 4, label: '4 años' }, { value: 6, label: '6 años (vigente)' }],
      classify: (v, g) => constitutional(g, 'sv.presidente.mandato', v, ['Transitoria modelada: el cambio se aplica al mandato que comience tras la siguiente elección presidencial; no acorta el mandato en curso.']),
      transitional: { kind: 'siguiente-mandato', office: 'presidencia', text: 'Rige para el mandato que comience después de la próxima elección presidencial.' },
      qualitative: {
        legal: 'Modifica el art. 154 y cambia el calendario electoral futuro (la elección presidencial dejaría de coincidir con la legislativa).',
        political: 'Mandatos más cortos aumentan la frecuencia de rendición de cuentas; más largos dan estabilidad y más tiempo para políticas de largo plazo.',
        social: 'Afecta la frecuencia con que la ciudadanía evalúa al Ejecutivo.',
        economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Electorado (más/menos ocasiones de decidir)'],
        costs: ['Coordinación de calendarios electorales'],
        uncertainty: 'No existe una estimación defendible del efecto sobre la calidad del gobierno; se presenta como escenario cualitativo.',
        timeline: 'Efecto a partir del siguiente mandato.',
      },
      position: { econ: 0, social: -0.15 }, intensity: 0.35,
    },
    {
      id: 'sv-reeleccion', title: 'Restringir la reelección presidencial', area: 'ejecutivo', ruleId: 'sv.presidente.reeleccion',
      question: '¿Debe prohibirse que quien ejerce la Presidencia se presente a la elección inmediata?',
      options: [{ value: 'no-inmediata', label: 'Prohibir la reelección inmediata' }, { value: 'permitida', label: 'Permitida (vigente)' }],
      classify: (v, g) => constitutional(g, 'sv.presidente.reeleccion', v, ['Restringir la reelección no choca con la cláusula de alternabilidad del art. 248; la controversia existente se refiere a la reforma que la permitió.']),
      transitional: { kind: 'siguiente-eleccion', office: 'presidencia', text: 'Se aplica a la siguiente elección presidencial: quien ejerza la Presidencia no podrá ser candidato.' },
      qualitative: {
        legal: 'Reintroduce un impedimento en los arts. 152 y 75.',
        political: 'Fuerza la renovación del liderazgo del Ejecutivo; el partido gobernante necesitará otro candidato.',
        social: 'Puede reforzar la percepción de alternancia; también impide reelegir a un gobierno popular.',
        economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Oposición', 'Nuevos liderazgos'],
        costs: ['Presidente en ejercicio y su partido'],
        uncertainty: 'Escenario cualitativo.',
        timeline: 'Efecto en la próxima elección presidencial.',
      },
      controversy: 'La reforma de 2025 que permitió la reelección es objeto de controversia constitucional.',
      position: { econ: 0, social: -0.25 }, intensity: 0.4,
    },
    {
      id: 'sv-parlamentario', title: 'Convertir el sistema en parlamentario', area: 'ejecutivo', ruleId: 'sv.forma-gobierno',
      question: '¿Debe el Gobierno depender de la confianza de la Asamblea, como en un sistema parlamentario?',
      options: [{ value: 'parlamentario', label: 'Sistema parlamentario' }],
      classify: () => ({
        allowed: false, normType: 'constitucion', blockers: ['Prohibido: el art. 248 declara irreformables los artículos sobre la forma y sistema de gobierno. Ningún procedimiento de reforma permite este cambio dentro de la Constitución vigente.'],
        notes: ['Que una propuesta sea legalmente imposible no tiene que ver con su popularidad: el motor jurídico la rechaza aunque tuviera apoyo mayoritario.'], initiators: '—', ruleIds: ['sv.reforma.petreas'],
      }),
      transitional: { kind: 'inmediata', text: '—' },
      qualitative: { legal: 'Cláusula pétrea.', political: '—', social: '—', economic: '—', beneficiaries: [], costs: [], uncertainty: '—', timeline: '—' },
      position: { econ: 0, social: 0 }, intensity: 1,
    },
    {
      id: 'sv-formula', title: 'Cambiar la fórmula de reparto de escaños', area: 'electoral', ruleId: 'sv.asamblea.formula',
      question: '¿Con qué método se convierten los votos en escaños de la Asamblea?',
      options: [{ value: 'hare', label: 'Cociente Hare y restos mayores' }, { value: 'dhondt', label: 'D’Hondt (vigente)' }],
      classify: (v, g) => ordinaryLaw(g, 'sv.asamblea.formula', v, ['Los partidos suelen votar según cómo les afecte el reparto: el juego calcula ese efecto con los resultados de la última elección.']),
      transitional: { kind: 'siguiente-eleccion', office: 'asamblea', text: 'Se aplica en la siguiente elección legislativa.' },
      qualitative: {
        legal: 'Reforma del art. 217 del Código Electoral (ley secundaria).',
        political: 'El sistema de restos mayores suele dar más escaños a partidos medianos y pequeños que D’Hondt.',
        social: 'Mayor pluralidad en la Asamblea, posible mayor fragmentación.',
        economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Partidos pequeños y medianos'],
        costs: ['Partido más votado'],
        uncertainty: 'El efecto exacto depende de los votos; el juego lo calcula sobre resultados simulados.',
        timeline: 'Próxima elección legislativa.',
      },
      controversy: 'Cambiar reglas electorales poco antes de una elección es objeto de debate jurídico (jurisprudencia constitucional pendiente de cotejo).',
      position: { econ: 0, social: -0.1 }, intensity: 0.3,
    },
    {
      id: 'sv-tamano', title: 'Cambiar el número de diputados', area: 'legislativo', ruleId: 'sv.asamblea.diputados',
      question: '¿Cuántos diputados debe tener la Asamblea Legislativa?',
      options: [{ value: 84, label: '84 diputados' }, { value: 72, label: '72 diputados' }, { value: 60, label: '60 (vigente)' }],
      classify: (v, g) => ordinaryLaw(g, 'sv.asamblea.diputados', v, ['El nuevo reparto por circunscripción se calcula con mínimo de 2 por departamento y restos mayores según población (simplificación del juego); el exterior conserva una proporción de 6/60.']),
      transitional: { kind: 'siguiente-eleccion', office: 'asamblea', text: 'Se aplica en la siguiente elección legislativa.' },
      qualitative: {
        legal: 'Reforma del art. 13 del Código Electoral.',
        political: 'Más escaños reducen el número de votos necesario por escaño y suelen mejorar la proporcionalidad.',
        social: 'Mayor representación territorial; percepción pública del costo de la Asamblea.',
        economic: 'Coste administrativo adicional pequeño (no cuantificado).',
        beneficiaries: ['Departamentos pequeños', 'Partidos pequeños'],
        costs: ['Presupuesto de la Asamblea'],
        uncertainty: 'Escenario cualitativo; el reparto exacto depende de los votos.',
        timeline: 'Próxima elección legislativa.',
      },
      position: { econ: -0.05, social: -0.1 }, intensity: 0.3,
    },
  ],
  shortcuts: [
    { id: 'decreto-ejecutivo', label: 'Aprobar la reforma por decreto del Ejecutivo', explain: 'Inválido: el art. 248 reserva la reforma constitucional a la Asamblea Legislativa; el Presidente no tiene iniciativa ni potestad para reformar la Constitución por decreto.', ruleIds: ['sv.reforma.iniciativa'] },
    { id: 'consulta-popular', label: 'Aprobarla mediante una consulta popular directa', explain: 'Inválido: el procedimiento del art. 248 no prevé referéndum como sustituto del acuerdo y la ratificación legislativa.', ruleIds: ['sv.reforma.acuerdo', 'sv.reforma.ratificacion'] },
  ],
  procedures: [
    {
      id: 'sv.ley', name: 'Ley ordinaria', normType: 'ley-ordinaria', first: 'asamblea', initiators: 'Diputados o el Presidente por medio de ministros', ruleIds: ['sv.ley.mayoria', 'sv.veto', 'sv.vigencia'],
      steps: [
        { id: 'asamblea', label: 'Votación en el Pleno de la Asamblea', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'absoluta' }, days: 30, daysKind: 'modelo', ruleIds: ['sv.ley.mayoria'], next: 'sancion' },
        { id: 'sancion', label: 'Sanción o veto presidencial', kind: 'sancion', institution: 'Presidencia de la República', vetoAllowed: true, days: 11, daysKind: 'legal', ruleIds: ['sv.veto'], next: 'publicacion', onFail: 'superar-veto', explain: '8 días hábiles (≈ 11 naturales en el calendario del juego).' },
        { id: 'superar-veto', label: 'Votación para superar el veto (2/3 de electos)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 15, daysKind: 'modelo', ruleIds: ['sv.veto'], next: 'publicacion', onFail: null },
        { id: 'publicacion', label: 'Publicación en el Diario Oficial', kind: 'publicacion', institution: 'Diario Oficial', days: 10, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor (8 días después de la publicación)', kind: 'vigencia', institution: '—', days: 8, daysKind: 'legal', ruleIds: ['sv.vigencia'], next: null },
      ],
    },
    {
      id: 'sv.presupuesto', name: 'Ley de Presupuesto', normType: 'ley-presupuesto', first: 'asamblea', initiators: 'Consejo de Ministros (exclusiva del Ejecutivo)', ruleIds: ['sv.presupuesto', 'sv.ley.mayoria', 'sv.veto'],
      steps: [
        { id: 'asamblea', label: 'Aprobación del presupuesto por la Asamblea', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'absoluta' }, days: 30, daysKind: 'modelo', ruleIds: ['sv.presupuesto', 'sv.ley.mayoria'], next: 'sancion' },
        { id: 'sancion', label: 'Sanción presidencial', kind: 'sancion', institution: 'Presidencia de la República', vetoAllowed: true, days: 11, daysKind: 'legal', ruleIds: ['sv.veto'], next: 'publicacion', onFail: 'superar-veto' },
        { id: 'superar-veto', label: 'Superar el veto (2/3)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 15, daysKind: 'modelo', ruleIds: ['sv.veto'], next: 'publicacion', onFail: null },
        { id: 'publicacion', label: 'Publicación en el Diario Oficial', kind: 'publicacion', institution: 'Diario Oficial', days: 5, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Vigencia para el ejercicio fiscal', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'sv.decreto', name: 'Decreto ejecutivo', normType: 'decreto-ejecutivo', first: 'consulta', initiators: 'Presidencia (Órgano Ejecutivo)', ruleIds: ['sv.salario-minimo'],
      steps: [
        { id: 'consulta', label: 'Propuesta del Consejo Nacional del Salario Mínimo', kind: 'espera', institution: 'Consejo Nacional del Salario Mínimo', days: 30, daysKind: 'modelo', ruleIds: ['sv.salario-minimo'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación del decreto', kind: 'publicacion', institution: 'Diario Oficial', days: 5, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 8, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'sv.reforma.misma', name: 'Reforma constitucional (misma legislatura)', normType: 'constitucion', first: 'acuerdo', initiators: 'Al menos 10 diputados', ruleIds: ['sv.reforma.iniciativa', 'sv.reforma.acuerdo', 'sv.reforma.ratificacion'],
      steps: [
        { id: 'acuerdo', label: 'Acuerdo de reforma (mitad más uno de electos)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'absoluta' }, days: 30, daysKind: 'modelo', ruleIds: ['sv.reforma.acuerdo'], next: 'ratificacion' },
        { id: 'ratificacion', label: 'Ratificación por la misma Asamblea (3/4 de electos)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'cualificada', num: 3, den: 4, base: 'miembros' }, days: 14, daysKind: 'modelo', ruleIds: ['sv.reforma.ratificacion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el Diario Oficial', kind: 'publicacion', institution: 'Diario Oficial', days: 10, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 8, daysKind: 'modelo', ruleIds: [], next: null, explain: 'El juego aplica 8 días tras la publicación; cada decreto de reforma puede fijar otro plazo.' },
      ],
    },
    {
      id: 'sv.reforma.dos', name: 'Reforma constitucional (dos legislaturas)', normType: 'constitucion', first: 'acuerdo', initiators: 'Al menos 10 diputados', ruleIds: ['sv.reforma.iniciativa', 'sv.reforma.acuerdo', 'sv.reforma.ratificacion'],
      steps: [
        { id: 'acuerdo', label: 'Acuerdo de reforma (mitad más uno de electos)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'absoluta' }, days: 30, daysKind: 'modelo', ruleIds: ['sv.reforma.acuerdo'], next: 'espera-legislatura' },
        { id: 'espera-legislatura', label: 'Espera a la siguiente Asamblea Legislativa', kind: 'nueva-legislatura', institution: 'Electorado y Asamblea', chamber: 'asamblea', ruleIds: ['sv.reforma.ratificacion'], next: 'ratificacion' },
        { id: 'ratificacion', label: 'Ratificación por la nueva Asamblea (2/3 de electos)', kind: 'votacion', institution: 'Asamblea Legislativa', chamber: 'asamblea', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 30, daysKind: 'modelo', ruleIds: ['sv.reforma.ratificacion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el Diario Oficial', kind: 'publicacion', institution: 'Diario Oficial', days: 10, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 8, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
  ],
  scenario: {
    start: '2026-11-01',
    firstElection: '2027-02-28',
    offices: ['presidencia', 'asamblea'],
    note: 'Elecciones generales unificadas del 28 de febrero de 2027 (presidenciales y legislativas; las municipales no se simulan). Partidos y candidatos ficticios.',
    inauguration: { presidencia: '2027-06-01', asamblea: '2027-05-01' },
  },
  nextElections: (game, after) => {
    const out: ScheduledElection[] = [];
    // Presidencia
    let d = '2027-02-28';
    while (cmp(d, after) <= 0) {
      const inaug = `${year(d)}-06-01`;
      const term = num(game, 'sv.presidente.mandato', addDays(inaug, 1));
      d = lastSunday(year(d) + term, 2);
    }
    out.push({ date: d, offices: ['presidencia'], reason: 'Fin del mandato presidencial' });
    let a = '2027-02-28';
    while (cmp(a, after) <= 0) {
      const term = num(game, 'sv.asamblea.mandato', `${year(a)}-05-02`);
      a = lastSunday(year(a) + term, 2);
    }
    if (a === d) out[0].offices.push('asamblea');
    else out.push({ date: a, offices: ['asamblea'], reason: 'Fin de la legislatura' });
    return out.sort((x, y) => cmp(x.date, y.date));
  },
  installationDate: (office, electionDate) => (office === 'presidencia' ? `${year(electionDate)}-06-01` : `${year(electionDate)}-05-01`),
  coverage: {
    implemented: [
      'Elección presidencial por mayoría relativa (reforma de 2025) y, si se reforma, con segunda vuelta',
      'Asamblea de 60 diputados en 15 circunscripciones con D’Hondt (incluida la del exterior)',
      'Ley ordinaria con veto presidencial y superación con 2/3',
      'Presupuesto anual del Ejecutivo aprobado por la Asamblea',
      'Reforma constitucional por las dos vías del art. 248 y cláusulas pétreas',
      'Salario mínimo por decreto ejecutivo',
    ],
    simplified: [
      'Voto por listas: no se simula el voto preferente ni candidaturas no partidarias',
      'Duración de trámites legislativos (aproximaciones del modelo)',
      'Prórroga presupuestaria si no se aprueba presupuesto',
      'Poblaciones departamentales usadas como pesos aproximados',
    ],
    pending: [
      'Elecciones municipales y del Parlamento Centroamericano',
      'Régimen de excepción jugable (las reglas se muestran)',
      'Veto por inconstitucionalidad y decisión de la Corte (art. 138)',
      'Antejuicio e interpelaciones',
    ],
  },
  procedureFor: (kind) => (kind === 'presupuesto' ? 'sv.presupuesto' : 'sv.ley'),
  turnoutFactor: 0.85,
};

export default sv;
