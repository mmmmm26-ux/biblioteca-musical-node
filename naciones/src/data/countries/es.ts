import type { CountryModule, ReformRouting } from '../../engine/country';
import type { GameState, RuleValue, Territory } from '../../engine/types';
import { addDays, addYears, nextSunday } from '../../engine/calendar';
import { ruleAt } from '../../engine/legal/rules';
import { makeGroups } from './groups';
import { rule } from './helpers';

// ESPAÑA — Monarquía parlamentaria con Estado autonómico. Cortes Generales bicamerales.
// Versión de reglas: 2026-10-23.

// [id, nombre, comunidad, diputados (RD 806/2026), senadores directos, población aprox. (miles), urbanización, identidad territorial, col, fila]
const PROV: [string, string, string, number, number, number, number, number, number, number][] = [
  ['c', 'A Coruña', 'galicia', 8, 4, 1130, 0.7, 0.3, 0, 0], ['lu', 'Lugo', 'galicia', 4, 4, 325, 0.45, 0.3, 1, 0], ['o', 'Asturias', 'asturias', 7, 4, 1010, 0.75, 0.05, 2, 0],
  ['s', 'Cantabria', 'cantabria', 5, 4, 590, 0.65, 0.05, 3, 0], ['bi', 'Bizkaia', 'pv', 8, 4, 1160, 0.85, 0.6, 4, 0], ['ss', 'Gipuzkoa', 'pv', 6, 4, 730, 0.8, 0.65, 5, 0],
  ['na', 'Navarra', 'navarra', 5, 4, 680, 0.65, 0.35, 6, 0], ['hu', 'Huesca', 'aragon', 3, 4, 230, 0.45, 0.05, 7, 0], ['l', 'Lleida', 'cataluna', 4, 4, 450, 0.5, 0.55, 8, 0],
  ['gi', 'Girona', 'cataluna', 6, 4, 800, 0.6, 0.6, 9, 0],
  ['po', 'Pontevedra', 'galicia', 7, 4, 950, 0.7, 0.3, 0, 1], ['or', 'Ourense', 'galicia', 4, 4, 305, 0.45, 0.3, 1, 1], ['le', 'León', 'cyl', 4, 4, 450, 0.55, 0.05, 2, 1],
  ['p', 'Palencia', 'cyl', 3, 4, 160, 0.5, 0, 3, 1], ['bu', 'Burgos', 'cyl', 4, 4, 360, 0.6, 0, 4, 1], ['vi', 'Álava', 'pv', 4, 4, 340, 0.8, 0.5, 5, 1],
  ['lo', 'La Rioja', 'rioja', 4, 4, 325, 0.65, 0.05, 6, 1], ['z', 'Zaragoza', 'aragon', 7, 4, 990, 0.8, 0.05, 7, 1], ['t', 'Tarragona', 'cataluna', 6, 4, 850, 0.7, 0.5, 8, 1],
  ['b', 'Barcelona', 'cataluna', 32, 4, 5800, 0.92, 0.5, 9, 1],
  ['za', 'Zamora', 'cyl', 3, 4, 165, 0.45, 0, 1, 2], ['va', 'Valladolid', 'cyl', 5, 4, 525, 0.75, 0, 2, 2], ['sg', 'Segovia', 'cyl', 3, 4, 155, 0.5, 0, 3, 2],
  ['so', 'Soria', 'cyl', 2, 4, 90, 0.4, 0, 4, 2], ['gu', 'Guadalajara', 'clm', 3, 4, 275, 0.6, 0, 5, 2], ['te', 'Teruel', 'aragon', 3, 4, 135, 0.35, 0.05, 6, 2],
  ['cs', 'Castellón', 'cv', 5, 4, 610, 0.7, 0.15, 7, 2], ['pm', 'Illes Balears', 'baleares', 8, 6, 1240, 0.8, 0.2, 9, 2],
  ['cc', 'Cáceres', 'extremadura', 4, 4, 390, 0.5, 0, 0, 3], ['sa', 'Salamanca', 'cyl', 4, 4, 330, 0.6, 0, 1, 3], ['av', 'Ávila', 'cyl', 3, 4, 160, 0.45, 0, 2, 3],
  ['m', 'Madrid', 'madrid', 38, 4, 7000, 0.95, 0, 3, 3], ['cu', 'Cuenca', 'clm', 3, 4, 200, 0.4, 0, 4, 3], ['v', 'Valencia', 'cv', 16, 4, 2700, 0.85, 0.15, 6, 3],
  ['ba', 'Badajoz', 'extremadura', 5, 4, 665, 0.55, 0, 0, 4], ['to', 'Toledo', 'clm', 6, 4, 720, 0.6, 0, 2, 4], ['cr', 'Ciudad Real', 'clm', 5, 4, 490, 0.55, 0, 3, 4],
  ['ab', 'Albacete', 'clm', 4, 4, 390, 0.6, 0, 4, 4], ['mu', 'Murcia', 'murcia', 10, 4, 1570, 0.8, 0, 5, 4], ['a', 'Alicante', 'cv', 12, 4, 2000, 0.85, 0.1, 6, 4],
  ['h', 'Huelva', 'andalucia', 5, 4, 530, 0.6, 0.05, 0, 5], ['se', 'Sevilla', 'andalucia', 12, 4, 1960, 0.8, 0.05, 1, 5], ['co', 'Córdoba', 'andalucia', 6, 4, 775, 0.65, 0.05, 2, 5],
  ['j', 'Jaén', 'andalucia', 5, 4, 620, 0.55, 0.05, 3, 5], ['gr', 'Granada', 'andalucia', 7, 4, 930, 0.65, 0.05, 4, 5], ['al', 'Almería', 'andalucia', 6, 4, 760, 0.65, 0.05, 5, 5],
  ['ca', 'Cádiz', 'andalucia', 8, 4, 1250, 0.8, 0.05, 1, 6], ['ma', 'Málaga', 'andalucia', 11, 4, 1760, 0.85, 0.05, 2, 6], ['ml', 'Melilla', 'melilla', 1, 2, 86, 1, 0, 4, 6],
  ['tf', 'Santa Cruz de Tenerife', 'canarias', 7, 6, 1100, 0.8, 0.3, 0, 7], ['gc', 'Las Palmas', 'canarias', 8, 5, 1160, 0.85, 0.3, 1, 7], ['ce', 'Ceuta', 'ceuta', 1, 2, 84, 1, 0, 2, 7],
];

const territories: Territory[] = PROV.map(([id, name, group, dip, sen, pop, urban, identity, col, row]) => ({
  id: `es-${id}`,
  name,
  short: id.toUpperCase(),
  group,
  pop,
  urban,
  identity,
  lean: { econ: 0, social: 0 },
  grid: [col, row],
  seats: { congreso: dip, senado: sen },
}));

const REPARTO = Object.fromEntries(territories.map((t) => [t.id, t.seats.congreso]));

const GROUPS = [
  ['andalucia', 'Andalucía'], ['aragon', 'Aragón'], ['asturias', 'Asturias'], ['baleares', 'Illes Balears'], ['canarias', 'Canarias'], ['cantabria', 'Cantabria'],
  ['clm', 'Castilla-La Mancha'], ['cyl', 'Castilla y León'], ['cataluna', 'Cataluña'], ['cv', 'Comunitat Valenciana'], ['extremadura', 'Extremadura'], ['galicia', 'Galicia'],
  ['madrid', 'Comunidad de Madrid'], ['murcia', 'Región de Murcia'], ['navarra', 'Navarra'], ['pv', 'País Vasco'], ['rioja', 'La Rioja'], ['ceuta', 'Ceuta'], ['melilla', 'Melilla'],
].map(([id, name]) => ({ id, name }));

function r167(game: GameState, ruleId: string, value: RuleValue, notes: string[] = []): ReformRouting {
  const same = ruleAt(game, ruleId).value === value;
  return {
    allowed: !same,
    normType: 'constitucion',
    procedureId: 'es.reforma-167',
    blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
    notes: [
      'Procedimiento ordinario de reforma (art. 167): 3/5 de cada Cámara; si no hay acuerdo, comisión paritaria y posible aprobación con mayoría absoluta del Senado y 2/3 del Congreso.',
      'Referéndum sólo si lo pide 1/10 de los miembros de cualquiera de las Cámaras en 15 días.',
      'No puede iniciarse en tiempo de guerra ni durante los estados de alarma, excepción o sitio (art. 169).',
      ...notes,
    ],
    initiators: 'Gobierno, Congreso, Senado o Asambleas de las comunidades autónomas (arts. 166 y 87)',
    ruleIds: ['es.reforma.ordinaria', 'es.reforma.iniciativa', 'es.reforma.limites'],
  };
}

function organic(game: GameState, ruleId: string, value: RuleValue, notes: string[] = []): ReformRouting {
  const same = ruleAt(game, ruleId).value === value;
  return {
    allowed: !same,
    normType: 'ley-organica',
    procedureId: 'es.ley-organica',
    blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
    notes: ['Se modifica la Ley Orgánica del Régimen Electoral General (LOREG): requiere mayoría absoluta del Congreso (176) en una votación final sobre el conjunto (art. 81).', 'No puede hacerse por decreto-ley: el art. 86 excluye el derecho electoral general.', ...notes],
    initiators: 'Gobierno o grupos parlamentarios (proposición de ley)',
    ruleIds: ['es.ley.organica', 'es.decreto-ley'],
  };
}

const es: CountryModule = {
  id: 'es',
  name: 'España',
  officialName: 'Reino de España',
  status: 'completo',
  system: {
    executive: 'parlamentario',
    territorial: 'autonomico',
    label: 'Monarquía parlamentaria, Estado autonómico',
    summary:
      'El Presidente del Gobierno no se elige directamente: necesita la confianza (investidura) del Congreso de los Diputados. Ganar más votos no garantiza gobernar; hay que reunir apoyos. Las 17 comunidades autónomas gestionan sanidad y educación, entre otras competencias.',
  },
  rulesetVersion: '2026-10-23',
  territoryLabel: 'Provincias',
  groups: GROUPS,
  sources: [
    { id: 'es-ce', title: 'Constitución Española de 1978 (texto consolidado)', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229', kind: 'constitucion', published: '1978-12-29', inForce: '1978-12-29', note: 'Reformada en 1992 (art. 13.2), 2011 (art. 135), 2024 (art. 49) y 2026 (art. 69.3). El texto no pudo descargarse desde el entorno de desarrollo; las reglas marcadas como contrastadas se verificaron con reproducciones del texto oficial.' },
    { id: 'es-ref2026', title: 'Reforma del artículo 69.3 de la Constitución (senador de Formentera)', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-10881', kind: 'reforma', published: '2026-05-20', note: 'Aprobada por el Congreso (26-mar-2026) y el Senado (22-abr-2026) por el art. 167; sin referéndum.' },
    { id: 'es-lo2-2026', title: 'Ley Orgánica 2/2026, de 30 de junio, de modificación de la LOREG', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/eli/es/lo/2026/06/30/2', kind: 'ley', published: '2026-07-02' },
    { id: 'es-loreg', title: 'Ley Orgánica 5/1985, del Régimen Electoral General (LOREG)', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672', kind: 'ley', published: '1985-06-20' },
    { id: 'es-rd806', title: 'Real Decreto 806/2026, de disolución de las Cortes Generales y convocatoria de elecciones', publisher: 'Boletín Oficial del Estado (reportado por prensa)', url: 'https://www.legaltoday.com/actualidad-juridica/noticias-de-derecho/el-boe-publica-el-real-decreto-de-disolucion-de-las-cortes-y-la-convocatoria-electoral-para-el-29-de-noviembre-2026-10-06/', kind: 'decreto', published: '2026-10-06', inForce: '2026-10-06', note: 'Elecciones el 29-nov-2026; Cámaras constituidas el 23-dic-2026. Madrid pasa a 38 diputados y Cádiz a 8.' },
    { id: 'es-lo4-1981', title: 'Ley Orgánica 4/1981, de los estados de alarma, excepción y sitio', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1981-12774', kind: 'ley' },
    { id: 'es-lotc', title: 'Ley Orgánica 2/1979, del Tribunal Constitucional', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1979-23709', kind: 'ley' },
    { id: 'es-cc', title: 'Código Civil, art. 2.1 (entrada en vigor de las leyes)', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763', kind: 'ley' },
    { id: 'es-et', title: 'Estatuto de los Trabajadores, art. 27 (salario mínimo interprofesional)', publisher: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430', kind: 'ley' },
    { id: 'es-tfue', title: 'Tratado de Funcionamiento de la UE (arts. 3, 127 y 207)', publisher: 'EUR-Lex', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:12012E/TXT', kind: 'ley' },
    { id: 'es-rcd', title: 'Reglamento del Congreso de los Diputados', publisher: 'Congreso de los Diputados', url: 'https://www.congreso.es/', kind: 'reglamento' },
    { id: 'es-hac', title: 'Cierre de ejecución presupuestaria 2025', publisher: 'Ministerio de Hacienda', url: 'https://www.hacienda.gob.es/gabineteministro/notas%20prensa/2026/presentacion-cierre-de-ejecucion-presupuestaria-2025.pdf', kind: 'estadistica' },
    { id: 'es-ine', title: 'PIB, EPA e IPC', publisher: 'Instituto Nacional de Estadística', url: 'https://www.ine.es/', kind: 'estadistica' },
    { id: 'es-bde', title: 'Deuda de las Administraciones Públicas (PDE)', publisher: 'Banco de España', url: 'https://www.bde.es/', kind: 'estadistica' },
  ],
  rules: [
    rule('es.forma', 'ejecutivo', 'Forma política', 'España es una monarquía parlamentaria: el Rey es jefe del Estado sin poderes de gobierno; el Gobierno responde ante el Congreso.', 'monarquia-parlamentaria', 'constitucion', 'es-ce', 'Art. 1.3', 'por-cotejar'),
    rule('es.congreso.diputados', 'legislativo', 'Número de diputados', 'El Congreso tiene 350 diputados, cifra fijada por la LOREG dentro del margen de 300 a 400 que permite la Constitución.', 350, 'ley-organica', 'es-loreg', 'LOREG, art. 162.1', 'contrastada'),
    rule('es.congreso.rango', 'legislativo', 'Margen constitucional del Congreso', 'La Constitución fija un mínimo de 300 y un máximo de 400 diputados. Salir de ese margen exige reformar la Constitución.', { min: 300, max: 400 }, 'constitucion', 'es-ce', 'Art. 68.1', 'por-cotejar'),
    rule('es.congreso.circunscripcion', 'electoral', 'Circunscripción electoral', 'La circunscripción es la provincia; Ceuta y Melilla eligen un diputado cada una.', 'provincial', 'constitucion', 'es-ce', 'Art. 68.2', 'por-cotejar'),
    rule('es.congreso.minimo', 'electoral', 'Mínimo por provincia', 'Cada provincia tiene al menos 2 diputados; los 248 restantes se reparten según la población.', 2, 'ley-organica', 'es-loreg', 'LOREG, art. 162.2-3', 'contrastada'),
    rule('es.congreso.reparto', 'electoral', 'Diputados por provincia (elecciones de 2026)', 'El decreto de convocatoria fija los diputados de cada provincia. En 2026 Madrid elige 38 y Cádiz 8; el resto mantiene el reparto de 2023.', REPARTO, 'decreto-ejecutivo', 'es-rd806', 'RD 806/2026, art. 3; LOREG art. 162.4', 'contrastada', { published: '2026-10-06', inForce: '2026-10-06' }),
    rule('es.congreso.formula', 'electoral', 'Fórmula electoral', 'En cada provincia los escaños se reparten con el método D’Hondt entre las listas que superan la barrera.', 'dhondt', 'ley-organica', 'es-loreg', 'LOREG, art. 163', 'contrastada'),
    rule('es.congreso.barrera', 'electoral', 'Barrera electoral', 'Una lista necesita al menos el 3 % de los votos válidos de la provincia para optar a escaño.', 0.03, 'ley-organica', 'es-loreg', 'LOREG, art. 163.1.a', 'contrastada'),
    rule('es.congreso.mandato', 'legislativo', 'Duración de la legislatura', 'Las Cortes se eligen por cuatro años, salvo disolución anticipada.', 4, 'constitucion', 'es-ce', 'Arts. 68.4 y 69.6', 'por-cotejar'),
    rule('es.elegibilidad', 'electoral', 'Electores y elegibles', 'Son electores y elegibles los españoles mayores de edad en pleno uso de sus derechos políticos.', 18, 'constitucion', 'es-ce', 'Art. 68.5; LOREG arts. 2 y 6', 'por-cotejar'),
    rule('es.senado.composicion', 'legislativo', 'Composición del Senado', 'Cada provincia elige 4 senadores; las islas tienen reglas propias (desde 2026, Formentera elige uno propio); Ceuta y Melilla eligen 2. Además, cada comunidad autónoma designa uno más otro por cada millón de habitantes.', 209, 'constitucion', 'es-ref2026', 'Art. 69 (reforma del 69.3 en 2026)', 'contrastada', { published: '2026-05-20' }),
    rule('es.senado.designados', 'legislativo', 'Senadores autonómicos', 'El número de senadores designados por las comunidades varía con la población. El juego usa 57 y los reparte en proporción al voto nacional (simplificación).', 57, 'constitucion', 'es-ce', 'Art. 69.5', 'simplificacion'),
    rule('es.senado.sistema', 'electoral', 'Elección del Senado', 'En cada provincia el elector marca hasta 3 de 4 candidatos (voto limitado). El juego asigna 3 escaños al más votado y 1 al segundo (simplificación).', 'voto-limitado', 'ley-organica', 'es-loreg', 'LOREG, art. 166', 'simplificacion'),
    rule('es.senado.veto', 'legislativo', 'Veto y enmiendas del Senado', 'El Senado tiene dos meses para vetar (mayoría absoluta) o enmendar un proyecto. El Congreso levanta el veto con mayoría absoluta, o con mayoría simple pasados dos meses.', 60, 'constitucion', 'es-ce', 'Art. 90', 'por-cotejar'),
    rule('es.investidura', 'ejecutivo', 'Investidura del Presidente del Gobierno', 'Tras consultar a los grupos, el Rey propone un candidato. Necesita mayoría absoluta (176) en la primera votación o mayoría simple (más síes que noes) en otra 48 horas después.', 'absoluta|simple-48h', 'constitucion', 'es-ce', 'Art. 99.1-3', 'contrastada'),
    rule('es.investidura.plazo', 'ejecutivo', 'Plazo de dos meses', 'Si en dos meses desde la primera votación ningún candidato obtiene la confianza, el Rey disuelve las Cortes y se convocan nuevas elecciones.', 60, 'constitucion', 'es-ce', 'Art. 99.5', 'por-cotejar'),
    rule('es.censura', 'control', 'Moción de censura', 'La propone al menos 1/10 del Congreso (35) con un candidato alternativo; no se vota hasta pasados 5 días y requiere mayoría absoluta. Si prospera, el candidato es investido.', 35, 'constitucion', 'es-ce', 'Arts. 113 y 114.2', 'contrastada'),
    rule('es.confianza', 'control', 'Cuestión de confianza', 'El Presidente puede plantearla; se otorga por mayoría simple. Si la pierde, el Gobierno dimite y se abre una nueva investidura.', 'simple', 'constitucion', 'es-ce', 'Arts. 112 y 114.1', 'contrastada'),
    rule('es.disolucion', 'control', 'Disolución anticipada', 'El Presidente puede proponer la disolución, salvo con una moción de censura en trámite, durante los estados del art. 116, o antes de un año desde la anterior disolución.', 365, 'constitucion', 'es-ce', 'Arts. 115 y 116.5', 'contrastada', { verificationNote: 'El plazo de un año (art. 115.3) se citó en una fuente secundaria con el texto incompleto; pendiente de cotejo literal.' }),
    rule('es.ley.ordinaria', 'legislativo', 'Leyes ordinarias', 'Se aprueban por mayoría simple del Congreso y pasan por el Senado.', 'simple', 'constitucion', 'es-ce', 'Arts. 79, 87-90', 'por-cotejar'),
    rule('es.ley.organica', 'legislativo', 'Leyes orgánicas', 'Las relativas a derechos fundamentales, estatutos de autonomía y régimen electoral general requieren mayoría absoluta del Congreso en una votación final.', 'absoluta', 'constitucion', 'es-ce', 'Art. 81', 'por-cotejar'),
    rule('es.decreto-ley', 'legislativo', 'Decretos-leyes', 'El Gobierno puede dictarlos en casos de extraordinaria y urgente necesidad, sin afectar a instituciones básicas, derechos fundamentales, régimen de las comunidades ni derecho electoral general. El Congreso debe convalidarlos en 30 días.', 30, 'constitucion', 'es-ce', 'Art. 86', 'por-cotejar'),
    rule('es.vacatio', 'legislativo', 'Entrada en vigor', 'Las leyes entran en vigor a los 20 días de su completa publicación en el BOE, si no disponen otra cosa.', 20, 'ley-ordinaria', 'es-cc', 'Código Civil, art. 2.1', 'por-cotejar'),
    rule('es.sancion', 'legislativo', 'Sanción real', 'El Rey sanciona las leyes en 15 días; es un acto debido, sin veto.', 15, 'constitucion', 'es-ce', 'Art. 91', 'por-cotejar'),
    rule('es.presupuestos', 'presupuesto', 'Presupuestos Generales del Estado', 'El Gobierno los elabora y presenta al Congreso al menos tres meses antes de que expiren los del año anterior. Si no se aprueban a tiempo, se prorrogan automáticamente. La ley de presupuestos no puede crear tributos.', 'prorroga-automatica', 'constitucion', 'es-ce', 'Art. 134', 'por-cotejar'),
    rule('es.estabilidad', 'presupuesto', 'Estabilidad presupuestaria', 'Las administraciones deben respetar los límites de déficit estructural y deuda fijados por la Unión Europea y la Ley Orgánica 2/2012. El juego muestra la regla pero no impide aprobar presupuestos.', 'ue', 'constitucion', 'es-ce', 'Art. 135', 'por-cotejar'),
    rule('es.reforma.ordinaria', 'reforma', 'Reforma constitucional ordinaria', '3/5 de cada Cámara; si no hay acuerdo, comisión paritaria; si el Senado da mayoría absoluta, el Congreso puede aprobar con 2/3. Referéndum facultativo si lo pide 1/10 de cualquier Cámara en 15 días.', '3/5', 'constitucion', 'es-ce', 'Art. 167', 'contrastada'),
    rule('es.reforma.agravada', 'reforma', 'Reforma constitucional agravada', 'Para la revisión total o reformas del Título Preliminar, de los derechos fundamentales (Cap. II, Secc. 1.ª del Título I) o de la Corona (Título II): 2/3 de cada Cámara, disolución inmediata, ratificación y nueva aprobación por 2/3 de las nuevas Cámaras y referéndum obligatorio.', '2/3+disolucion+referendum', 'constitucion', 'es-ce', 'Art. 168', 'contrastada'),
    rule('es.reforma.limites', 'reforma', 'Límites temporales', 'No puede iniciarse una reforma en tiempo de guerra ni durante los estados de alarma, excepción o sitio.', 'art116', 'constitucion', 'es-ce', 'Art. 169', 'por-cotejar'),
    rule('es.reforma.iniciativa', 'reforma', 'Iniciativa de reforma', 'Pueden iniciarla el Gobierno, el Congreso, el Senado y las Asambleas autonómicas. En el Congreso, las proposiciones requieren dos grupos o 1/5 de los diputados.', 70, 'constitucion', 'es-rcd', 'Arts. 87.1-2 y 166 CE; art. 146 RCD', 'por-cotejar'),
    rule('es.tc', 'judicial', 'Tribunal Constitucional', '12 magistrados. El recurso de inconstitucionalidad pueden presentarlo el Presidente del Gobierno, el Defensor del Pueblo, 50 diputados, 50 senadores y los órganos de las comunidades, en tres meses desde la publicación.', 50, 'constitucion', 'es-lotc', 'Arts. 159 y 162 CE; art. 33 LOTC', 'por-cotejar'),
    rule('es.emergencia', 'emergencia', 'Estados de alarma, excepción y sitio', 'Alarma: el Gobierno la declara hasta 15 días y su prórroga requiere autorización del Congreso. Excepción: autorización previa del Congreso, máximo 30 días prorrogables. Sitio: mayoría absoluta del Congreso. No jugable en esta versión.', 15, 'constitucion', 'es-lo4-1981', 'Art. 116 CE; LO 4/1981', 'contrastada'),
    rule('es.territorio', 'territorial', 'Estado autonómico', 'España se organiza en 17 comunidades autónomas y 2 ciudades autónomas. El Estado tiene competencias exclusivas (art. 149) y fija bases en sanidad y educación; las comunidades gestionan esos servicios.', 'autonomico', 'constitucion', 'es-ce', 'Arts. 2, 137, 148 y 149', 'por-cotejar'),
    rule('es.financiacion', 'territorial', 'Financiación autonómica', 'Las comunidades se financian con tributos cedidos y transferencias del sistema (LOFCA). El juego permite ajustar esa financiación en los Presupuestos; las comunidades deciden cómo gastarla.', 'lofca', 'ley-organica', 'es-ce', 'Art. 157; LOFCA', 'simplificacion'),
    rule('es.bce', 'economia', 'Política monetaria', 'La fija el Banco Central Europeo para toda la zona euro; el Gobierno no controla los tipos de interés.', 'eurosistema', 'constitucion', 'es-tfue', 'TFUE, arts. 127 y 282', 'por-cotejar'),
    rule('es.comercio', 'economia', 'Política comercial', 'Los aranceles son competencia exclusiva de la Unión Europea.', 'ue', 'constitucion', 'es-tfue', 'TFUE, arts. 3.1.e y 207', 'por-cotejar'),
    rule('es.smi', 'economia', 'Salario mínimo interprofesional', 'Lo fija el Gobierno cada año por real decreto, previa consulta con sindicatos y patronal.', 'real-decreto', 'ley-ordinaria', 'es-et', 'Estatuto de los Trabajadores, art. 27', 'por-cotejar'),
    rule('es.presidente.limite', 'ejecutivo', 'Límite de mandatos', 'No hay límite de mandatos para el Presidente del Gobierno.', 0, 'constitucion', 'es-ce', 'Art. 99 (ausencia de límite)', 'por-cotejar'),
    rule('es.corona.sucesion', 'ejecutivo', 'Sucesión en la Corona', 'En el mismo grado, se prefiere el varón a la mujer.', 'preferencia-varon', 'constitucion', 'es-ce', 'Art. 57.1', 'por-cotejar'),
    rule('es.elecciones.convocatoria', 'electoral', 'Elecciones de 2026', 'Elecciones generales el 29 de noviembre de 2026; las Cámaras se constituyen el 23 de diciembre.', '2026-11-29', 'decreto-ejecutivo', 'es-rd806', 'RD 806/2026', 'contrastada', { published: '2026-10-06' }),
    rule('es.elecciones.plazo', 'electoral', 'Plazo entre convocatoria y elecciones', 'Las elecciones se celebran 54 días después de la convocatoria.', 54, 'ley-organica', 'es-loreg', 'LOREG, art. 42', 'por-cotejar'),
  ],
  territories,
  chambers: [
    { id: 'congreso', name: 'Congreso de los Diputados', short: 'Congreso', membersRule: 'es.congreso.diputados', termRule: 'es.congreso.mandato', system: 'dhondt', seatKey: 'congreso', discipline: 0.97 },
    { id: 'senado', name: 'Senado', short: 'Senado', membersRule: 'es.senado.composicion', termRule: 'es.congreso.mandato', system: 'voto-limitado', seatKey: 'senado', discipline: 0.97, upper: true, designated: { count: 57, ruleId: 'es.senado.designados', note: 'Designados por las comunidades (simplificado)' } },
  ],
  executive: { title: 'Presidente del Gobierno', kind: 'parlamentario', methodRule: 'es.investidura', limitRule: 'es.presidente.limite', headOfState: 'Rey' },
  parties: [
    { id: 'es-ava', name: 'Avanza', short: 'AVZ', color: '#d6336c', econ: -0.35, social: -0.35, priorities: ['salud', 'empleo', 'educacion'], strength: 0.7, establishedSeats: true },
    { id: 'es-alc', name: 'Alianza Liberal-Conservadora', short: 'ALC', color: '#1c7ed6', econ: 0.4, social: 0.25, priorities: ['impuestos', 'empleo', 'seguridad'], strength: 0.7, establishedSeats: true },
    { id: 'es-iec', name: 'Izquierda en Común', short: 'IEC', color: '#862e9c', econ: -0.7, social: -0.45, priorities: ['costo-vida', 'medioambiente', 'empleo'], strength: 0.45, establishedSeats: true },
    { id: 'es-pyo', name: 'Patria y Orden', short: 'PyO', color: '#2f9e44', econ: 0.45, social: 0.75, priorities: ['seguridad', 'impuestos', 'instituciones'], strength: 0.45, establishedSeats: true },
    { id: 'es-nl', name: 'Nació Lliure', short: 'NL', color: '#f59f00', econ: -0.1, social: -0.3, priorities: ['instituciones', 'infraestructura', 'educacion'], strength: 0.55, regionalGroups: ['cataluna'], establishedSeats: true },
    { id: 'es-ea', name: 'Euskadi Aurrera', short: 'EA', color: '#0b7285', econ: 0.15, social: -0.1, priorities: ['infraestructura', 'instituciones', 'empleo'], strength: 0.55, regionalGroups: ['pv', 'navarra'], establishedSeats: true },
    { id: 'es-cu', name: 'Canarias Unida', short: 'CU', color: '#e8590c', econ: 0.1, social: 0.05, priorities: ['infraestructura', 'empleo', 'costo-vida'], strength: 0.45, regionalGroups: ['canarias'], establishedSeats: true },
  ],
  interestGroups: makeGroups('Confederación empresarial (ficticia)', 'Sindicatos de clase (ficticios)', 'Plataforma de entidades sociales (ficticia)'),
  economy: {
    currency: '€',
    nominalGDP: 1680,
    gdpYear: 2025,
    debtPct: 101,
    deficitPct: 2.4,
    unemployment: 10.5,
    inflation: 2.7,
    poverty: 19.5,
    povertyDef: 'Tasa de riesgo de pobreza (aprox.)',
    potentialGrowth: 1.8,
    naturalUnemployment: 10.0,
    okun: 1.5,
    openness: 0.85,
    policyRate: 2.0,
    monetary: 'eurosistema',
    monetaryNote: 'El BCE fija los tipos para toda la zona euro: el juego los trata como factor externo que no responde a la economía española.',
    marketRate: 3.2,
    riskThreshold: 95,
    interestPct: 2.4,
    inflationTarget: 2.0,
    fiscalYearStartMonth: 1,
    observed: [
      { key: 'deficit', label: 'Déficit público 2025', value: '2,39 % del PIB con ayudas DANA (2,18 % sin ellas)', sourceId: 'es-hac', year: '2025', verification: 'contrastada' },
      { key: 'pib', label: 'PIB nominal', value: '≈ 1,68 billones de € (2024: 1,594 billones)', sourceId: 'es-ine', year: '2025', verification: 'por-cotejar' },
      { key: 'deuda', label: 'Deuda pública (PDE)', value: '≈ 101 % del PIB', sourceId: 'es-bde', year: '2025', verification: 'por-cotejar' },
      { key: 'desempleo', label: 'Tasa de paro (EPA)', value: '≈ 10,5 %', sourceId: 'es-ine', year: '2025', verification: 'por-cotejar' },
      { key: 'inflacion', label: 'Inflación (IPC)', value: '≈ 2,7 %', sourceId: 'es-ine', year: '2025', verification: 'por-cotejar' },
    ],
  },
  budget: [
    { id: 'salud', name: 'Sanidad', desc: 'Gestionada por las comunidades autónomas.', basePct: 6.7, competence: 'territorial', adjustable: false, multiplier: 0.6, lag: 6, service: 'salud', issue: 'salud', note: 'Competencia autonómica: el Estado fija bases y financia; las comunidades gestionan. Se ajusta mediante la financiación autonómica.' },
    { id: 'educacion', name: 'Educación', desc: 'Gestionada por las comunidades autónomas.', basePct: 4.2, competence: 'territorial', adjustable: false, multiplier: 0.6, lag: 8, service: 'educacion', issue: 'educacion', note: 'Competencia autonómica (el Estado fija normas básicas).' },
    { id: 'seguridad', name: 'Defensa y seguridad', desc: 'Fuerzas Armadas, Policía Nacional y Guardia Civil.', basePct: 2.3, competence: 'nacional', adjustable: true, multiplier: 0.5, lag: 5, service: 'seguridad', issue: 'seguridad' },
    { id: 'infraestructura', name: 'Infraestructuras', desc: 'Carreteras, ferrocarril y obras hidráulicas estatales.', basePct: 2.5, competence: 'mixta', adjustable: true, multiplier: 0.8, lag: 12, service: 'infraestructura', issue: 'infraestructura' },
    { id: 'proteccion', name: 'Pensiones y protección social', desc: 'Pensiones contributivas, ingreso mínimo vital y otras prestaciones.', basePct: 17.5, competence: 'nacional', adjustable: true, multiplier: 0.65, lag: 3, issue: 'costo-vida' },
    { id: 'empleo', name: 'Desempleo y políticas activas', desc: 'Prestaciones por desempleo y formación.', basePct: 1.5, competence: 'mixta', adjustable: true, multiplier: 0.6, lag: 6, issue: 'empleo' },
    { id: 'medioambiente', name: 'Medioambiente y transición ecológica', desc: 'Programas ambientales y energéticos.', basePct: 0.9, competence: 'mixta', adjustable: true, multiplier: 0.5, lag: 12, issue: 'medioambiente' },
    { id: 'administracion', name: 'Administración y otros', desc: 'Servicios generales, justicia y entidades locales.', basePct: 6.4, competence: 'mixta', adjustable: true, multiplier: 0.45, lag: 4, issue: 'instituciones' },
  ],
  taxes: [
    { id: 'renta', name: 'IRPF', desc: 'Índice de la carga efectiva (100 = actual). El IRPF está parcialmente cedido a las comunidades.', basePct: 9.5, unit: 'indice', base: 100, min: 85, max: 120, step: 5, multiplier: -0.35, competence: 'nacional' },
    { id: 'sociedades', name: 'Impuesto sobre Sociedades', desc: 'Índice de la carga efectiva.', basePct: 2.5, unit: 'indice', base: 100, min: 80, max: 130, step: 5, multiplier: -0.25, competence: 'nacional' },
    { id: 'consumo', name: 'IVA', desc: 'Tipo general (%). La normativa europea exige un tipo general mínimo del 15 %.', basePct: 7.0, unit: 'tipo', base: 21, min: 15, max: 25, step: 1, multiplier: -0.4, competence: 'nacional', note: 'Armonizado por la UE (Directiva 2006/112/CE; pendiente de cotejo).' },
    { id: 'cotizaciones', name: 'Cotizaciones sociales', desc: 'Índice de cotizaciones a la Seguridad Social.', basePct: 13.5, unit: 'indice', base: 100, min: 90, max: 115, step: 5, multiplier: -0.3, competence: 'nacional' },
  ],
  regulations: [
    { id: 'salario-minimo', name: 'Salario mínimo interprofesional', desc: 'Índice del SMI real (100 = actual).', base: 100, min: 95, max: 120, step: 5, unit: 'índice', normType: 'decreto-ejecutivo', procedureId: 'es.real-decreto', competence: 'Gobierno, previa consulta a sindicatos y patronal', enabled: true, ruleIds: ['es.smi'], econDir: -0.8, socialDir: 0 },
    { id: 'regulacion-ambiental', name: 'Exigencia ambiental', desc: 'Nivel de exigencia de la normativa ambiental estatal básica (0-100).', base: 55, min: 20, max: 90, step: 10, unit: 'nivel', normType: 'ley-ordinaria', procedureId: 'es.ley', competence: 'Estado (legislación básica) y comunidades (desarrollo)', enabled: true, ruleIds: ['es.ley.ordinaria'], econDir: -0.4, socialDir: -0.3 },
    { id: 'aranceles', name: 'Aranceles', desc: 'Arancel exterior común.', base: 0, min: 0, max: 0, step: 1, unit: '%', normType: 'ley-ordinaria', procedureId: 'es.ley', competence: 'Unión Europea (exclusiva)', enabled: false, disabledReason: 'Competencia exclusiva de la Unión Europea: el Gobierno español no puede fijar aranceles.', ruleIds: ['es.comercio'], econDir: 0, socialDir: 0 },
  ],
  reforms: [
    {
      id: 'es-barrera', title: 'Cambiar la barrera electoral del Congreso', area: 'electoral', ruleId: 'es.congreso.barrera',
      question: '¿Qué porcentaje mínimo de votos en la provincia debe exigirse para obtener escaño?',
      options: [{ value: 0.05, label: '5 %' }, { value: 0, label: 'Sin barrera' }, { value: 0.03, label: '3 % (vigente)' }],
      classify: (v, g) => organic(g, 'es.congreso.barrera', v, ['En provincias pequeñas la barrera rara vez decide: el número de escaños ya exige mucho más que un 3 %.']),
      transitional: { kind: 'siguiente-eleccion', office: 'congreso', text: 'Se aplica en las siguientes elecciones generales.' },
      qualitative: {
        legal: 'Modifica el art. 163.1.a de la LOREG.', political: 'Una barrera mayor dificulta la entrada de partidos pequeños en provincias grandes.', social: 'Menos fragmentación o menos pluralidad, según el punto de vista.', economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Partidos grandes'], costs: ['Partidos pequeños en Madrid, Barcelona y otras provincias grandes'], uncertainty: 'El motor calcula el efecto sobre los resultados simulados.', timeline: 'Próximas elecciones.',
      },
      position: { econ: 0, social: 0.05 }, intensity: 0.25,
    },
    {
      id: 'es-diputados', title: 'Cambiar el número de diputados', area: 'legislativo', ruleId: 'es.congreso.diputados',
      question: '¿Cuántos diputados debe tener el Congreso?',
      options: [{ value: 400, label: '400 (máximo constitucional)' }, { value: 300, label: '300 (mínimo constitucional)' }, { value: 450, label: '450 (fuera del margen)' }, { value: 350, label: '350 (vigente)' }],
      classify: (v, g) => {
        const rango = ruleAt(g, 'es.congreso.rango').value as Record<string, number>;
        const n = Number(v);
        if (n >= rango.min && n <= rango.max) return organic(g, 'es.congreso.diputados', v, ['Dentro del margen de 300-400 del art. 68.1: basta con reformar la LOREG.', 'El nuevo reparto mantiene el mínimo de 2 por provincia y reparte el resto por población (restos mayores, como el art. 162).']);
        return r167(g, 'es.congreso.diputados', v, ['Fuera del margen de 300-400 diputados: exige reformar el art. 68.1 de la Constitución.', 'Simplificación: el juego tramita la adaptación de la LOREG junto con la reforma constitucional.']);
      },
      transitional: { kind: 'siguiente-eleccion', office: 'congreso', text: 'Se aplica en las siguientes elecciones generales.' },
      qualitative: {
        legal: 'LOREG art. 162 (y art. 68.1 CE si se sale del margen).', political: 'Más diputados suelen aumentar la proporcionalidad, sobre todo en provincias medianas.', social: 'Más representación; mayor coste de la Cámara.', economic: 'Coste pequeño (no cuantificado).',
        beneficiaries: ['Partidos medianos', 'Provincias pobladas'], costs: ['Presupuesto de las Cortes'], uncertainty: 'El reparto se calcula; los efectos políticos son inciertos.', timeline: 'Próximas elecciones.',
      },
      position: { econ: 0, social: -0.05 }, intensity: 0.3,
    },
    {
      id: 'es-circunscripcion', title: 'Circunscripción única nacional', area: 'electoral', ruleId: 'es.congreso.circunscripcion',
      question: '¿Deben repartirse todos los escaños del Congreso en una sola circunscripción nacional?',
      options: [{ value: 'nacional', label: 'Circunscripción única nacional' }, { value: 'provincial', label: 'Provincial (vigente)' }],
      classify: (v, g) => r167(g, 'es.congreso.circunscripcion', v, ['El art. 68.2 establece que la circunscripción es la provincia: no basta con cambiar la LOREG.', 'Los partidos territoriales y los de provincias poco pobladas suelen oponerse.']),
      transitional: { kind: 'siguiente-eleccion', office: 'congreso', text: 'Se aplica en las siguientes elecciones generales.' },
      qualitative: {
        legal: 'Reforma del art. 68.2 CE (y de la LOREG).', political: 'Reparto mucho más proporcional al voto nacional; menos peso de las provincias pequeñas.', social: 'Cambia la relación entre diputados y territorios.', economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Partidos nacionales medianos y pequeños'], costs: ['Provincias poco pobladas', 'Partidos con voto concentrado'], uncertainty: 'El motor calcula el reparto bajo la nueva regla.', timeline: 'Próximas elecciones tras la reforma.',
      },
      position: { econ: 0, social: -0.1 }, intensity: 0.5,
    },
    {
      id: 'es-limite', title: 'Limitar los mandatos del Presidente del Gobierno', area: 'ejecutivo', ruleId: 'es.presidente.limite',
      question: '¿Cuántas legislaturas como máximo puede ser Presidente del Gobierno una misma persona?',
      options: [{ value: 2, label: 'Dos legislaturas' }, { value: 0, label: 'Sin límite (vigente)' }],
      classify: (v, g) => r167(g, 'es.presidente.limite', v, ['El juego lo modela como reforma del art. 99 por el art. 167. Si podría hacerse por ley es una cuestión debatida.']),
      transitional: { kind: 'siguiente-eleccion', office: 'congreso', text: 'Cuenta los mandatos desde la entrada en vigor y se aplica en la siguiente investidura.' },
      qualitative: {
        legal: 'Añade un requisito al candidato a la investidura.', political: 'Obliga a la renovación del liderazgo.', social: 'Puede reforzar la alternancia percibida.', economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Nuevos liderazgos'], costs: ['Presidentes con apoyo continuado'], uncertainty: 'Escenario cualitativo.', timeline: 'Años.',
      },
      position: { econ: 0, social: -0.15 }, intensity: 0.35,
    },
    {
      id: 'es-corona', title: 'Igualdad en la sucesión a la Corona', area: 'corona', ruleId: 'es.corona.sucesion',
      question: '¿Debe eliminarse la preferencia del varón sobre la mujer en la sucesión al trono?',
      options: [{ value: 'igualdad', label: 'Igualdad entre hombres y mujeres' }, { value: 'preferencia-varon', label: 'Preferencia del varón (vigente)' }],
      classify: (v, g) => {
        const same = ruleAt(g, 'es.corona.sucesion').value === v;
        return {
          allowed: !same, normType: 'constitucion', procedureId: 'es.reforma-168', blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
          notes: ['Afecta al Título II (la Corona): exige el procedimiento agravado del art. 168.', 'Implica disolver las Cortes y celebrar elecciones antes de terminar la reforma, y un referéndum obligatorio.'],
          initiators: 'Gobierno, Congreso, Senado o Asambleas autonómicas', ruleIds: ['es.reforma.agravada', 'es.reforma.limites'],
        };
      },
      transitional: { kind: 'inmediata', text: 'Rige desde su entrada en vigor.' },
      qualitative: {
        legal: 'Reforma del art. 57.1 por el art. 168.', political: 'Amplio consenso habitual sobre el fondo, pero el procedimiento obliga a disolver las Cortes, lo que tiene un gran coste político.', social: 'Igualdad formal en la sucesión.', economic: 'Coste de unas elecciones anticipadas y un referéndum (no cuantificado).',
        beneficiaries: ['Principio de igualdad'], costs: ['Gobierno en ejercicio (adelanto electoral)'], uncertainty: 'Escenario cualitativo.', timeline: 'Muchos meses: incluye elecciones y referéndum.',
      },
      position: { econ: 0, social: -0.2 }, intensity: 0.2,
    },
  ],
  shortcuts: [
    { id: 'decreto-ley', label: 'Aprobarlo por real decreto-ley', explain: 'Inválido: un decreto-ley no puede afectar al ordenamiento de las instituciones básicas del Estado ni al derecho electoral general (art. 86.1), y la Constitución sólo se reforma por el Título X.', ruleIds: ['es.decreto-ley', 'es.reforma.ordinaria'] },
    { id: 'mayoria-absoluta', label: 'Aprobarlo sólo con la mayoría absoluta del Gobierno', explain: 'Inválido: la reforma constitucional exige mayorías cualificadas en ambas Cámaras (arts. 167 y 168); la mayoría absoluta no basta.', ruleIds: ['es.reforma.ordinaria', 'es.reforma.agravada'] },
  ],
  procedures: [
    {
      id: 'es.ley', name: 'Ley ordinaria', normType: 'ley-ordinaria', first: 'congreso', initiators: 'Gobierno (proyecto) o grupos parlamentarios (proposición)', ruleIds: ['es.ley.ordinaria', 'es.senado.veto', 'es.sancion', 'es.vacatio'],
      steps: [
        { id: 'congreso', label: 'Aprobación en el Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'simple' }, days: 45, daysKind: 'modelo', ruleIds: ['es.ley.ordinaria'], next: 'senado' },
        { id: 'senado', label: 'Senado: dos meses para vetar o enmendar', kind: 'veto-camara', institution: 'Senado', chamber: 'senado', majority: { kind: 'absoluta' }, days: 60, daysKind: 'legal', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: 'levantar-veto', explain: 'El veto exige mayoría absoluta del Senado. Las enmiendas no se modelan.' },
        { id: 'levantar-veto', label: 'Levantar el veto: mayoría absoluta del Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'absoluta' }, days: 7, daysKind: 'modelo', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: 'espera-veto' },
        { id: 'espera-veto', label: 'Espera de dos meses desde el veto', kind: 'espera', institution: '—', days: 60, daysKind: 'legal', ruleIds: ['es.senado.veto'], next: 'levantar-simple' },
        { id: 'levantar-simple', label: 'Levantar el veto: mayoría simple del Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'simple' }, days: 1, daysKind: 'modelo', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: null },
        { id: 'sancion', label: 'Sanción real (15 días)', kind: 'sancion', institution: 'Rey', vetoAllowed: false, days: 15, daysKind: 'legal', ruleIds: ['es.sancion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el BOE', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 3, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor (20 días)', kind: 'vigencia', institution: '—', days: 20, daysKind: 'legal', ruleIds: ['es.vacatio'], next: null },
      ],
    },
    {
      id: 'es.ley-organica', name: 'Ley orgánica', normType: 'ley-organica', first: 'congreso', initiators: 'Gobierno o grupos parlamentarios', ruleIds: ['es.ley.organica', 'es.senado.veto'],
      steps: [
        { id: 'congreso', label: 'Votación final en el Congreso (mayoría absoluta)', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'absoluta' }, days: 60, daysKind: 'modelo', ruleIds: ['es.ley.organica'], next: 'senado' },
        { id: 'senado', label: 'Senado: dos meses para vetar o enmendar', kind: 'veto-camara', institution: 'Senado', chamber: 'senado', majority: { kind: 'absoluta' }, days: 60, daysKind: 'legal', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: 'levantar-veto' },
        { id: 'levantar-veto', label: 'Levantar el veto (mayoría absoluta)', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'absoluta' }, days: 7, daysKind: 'modelo', ruleIds: ['es.senado.veto', 'es.ley.organica'], next: 'sancion', onFail: null },
        { id: 'sancion', label: 'Sanción real (15 días)', kind: 'sancion', institution: 'Rey', vetoAllowed: false, days: 15, daysKind: 'legal', ruleIds: ['es.sancion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el BOE', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 3, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor (20 días)', kind: 'vigencia', institution: '—', days: 20, daysKind: 'legal', ruleIds: ['es.vacatio'], next: null },
      ],
    },
    {
      id: 'es.presupuesto', name: 'Ley de Presupuestos Generales del Estado', normType: 'ley-presupuesto', first: 'totalidad', initiators: 'Gobierno (exclusiva)', ruleIds: ['es.presupuestos', 'es.senado.veto'],
      steps: [
        { id: 'totalidad', label: 'Debate de totalidad y aprobación en el Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'simple' }, days: 50, daysKind: 'modelo', ruleIds: ['es.presupuestos'], next: 'senado', explain: 'Si prospera una enmienda a la totalidad (más noes que síes) el proyecto se devuelve al Gobierno.' },
        { id: 'senado', label: 'Senado', kind: 'veto-camara', institution: 'Senado', chamber: 'senado', majority: { kind: 'absoluta' }, days: 30, daysKind: 'modelo', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: 'levantar-veto' },
        { id: 'levantar-veto', label: 'Levantar el veto (mayoría absoluta)', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'absoluta' }, days: 7, daysKind: 'modelo', ruleIds: ['es.senado.veto'], next: 'sancion', onFail: null },
        { id: 'sancion', label: 'Sanción real', kind: 'sancion', institution: 'Rey', vetoAllowed: false, days: 10, daysKind: 'modelo', ruleIds: ['es.sancion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el BOE', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 2, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Vigencia para el ejercicio', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'es.real-decreto', name: 'Real decreto del Gobierno', normType: 'decreto-ejecutivo', first: 'consulta', initiators: 'Gobierno', ruleIds: ['es.smi'],
      steps: [
        { id: 'consulta', label: 'Consulta con organizaciones sindicales y empresariales', kind: 'espera', institution: 'Ministerio de Trabajo', days: 30, daysKind: 'modelo', ruleIds: ['es.smi'], next: 'publicacion' },
        { id: 'publicacion', label: 'Aprobación en Consejo de Ministros y publicación', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 3, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 1, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'es.reforma-167', name: 'Reforma constitucional ordinaria (art. 167)', normType: 'constitucion', first: 'congreso', initiators: 'Gobierno, Congreso, Senado o Asambleas autonómicas', ruleIds: ['es.reforma.ordinaria', 'es.reforma.limites'],
      steps: [
        { id: 'congreso', label: 'Congreso: 3/5 de los miembros', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'cualificada', num: 3, den: 5, base: 'miembros' }, days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'senado', onFail: null },
        { id: 'senado', label: 'Senado: 3/5 de los miembros', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 3, den: 5, base: 'miembros' }, days: 45, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'solicitud', onFail: 'comision' },
        { id: 'comision', label: 'Comisión paritaria Congreso-Senado', kind: 'espera', institution: 'Comisión mixta', days: 45, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'senado-absoluta' },
        { id: 'senado-absoluta', label: 'Senado: mayoría absoluta del texto', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'absoluta' }, days: 15, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'congreso-2-3', onFail: null },
        { id: 'congreso-2-3', label: 'Congreso: 2/3 de los miembros', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 15, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'solicitud', onFail: null },
        { id: 'solicitud', label: 'Plazo de 15 días para pedir referéndum (1/10 de una Cámara)', kind: 'solicitud-referendum', institution: 'Congreso o Senado', requestFraction: { num: 1, den: 10 }, days: 15, daysKind: 'legal', ruleIds: ['es.reforma.ordinaria'], next: 'sancion', onFail: 'referendum' },
        { id: 'referendum', label: 'Referéndum de ratificación', kind: 'referendum', institution: 'Cuerpo electoral', days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.ordinaria'], next: 'sancion', onFail: null },
        { id: 'sancion', label: 'Sanción real', kind: 'sancion', institution: 'Rey', vetoAllowed: false, days: 15, daysKind: 'legal', ruleIds: ['es.sancion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el BOE', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 2, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor (día de la publicación)', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null, explain: 'Las reformas de 1992, 2011 y 2024 entraron en vigor el día de su publicación; el juego aplica esa regla.' },
      ],
    },
    {
      id: 'es.reforma-168', name: 'Reforma constitucional agravada (art. 168)', normType: 'constitucion', first: 'congreso', initiators: 'Gobierno, Congreso, Senado o Asambleas autonómicas', ruleIds: ['es.reforma.agravada', 'es.reforma.limites'],
      steps: [
        { id: 'congreso', label: 'Aprobación del principio: 2/3 del Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'senado', onFail: null },
        { id: 'senado', label: 'Aprobación del principio: 2/3 del Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 30, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'disolucion', onFail: null },
        { id: 'disolucion', label: 'Disolución inmediata de las Cortes y elecciones', kind: 'disolucion-elecciones', institution: 'Rey y cuerpo electoral', ruleIds: ['es.reforma.agravada', 'es.elecciones.plazo'], next: 'ratifica-congreso' },
        { id: 'ratifica-congreso', label: 'Nuevo Congreso: ratifica la decisión', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'simple' }, days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'ratifica-senado', onFail: null },
        { id: 'ratifica-senado', label: 'Nuevo Senado: ratifica la decisión', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'simple' }, days: 20, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'texto-congreso', onFail: null },
        { id: 'texto-congreso', label: 'Nuevo texto: 2/3 del Congreso', kind: 'votacion', institution: 'Congreso de los Diputados', chamber: 'congreso', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'texto-senado', onFail: null },
        { id: 'texto-senado', label: 'Nuevo texto: 2/3 del Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'miembros' }, days: 30, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'referendum', onFail: null },
        { id: 'referendum', label: 'Referéndum obligatorio', kind: 'referendum', institution: 'Cuerpo electoral', days: 60, daysKind: 'modelo', ruleIds: ['es.reforma.agravada'], next: 'sancion', onFail: null },
        { id: 'sancion', label: 'Sanción real', kind: 'sancion', institution: 'Rey', vetoAllowed: false, days: 15, daysKind: 'legal', ruleIds: ['es.sancion'], next: 'publicacion' },
        { id: 'publicacion', label: 'Publicación en el BOE', kind: 'publicacion', institution: 'Boletín Oficial del Estado', days: 2, daysKind: 'modelo', ruleIds: [], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
  ],
  scenario: {
    start: '2026-10-06',
    firstElection: '2026-11-29',
    offices: ['congreso', 'senado'],
    note: 'Elecciones generales del 29 de noviembre de 2026 convocadas por el Real Decreto 806/2026. Partidos y candidatos ficticios. Las elecciones autonómicas y municipales no se simulan; los gobiernos autonómicos se asignan según el voto simulado.',
    inauguration: { congreso: '2026-12-23', senado: '2026-12-23' },
  },
  nextElections: (game, after) => {
    const last = [...game.elections].reverse().find((e) => e.office === 'congreso');
    const base = last ? last.date : '2026-11-29';
    let d = nextSunday(addYears(base, 4));
    while (d <= after) d = nextSunday(addYears(d, 4));
    return [{ date: d, offices: ['congreso', 'senado'], reason: 'Fin de la legislatura (cuatro años)' }];
  },
  installationDate: (_office, electionDate) => (electionDate === '2026-11-29' ? '2026-12-23' : addDays(electionDate, 24)),
  coverage: {
    implemented: [
      'Congreso de 350 diputados en 52 circunscripciones con D’Hondt y barrera del 3 %',
      'Investidura (art. 99): mayoría absoluta o simple a las 48 horas; disolución a los dos meses',
      'Negociación de coaliciones y apoyos con partidos nacionales y territoriales',
      'Moción de censura constructiva y cuestión de confianza',
      'Disolución anticipada con sus límites',
      'Ley ordinaria y orgánica con veto del Senado y su levantamiento',
      'Reforma ordinaria (art. 167) con referéndum facultativo y agravada (art. 168) con disolución y referéndum',
      'Competencias autonómicas en sanidad y educación; BCE y UE fuera del control del Gobierno',
    ],
    simplified: [
      'Senado: 3+1 escaños por provincia y senadores autonómicos repartidos por voto nacional',
      'Islas tratadas por provincia',
      'Enmiendas parlamentarias no modeladas',
      'Fecha de las siguientes elecciones: cuatro años después',
      'Gobiernos autonómicos asignados según el voto simulado (no hay elecciones autonómicas)',
    ],
    pending: ['Elecciones autonómicas y municipales', 'Decretos-leyes y su convalidación', 'Estados de alarma jugables', 'Recursos ante el Tribunal Constitucional jugables'],
  },
  procedureFor: (kind) => (kind === 'presupuesto' ? 'es.presupuesto' : kind === 'electoral-ley' || kind === 'organica' ? 'es.ley-organica' : 'es.ley'),
  turnoutFactor: 0.95,
};

export default es;
