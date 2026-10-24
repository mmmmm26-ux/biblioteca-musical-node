import type { CountryModule, ReformRouting } from '../../engine/country';
import type { GameState, RuleValue, Territory } from '../../engine/types';
import { cmp, usElectionDay, year } from '../../engine/calendar';
import { num, ruleAt } from '../../engine/legal/rules';
import { makeGroups } from './groups';
import { rule } from './helpers';

// ESTADOS UNIDOS — República presidencial federal. Congreso bicameral.
// Versión de reglas: 2026-10-23.

// [abreviatura, nombre, población 2020 para el reparto (miles), escaños en la Cámara (reparto 2020), urbanización, inclinación, columna, fila]
// La "inclinación" es un PARÁMETRO DEL JUEGO aproximado inspirado en patrones electorales históricos; no es un dato oficial.
const STATES: [string, string, number, number, number, number, number, number][] = [
  ['AK', 'Alaska', 736, 1, 0.65, 0.2, 0, 0], ['ME', 'Maine', 1364, 2, 0.39, -0.05, 10, 0],
  ['WI', 'Wisconsin', 5897, 8, 0.67, 0.0, 5, 1], ['VT', 'Vermont', 644, 1, 0.35, -0.3, 9, 1], ['NH', 'Nuevo Hampshire', 1379, 2, 0.58, -0.03, 10, 1],
  ['WA', 'Washington', 7716, 10, 0.83, -0.17, 0, 2], ['ID', 'Idaho', 1841, 2, 0.69, 0.38, 1, 2], ['MT', 'Montana', 1085, 2, 0.53, 0.2, 2, 2], ['ND', 'Dakota del Norte', 780, 1, 0.61, 0.38, 3, 2],
  ['MN', 'Minesota', 5710, 8, 0.72, -0.04, 4, 2], ['IL', 'Illinois', 12823, 17, 0.88, -0.12, 5, 2], ['MI', 'Míchigan', 10084, 13, 0.74, 0.0, 6, 2], ['NY', 'Nueva York', 20216, 26, 0.87, -0.18, 8, 2], ['MA', 'Massachusetts', 7033, 9, 0.92, -0.3, 9, 2],
  ['OR', 'Oregón', 4242, 6, 0.8, -0.12, 0, 3], ['NV', 'Nevada', 3108, 4, 0.94, 0.0, 1, 3], ['WY', 'Wyoming', 578, 1, 0.64, 0.48, 2, 3], ['SD', 'Dakota del Sur', 888, 1, 0.57, 0.33, 3, 3], ['IA', 'Iowa', 3192, 4, 0.63, 0.12, 4, 3],
  ['IN', 'Indiana', 6790, 9, 0.72, 0.2, 5, 3], ['OH', 'Ohio', 11809, 15, 0.78, 0.1, 6, 3], ['PA', 'Pensilvania', 13012, 17, 0.78, 0.01, 7, 3], ['NJ', 'Nueva Jersey', 9294, 12, 0.94, -0.1, 8, 3], ['CT', 'Connecticut', 3608, 5, 0.86, -0.15, 9, 3], ['RI', 'Rhode Island', 1098, 2, 0.91, -0.2, 10, 3],
  ['CA', 'California', 39577, 52, 0.94, -0.25, 0, 4], ['UT', 'Utah', 3275, 4, 0.89, 0.28, 1, 4], ['CO', 'Colorado', 5782, 8, 0.86, -0.08, 2, 4], ['NE', 'Nebraska', 1963, 3, 0.73, 0.24, 3, 4], ['MO', 'Misuri', 6160, 8, 0.7, 0.2, 4, 4],
  ['KY', 'Kentucky', 4509, 6, 0.58, 0.3, 5, 4], ['WV', 'Virginia Occidental', 1795, 2, 0.45, 0.44, 6, 4], ['VA', 'Virginia', 8655, 11, 0.75, -0.06, 7, 4], ['MD', 'Maryland', 6185, 8, 0.87, -0.25, 8, 4], ['DE', 'Delaware', 991, 1, 0.82, -0.12, 9, 4],
  ['AZ', 'Arizona', 7159, 9, 0.89, 0.03, 1, 5], ['NM', 'Nuevo México', 2120, 3, 0.74, -0.07, 2, 5], ['KS', 'Kansas', 2941, 4, 0.72, 0.2, 3, 5], ['AR', 'Arkansas', 3014, 4, 0.55, 0.34, 4, 5], ['TN', 'Tennessee', 6917, 9, 0.66, 0.3, 5, 5],
  ['NC', 'Carolina del Norte', 10454, 14, 0.67, 0.04, 6, 5], ['SC', 'Carolina del Sur', 5125, 7, 0.66, 0.17, 7, 5], ['DC', 'Distrito de Columbia', 690, 0, 1.0, -0.6, 8, 5],
  ['OK', 'Oklahoma', 3964, 5, 0.66, 0.38, 3, 6], ['LA', 'Luisiana', 4661, 6, 0.72, 0.25, 4, 6], ['MS', 'Misisipi', 2964, 4, 0.46, 0.25, 5, 6], ['AL', 'Alabama', 5030, 7, 0.58, 0.34, 6, 6], ['GA', 'Georgia', 10725, 14, 0.74, 0.02, 7, 6],
  ['HI', 'Hawái', 1460, 2, 0.86, -0.25, 0, 7], ['TX', 'Texas', 29183, 38, 0.83, 0.1, 3, 7], ['FL', 'Florida', 21571, 28, 0.91, 0.08, 8, 7],
];

// Clases del Senado (dato institucional de referencia, pendiente de cotejo).
const CLASS1 = 'AZ CA CT DE FL HI IN ME MD MA MI MN MS MO MT NE NV NJ NM NY ND OH PA RI TN TX UT VT VA WA WV WI WY'.split(' ');
const CLASS3 = 'AL AK AZ AR CA CO CT FL GA HI ID IL IN IA KS KY LA MD MO NV NH NY NC ND OH OK OR PA SC SD UT VT WA WI'.split(' ');

function classesOf(abbr: string): number[] {
  if (abbr === 'DC') return [];
  const c: number[] = [];
  if (CLASS1.includes(abbr)) c.push(1);
  if (CLASS3.includes(abbr)) c.push(3);
  while (c.length < 2) c.push(2);
  return c.sort();
}

const territories: Territory[] = STATES.map(([ab, name, pop, seats, urban, lean, col, row]) => ({
  id: `us-${ab.toLowerCase()}`,
  name,
  short: ab,
  pop,
  urban,
  lean: { econ: lean * 0.5, social: lean * 0.8 },
  grid: [col, row],
  seats: { camara: seats, senado: ab === 'DC' ? 0 : 2, electores: ab === 'DC' ? 3 : seats + 2 },
  senateClasses: classesOf(ab),
}));

const HOUSE_2020: Record<string, number> = Object.fromEntries(STATES.filter((s) => s[0] !== 'DC').map((s) => [`us-${s[0].toLowerCase()}`, s[3]]));

function amendment(game: GameState, ruleId: string, value: RuleValue, notes: string[] = []): ReformRouting {
  const same = ruleAt(game, ruleId).value === value;
  return {
    allowed: !same,
    normType: 'constitucion',
    procedureId: 'us.enmienda',
    blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
    notes: [
      'Requiere enmienda constitucional (Artículo V): 2/3 de los presentes en cada cámara y ratificación por 3/4 de los estados (38 de 50).',
      'El Presidente no firma ni puede vetar una enmienda propuesta por el Congreso.',
      'La vía de convención a petición de 2/3 de los estados no está modelada (nunca se ha usado).',
      ...notes,
    ],
    initiators: 'Cualquier miembro del Congreso puede presentar la resolución conjunta',
    ruleIds: ['us.enmienda.propuesta', 'us.enmienda.ratificacion', 'us.enmienda.plazo'],
  };
}

const us: CountryModule = {
  id: 'us',
  name: 'Estados Unidos',
  officialName: 'Estados Unidos de América',
  status: 'simplificado',
  system: {
    executive: 'presidencial',
    territorial: 'federal',
    label: 'República presidencial federal',
    summary:
      'El Presidente se elige indirectamente mediante el Colegio Electoral. El Congreso tiene dos cámaras con poderes equivalentes para legislar. Los 50 estados tienen constituciones, gobiernos y competencias propias (educación, policía, gran parte del derecho penal y civil).',
  },
  rulesetVersion: '2026-10-23',
  territoryLabel: 'Estados',
  sources: [
    { id: 'us-const', title: 'Constitución de los Estados Unidos y enmiendas', publisher: 'National Archives / Congress.gov (Constitution Annotated)', url: 'https://constitution.congress.gov/constitution/', kind: 'constitucion', published: '1787-09-17', inForce: '1789-03-04', note: 'La fecha de publicación indica la firma en la Convención; entró en vigor en 1789.' },
    { id: 'us-artv', title: 'Artículo V y su interpretación (2/3 de los presentes)', publisher: 'Constitution Annotated (Library of Congress), vía Cornell LII', url: 'https://www.law.cornell.edu/constitution-conan/article-5/congressional-proposals-of-amendments', kind: 'oficial' },
    { id: 'us-conan-veto', title: 'Art. I, secc. 7, cl. 2: el poder de veto (Constitution Annotated)', publisher: 'Library of Congress, vía Cornell LII', url: 'https://www.law.cornell.edu/constitution-conan/article-1/section-7/clause-2/the-veto-power', kind: 'oficial' },
    { id: 'us-crs-contingent', title: 'Election of the President and Vice President by Congress: Contingent Election (RL32695)', publisher: 'Congressional Research Service', url: 'https://www.everycrsreport.com/reports/RL32695.html', kind: 'oficial' },
    { id: 'us-2usc2a', title: '2 U.S.C. § 2a — Reparto de representantes', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section2a', kind: 'ley' },
    { id: 'us-2usc2c', title: '2 U.S.C. § 2c — Distritos uninominales', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section2c', kind: 'ley' },
    { id: 'us-3usc1', title: '3 U.S.C. § 1 — Fecha de la elección de electores', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title3-section1', kind: 'ley' },
    { id: 'us-senate', title: 'Reglamento del Senado, Regla XXII (cloture)', publisher: 'U.S. Senate Committee on Rules and Administration', url: 'https://www.rules.senate.gov/rules-of-the-senate', kind: 'reglamento' },
    { id: 'us-budget', title: 'Congressional Budget Act de 1974 y 31 U.S.C. § 1102 (año fiscal)', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/', kind: 'ley' },
    { id: 'us-nea', title: 'National Emergencies Act, 50 U.S.C. § 1601 y ss.', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/', kind: 'ley', inForce: '1976-09-14' },
    { id: 'us-fra', title: 'Federal Reserve Act', publisher: 'Board of Governors of the Federal Reserve System', url: 'https://www.federalreserve.gov/aboutthefed/fract.htm', kind: 'ley' },
    { id: 'us-flsa', title: 'Fair Labor Standards Act — salario mínimo federal', publisher: 'U.S. Department of Labor', url: 'https://www.dol.gov/agencies/whd/minimum-wage', kind: 'ley' },
    { id: 'us-census', title: 'Datos de reparto del Censo 2020', publisher: 'U.S. Census Bureau', url: 'https://www.census.gov/data/tables/2020/dec/2020-apportionment-data.html', kind: 'estadistica' },
    { id: 'us-cbo', title: 'Monthly Budget Review: Summary for Fiscal Year 2025', publisher: 'Congressional Budget Office', url: 'https://www.cbo.gov/publication/61307', kind: 'estadistica' },
    { id: 'us-crfb', title: 'Ingresos y gastos del año fiscal 2025', publisher: 'Committee for a Responsible Federal Budget', url: 'https://www.crfb.org/blogs/12-month-deficit-totals-17-trillion-debt-approaches-100-gdp', kind: 'secundaria' },
    { id: 'us-bls', title: 'Desempleo e IPC', publisher: 'Bureau of Labor Statistics', url: 'https://www.bls.gov/', kind: 'estadistica' },
    { id: 'us-bea', title: 'PIB', publisher: 'Bureau of Economic Analysis', url: 'https://www.bea.gov/', kind: 'estadistica' },
    { id: 'us-trade', title: 'Facultades arancelarias: Art. I § 8 y delegaciones legales (p. ej. 19 U.S.C. § 1862)', publisher: 'Office of the Law Revision Counsel', url: 'https://uscode.house.gov/', kind: 'ley' },
  ],
  rules: [
    rule('us.presidente.mandato', 'ejecutivo', 'Duración del mandato presidencial', 'El Presidente ejerce un mandato de cuatro años.', 4, 'constitucion', 'us-const', 'Art. II, secc. 1', 'por-cotejar'),
    rule('us.presidente.limite', 'ejecutivo', 'Límite de reelección', 'Nadie puede ser elegido Presidente más de dos veces (22.ª Enmienda, ratificada en 1951).', 2, 'constitucion', 'us-const', 'Enmienda XXII', 'por-cotejar', { inForce: '1951-02-27' }),
    rule('us.presidente.metodo', 'electoral', 'Elección presidencial', 'Cada estado elige electores (tantos como representantes y senadores; Washington D. C. tiene 3). Gana quien obtiene la mayoría absoluta de los electores: 270 de 538.', 'colegio-electoral', 'constitucion', 'us-crs-contingent', 'Art. II, secc. 1; Enmiendas XII y XXIII', 'contrastada'),
    rule('us.presidente.contingente', 'electoral', 'Elección contingente', 'Si nadie alcanza la mayoría de electores, la Cámara de Representantes elige entre los tres más votados; cada delegación estatal tiene un voto y se necesita la mayoría de los estados (26). Por precedente de 1825 (no vinculante), una delegación sin mayoría interna cuenta como dividida.', 'camara-por-estados', 'constitucion', 'us-crs-contingent', 'Enmienda XII', 'contrastada'),
    rule('us.presidente.requisitos', 'ejecutivo', 'Requisitos para ser Presidente', 'Ciudadano por nacimiento, al menos 35 años y 14 años de residencia en el país.', 'texto', 'constitucion', 'us-const', 'Art. II, secc. 1, cl. 5', 'por-cotejar'),
    rule('us.inicio', 'ejecutivo', 'Inicio de mandatos', 'El mandato presidencial comienza el 20 de enero; el del Congreso, el 3 de enero.', '01-20', 'constitucion', 'us-const', 'Enmienda XX, secc. 1', 'por-cotejar'),
    rule('us.eleccion.fecha', 'electoral', 'Día de la elección federal', 'El martes siguiente al primer lunes de noviembre de los años pares.', 'martes-noviembre', 'ley-ordinaria', 'us-3usc1', '3 U.S.C. § 1; 2 U.S.C. § 7', 'por-cotejar'),
    rule('us.colegio.reparto', 'electoral', 'Asignación de electores en cada estado', 'Cada estado decide por ley cómo asigna sus electores. 48 estados y D. C. dan todos sus electores al más votado; Maine y Nebraska usan también distritos. El juego aplica "el ganador se lleva todo" en todos (simplificación).', 'ganador-total', 'estatuto', 'us-const', 'Art. II, secc. 1, cl. 2', 'simplificacion'),
    rule('us.camara.miembros', 'legislativo', 'Tamaño de la Cámara de Representantes', 'La Cámara tiene 435 miembros, cifra fijada por ley, no por la Constitución.', 435, 'ley-ordinaria', 'us-2usc2a', '2 U.S.C. § 2a', 'por-cotejar'),
    rule('us.camara.reparto', 'electoral', 'Reparto de escaños entre estados', 'Los escaños se reparten tras cada censo con el método Huntington-Hill (proporciones iguales); cada estado tiene al menos uno.', HOUSE_2020, 'ley-ordinaria', 'us-census', '2 U.S.C. § 2a; Censo 2020', 'por-cotejar'),
    rule('us.camara.distritos', 'electoral', 'Distritos uninominales', 'Cada representante se elige en un distrito de un solo escaño por mayoría relativa (regla general; algunos estados usan segunda vuelta o voto preferencial: no modelado).', 'uninominal', 'ley-ordinaria', 'us-2usc2c', '2 U.S.C. § 2c', 'por-cotejar'),
    rule('us.camara.mandato', 'legislativo', 'Mandato de los representantes', 'Los representantes se eligen cada dos años.', 2, 'constitucion', 'us-const', 'Art. I, secc. 2', 'por-cotejar'),
    rule('us.senado.miembros', 'legislativo', 'Composición del Senado', 'Dos senadores por estado (100), elegidos por voto popular desde la 17.ª Enmienda (1913).', 100, 'constitucion', 'us-const', 'Art. I, secc. 3; Enmienda XVII', 'por-cotejar'),
    rule('us.senado.mandato', 'legislativo', 'Mandato de los senadores', 'Seis años; un tercio del Senado se renueva cada dos años (tres "clases").', 6, 'constitucion', 'us-const', 'Art. I, secc. 3', 'por-cotejar'),
    rule('us.requisitos.congreso', 'legislativo', 'Requisitos para el Congreso', 'Representantes: 25 años y 7 de ciudadanía. Senadores: 30 años y 9 de ciudadanía. Ambos deben residir en el estado.', 'texto', 'constitucion', 'us-const', 'Art. I, secc. 2 y 3', 'por-cotejar'),
    rule('us.ley.mayoria', 'legislativo', 'Aprobación de leyes', 'Un proyecto debe aprobarse en idéntico texto por ambas cámaras (mayoría de los votos) y presentarse al Presidente.', 'simple', 'constitucion', 'us-const', 'Art. I, secc. 7', 'por-cotejar'),
    rule('us.senado.cloture', 'legislativo', 'Cierre del debate en el Senado (filibusterismo)', 'Para cerrar el debate de la mayoría de los proyectos se necesitan 3/5 de los senadores (60). Es una regla del reglamento del Senado, no de la Constitución.', 0.6, 'reglamento-parlamentario', 'us-senate', 'Regla XXII', 'por-cotejar', {
      controversy: 'El Senado ha eliminado este umbral para nombramientos mediante precedentes por mayoría simple (2013 y 2017). Hacerlo para leyes es políticamente controvertido.',
    }),
    rule('us.veto', 'legislativo', 'Veto presidencial', 'El Presidente tiene 10 días (sin contar domingos) para firmar o vetar. El Congreso supera el veto con 2/3 de cada cámara, entendidos como 2/3 de los presentes con quórum.', 10, 'constitucion', 'us-conan-veto', 'Art. I, secc. 7, cl. 2', 'contrastada', { verificationNote: 'El "veto de bolsillo" (si el Congreso suspende sesiones) no está modelado.' }),
    rule('us.tributos.origen', 'presupuesto', 'Origen de las leyes tributarias', 'Los proyectos para recaudar ingresos deben originarse en la Cámara de Representantes.', 'camara', 'constitucion', 'us-const', 'Art. I, secc. 7, cl. 1', 'por-cotejar'),
    rule('us.presupuesto', 'presupuesto', 'Presupuesto federal', 'El Presidente presenta una propuesta; el Congreso aprueba las asignaciones. El año fiscal empieza el 1 de octubre. Las asignaciones están sujetas al filibusterismo; la "reconciliación presupuestaria" sólo requiere mayoría simple en el Senado.', 'texto', 'ley-ordinaria', 'us-budget', '2 U.S.C. § 621 y ss.; 31 U.S.C. § 1102', 'por-cotejar'),
    rule('us.presupuesto.sin-aprobar', 'presupuesto', 'Si no se aprueban asignaciones', 'En el juego se aplica automáticamente una resolución de continuidad con los importes nominales anteriores. El cierre del gobierno no está modelado.', 'continuidad', 'ley-ordinaria', 'us-budget', '—', 'simplificacion'),
    rule('us.deuda.limite', 'presupuesto', 'Límite de deuda', 'Existe un límite legal de deuda (31 U.S.C. § 3101). No está modelado en esta versión.', 'no-modelado', 'ley-ordinaria', 'us-budget', '31 U.S.C. § 3101', 'pendiente'),
    rule('us.enmienda.propuesta', 'reforma', 'Propuesta de enmienda', 'El Congreso propone enmiendas con 2/3 de los presentes en cada cámara (con quórum), o una convención las propone a petición de 2/3 de los estados.', '2/3-presentes', 'constitucion', 'us-artv', 'Art. V', 'contrastada'),
    rule('us.enmienda.ratificacion', 'reforma', 'Ratificación de enmiendas', 'Una enmienda entra en vigor cuando la ratifican 3/4 de los estados (38 de 50), por sus legislaturas o por convenciones.', 0.75, 'constitucion', 'us-artv', 'Art. V', 'contrastada'),
    rule('us.enmienda.limite', 'reforma', 'Límite material', 'Ningún estado puede ser privado de su igualdad de voto en el Senado sin su consentimiento.', 'igualdad-senado', 'constitucion', 'us-artv', 'Art. V, cláusula final', 'contrastada'),
    rule('us.enmienda.plazo', 'reforma', 'Plazo de ratificación', 'El Congreso suele fijar un plazo de siete años para ratificar. El juego aplica siete años y hace que cada legislatura estatal decida una vez (simplificación).', 7, 'constitucion', 'us-const', 'Práctica del Congreso', 'simplificacion'),
    rule('us.enmienda.convencion', 'reforma', 'Convención de enmienda', 'Vía nunca utilizada; no modelada.', 'no-modelado', 'constitucion', 'us-artv', 'Art. V', 'pendiente'),
    rule('us.impeachment', 'control', 'Juicio político (impeachment)', 'La Cámara acusa por mayoría; el Senado juzga y condena con 2/3 de los presentes, por "traición, cohecho u otros delitos y faltas graves". No jugable en esta versión.', 'texto', 'constitucion', 'us-const', 'Art. I, secc. 2-3; Art. II, secc. 4', 'por-cotejar'),
    rule('us.control', 'judicial', 'Control de constitucionalidad', 'Los tribunales federales, con el Tribunal Supremo a la cabeza (9 jueces por ley), pueden inaplicar leyes contrarias a la Constitución (doctrina establecida en Marbury v. Madison, 1803).', 'judicial-difuso', 'constitucion', 'us-const', 'Art. III; 28 U.S.C. § 1', 'por-cotejar'),
    rule('us.federalismo', 'territorial', 'Federalismo', 'El Congreso sólo tiene los poderes enumerados (Art. I, secc. 8); los demás quedan para los estados o el pueblo (10.ª Enmienda). El derecho federal válido prevalece (Art. VI).', 'federal', 'constitucion', 'us-const', 'Art. I, secc. 8; Art. VI; Enmienda X', 'por-cotejar'),
    rule('us.emergencia', 'emergencia', 'Emergencias', 'La National Emergencies Act regula las emergencias declaradas por el Presidente; el Congreso puede terminarlas. El hábeas corpus sólo puede suspenderse en caso de rebelión o invasión. No jugable en esta versión.', 'texto', 'ley-ordinaria', 'us-nea', '50 U.S.C. § 1601 y ss.; Art. I, secc. 9', 'por-cotejar'),
    rule('us.fed', 'economia', 'Banco central independiente', 'La Reserva Federal fija la política monetaria con independencia operativa; el Presidente nombra a sus gobernadores con confirmación del Senado.', 'independiente', 'ley-ordinaria', 'us-fra', 'Federal Reserve Act', 'por-cotejar'),
    rule('us.comercio', 'economia', 'Aranceles', 'La Constitución atribuye al Congreso los impuestos y el comercio exterior; varias leyes delegan facultades arancelarias al Presidente. El juego modela los cambios arancelarios como ley del Congreso.', 'ley', 'ley-ordinaria', 'us-trade', 'Art. I, secc. 8, cl. 1 y 3', 'simplificacion', { controversy: 'El alcance de las facultades arancelarias delegadas al Presidente ha sido litigado; su estado no se cotejó en esta versión.' }),
    rule('us.salario-minimo', 'economia', 'Salario mínimo federal', 'El salario mínimo federal lo fija una ley del Congreso (FLSA). Los estados pueden fijar mínimos más altos.', 'ley', 'ley-ordinaria', 'us-flsa', '29 U.S.C. § 206', 'por-cotejar'),
  ],
  territories,
  chambers: [
    { id: 'camara', name: 'Cámara de Representantes', short: 'Cámara', membersRule: 'us.camara.miembros', termRule: 'us.camara.mandato', system: 'smd', seatKey: 'camara', discipline: 0.78 },
    { id: 'senado', name: 'Senado', short: 'Senado', membersRule: 'us.senado.miembros', termRule: 'us.senado.mandato', system: 'senado-clases', seatKey: 'senado', discipline: 0.72, upper: true },
  ],
  executive: { title: 'Presidente de los Estados Unidos', kind: 'presidencial', methodRule: 'us.presidente.metodo', termRule: 'us.presidente.mandato', limitRule: 'us.presidente.limite', headOfState: 'Presidente' },
  parties: [
    { id: 'us-pac', name: 'Partido del Pacto Social', short: 'PPS', color: '#0f766e', econ: -0.35, social: -0.35, priorities: ['salud', 'empleo', 'costo-vida'], strength: 0.75, establishedSeats: true },
    { id: 'us-fro', name: 'Partido de la Frontera', short: 'PF', color: '#c2410c', econ: 0.35, social: 0.35, priorities: ['impuestos', 'seguridad', 'empleo'], strength: 0.75, establishedSeats: true },
    { id: 'us-ver', name: 'Movimiento Verde Continental', short: 'MVC', color: '#15803d', econ: -0.6, social: -0.6, priorities: ['medioambiente', 'salud', 'instituciones'], strength: 0.18 },
    { id: 'us-lib', name: 'Partido Libertad Individual', short: 'PLI', color: '#7c3aed', econ: 0.7, social: -0.25, priorities: ['impuestos', 'instituciones', 'empleo'], strength: 0.18 },
  ],
  interestGroups: makeGroups('Cámara empresarial nacional (ficticia)', 'Federación sindical (ficticia)', 'Coalición cívica (ficticia)'),
  economy: {
    currency: 'US$',
    nominalGDP: 30300,
    gdpYear: 2025,
    debtPct: 99.8,
    deficitPct: 5.9,
    unemployment: 4.3,
    inflation: 2.7,
    poverty: 10.6,
    povertyDef: 'Tasa oficial de pobreza (aprox.)',
    potentialGrowth: 1.8,
    naturalUnemployment: 4.2,
    okun: 0.5,
    openness: 1.0,
    policyRate: 3.75,
    monetary: 'propia',
    monetaryNote: 'La Reserva Federal fija el tipo de interés con independencia. En el juego responde a la inflación y a la actividad con una regla de Taylor (parámetros C).',
    marketRate: 4.2,
    riskThreshold: 130,
    interestPct: 3.2,
    inflationTarget: 2.0,
    fiscalYearStartMonth: 10,
    observed: [
      { key: 'deficit', label: 'Déficit federal año fiscal 2025', value: '5,9 % del PIB (≈ 1,8 billones de US$)', sourceId: 'us-cbo', year: 'AF 2025', verification: 'contrastada' },
      { key: 'deuda', label: 'Deuda en manos del público', value: '99,8 % del PIB', sourceId: 'us-cbo', year: 'fin AF 2025', verification: 'contrastada' },
      { key: 'ingresos', label: 'Ingresos y gastos federales', value: 'Ingresos ≈ 5,2 y gastos ≈ 7,0 billones de US$', sourceId: 'us-crfb', year: 'AF 2025', verification: 'contrastada' },
      { key: 'pib', label: 'PIB nominal', value: '≈ 30,3 billones de US$', sourceId: 'us-bea', year: '2025', verification: 'por-cotejar' },
      { key: 'desempleo', label: 'Desempleo', value: '≈ 4,3 %', sourceId: 'us-bls', year: '2025', verification: 'por-cotejar' },
      { key: 'inflacion', label: 'Inflación (IPC)', value: '≈ 2,7 %', sourceId: 'us-bls', year: '2025', verification: 'por-cotejar' },
    ],
  },
  budget: [
    { id: 'salud', name: 'Salud (Medicare, Medicaid y otros)', desc: 'Programas federales de salud; Medicaid se cofinancia con los estados.', basePct: 6.2, competence: 'mixta', adjustable: true, multiplier: 0.6, lag: 6, service: 'salud', issue: 'salud', note: 'Gran parte es gasto obligatorio fijado por leyes de autorización; cambiarlo exige modificar esas leyes (simplificado aquí como partida).' },
    { id: 'educacion', name: 'Educación (federal)', desc: 'Subvenciones a estados y distritos escolares. La mayor parte del gasto educativo es estatal y local.', basePct: 0.5, competence: 'territorial', adjustable: true, multiplier: 0.6, lag: 8, service: 'educacion', issue: 'educacion', note: 'Competencia principalmente estatal: el gasto federal sólo complementa.' },
    { id: 'seguridad', name: 'Defensa y seguridad', desc: 'Defensa nacional, seguridad interior y justicia federal.', basePct: 3.3, competence: 'nacional', adjustable: true, multiplier: 0.5, lag: 5, service: 'seguridad', issue: 'seguridad' },
    { id: 'infraestructura', name: 'Infraestructura y transporte', desc: 'Subvenciones para carreteras, transporte y agua.', basePct: 0.6, competence: 'mixta', adjustable: true, multiplier: 0.8, lag: 12, service: 'infraestructura', issue: 'infraestructura' },
    { id: 'proteccion', name: 'Seguridad Social y protección de ingresos', desc: 'Pensiones públicas, desempleo y ayudas a familias.', basePct: 7.4, competence: 'nacional', adjustable: true, multiplier: 0.65, lag: 3, issue: 'costo-vida', note: 'Gasto obligatorio en su mayoría.' },
    { id: 'empleo', name: 'Formación y empleo', desc: 'Programas de formación laboral.', basePct: 0.2, competence: 'mixta', adjustable: true, multiplier: 0.6, lag: 8, issue: 'empleo' },
    { id: 'medioambiente', name: 'Medioambiente y energía', desc: 'Agencias ambientales y programas energéticos.', basePct: 0.2, competence: 'mixta', adjustable: true, multiplier: 0.5, lag: 12, issue: 'medioambiente' },
    { id: 'administracion', name: 'Administración y otros', desc: 'Veteranos, administración federal y otros programas.', basePct: 1.5, competence: 'nacional', adjustable: true, multiplier: 0.45, lag: 4, issue: 'instituciones' },
  ],
  taxes: [
    { id: 'renta', name: 'Impuesto federal sobre la renta', desc: 'Índice de la carga efectiva (100 = legislación actual).', basePct: 8.6, unit: 'indice', base: 100, min: 80, max: 125, step: 5, multiplier: -0.35, competence: 'nacional' },
    { id: 'sociedades', name: 'Impuesto de sociedades', desc: 'Índice de la carga efectiva.', basePct: 1.5, unit: 'indice', base: 100, min: 70, max: 140, step: 5, multiplier: -0.25, competence: 'nacional' },
    { id: 'cotizaciones', name: 'Impuestos sobre nóminas', desc: 'Índice de cotizaciones de Seguridad Social y Medicare.', basePct: 5.8, unit: 'indice', base: 100, min: 85, max: 120, step: 5, multiplier: -0.3, competence: 'nacional' },
    { id: 'aranceles', name: 'Aranceles', desc: 'Arancel medio efectivo sobre importaciones (%).', basePct: 0.6, unit: 'tipo', base: 10, min: 0, max: 30, step: 1, multiplier: -0.3, competence: 'nacional', note: 'Valor inicial aproximado (pendiente de cotejo). Suben precios y pueden provocar represalias comerciales.' },
    { id: 'consumo', name: 'Impuesto sobre ventas', desc: 'No existe un impuesto federal general sobre ventas: lo fijan los estados.', basePct: 0, unit: 'tipo', base: 0, min: 0, max: 0, step: 1, multiplier: 0, competence: 'territorial', note: 'Competencia estatal: el Gobierno federal no puede fijarlo en el juego.' },
  ],
  regulations: [
    { id: 'salario-minimo', name: 'Salario mínimo federal', desc: 'Índice del salario mínimo federal real (100 = actual).', base: 100, min: 90, max: 200, step: 10, unit: 'índice', normType: 'ley-ordinaria', procedureId: 'us.ley', competence: 'Congreso (ley federal); los estados pueden fijar mínimos superiores', enabled: true, ruleIds: ['us.salario-minimo'], econDir: -0.6, socialDir: 0 },
    { id: 'regulacion-ambiental', name: 'Exigencia ambiental federal', desc: 'Nivel de exigencia de la regulación ambiental federal (0-100).', base: 50, min: 10, max: 90, step: 10, unit: 'nivel', normType: 'ley-ordinaria', procedureId: 'us.ley', competence: 'Congreso; agencias federales; estados', enabled: true, ruleIds: ['us.ley.mayoria'], econDir: -0.4, socialDir: -0.3 },
  ],
  reforms: [
    {
      id: 'us-voto-popular', title: 'Elegir al Presidente por voto popular nacional', area: 'electoral', ruleId: 'us.presidente.metodo',
      question: '¿Debe sustituirse el Colegio Electoral por la elección directa de quien obtenga más votos en todo el país?',
      options: [{ value: 'voto-popular', label: 'Voto popular nacional (mayoría relativa)' }, { value: 'colegio-electoral', label: 'Colegio Electoral (vigente)' }],
      classify: (v, g) => amendment(g, 'us.presidente.metodo', v, ['Los estados pequeños suelen oponerse porque perderían el peso extra que les dan sus dos electores "senatoriales".']),
      transitional: { kind: 'siguiente-eleccion', office: 'presidencia', text: 'Se aplica desde la siguiente elección presidencial tras la ratificación.' },
      qualitative: {
        legal: 'Modifica el Art. II y la 12.ª Enmienda.',
        political: 'Las campañas dejarían de concentrarse en estados disputados; cambian los incentivos de los partidos.',
        social: 'Cada voto pesaría igual en todo el país.',
        economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Votantes de estados no disputados', 'Estados muy poblados'],
        costs: ['Estados pequeños y estados disputados (pierden atención)'],
        uncertainty: 'Escenario cualitativo; el resultado electoral bajo la nueva regla lo calcula el motor.',
        timeline: 'Años: la ratificación estatal suele ser lenta.',
      },
      position: { econ: 0, social: -0.3 }, intensity: 0.5,
    },
    {
      id: 'us-camara-4', title: 'Mandato de 4 años para la Cámara', area: 'legislativo', ruleId: 'us.camara.mandato',
      question: '¿Deben los representantes elegirse cada cuatro años en lugar de dos?',
      options: [{ value: 4, label: '4 años' }, { value: 2, label: '2 años (vigente)' }],
      classify: (v, g) => amendment(g, 'us.camara.mandato', v),
      transitional: { kind: 'siguiente-mandato', office: 'camara', text: 'Rige para la Cámara elegida en la siguiente elección; el juego alinea sus elecciones con las presidenciales.' },
      qualitative: {
        legal: 'Modifica el Art. I, secc. 2.',
        political: 'Menos campañas permanentes; menor frecuencia de control electoral.',
        social: 'La ciudadanía votaría a sus representantes con menos frecuencia.',
        economic: 'Menores costos de campaña (no cuantificado).',
        beneficiaries: ['Representantes en ejercicio'],
        costs: ['Capacidad del electorado de corregir el rumbo a mitad de mandato'],
        uncertainty: 'Escenario cualitativo.',
        timeline: 'Años.',
      },
      position: { econ: 0, social: 0.05 }, intensity: 0.35,
    },
    {
      id: 'us-tamano', title: 'Ampliar la Cámara de Representantes', area: 'legislativo', ruleId: 'us.camara.miembros',
      question: '¿Cuántos miembros debe tener la Cámara? (Basta una ley: la cifra de 435 está en el Código de EE. UU.)',
      options: [{ value: 535, label: '535 miembros' }, { value: 600, label: '600 miembros' }, { value: 435, label: '435 (vigente)' }],
      classify: (v, g) => {
        const same = ruleAt(g, 'us.camara.miembros').value === v;
        return {
          allowed: !same, normType: 'ley-ordinaria', procedureId: 'us.ley', blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
          notes: ['Es una ley ordinaria: Cámara, Senado (con filibusterismo) y firma o veto presidencial.', 'Los escaños se repartirían entre estados con el método Huntington-Hill sobre la población del Censo 2020.', 'Cambia también el número de electores presidenciales.'],
          initiators: 'Cualquier miembro del Congreso', ruleIds: ['us.camara.miembros', 'us.senado.cloture', 'us.veto'],
        };
      },
      transitional: { kind: 'siguiente-eleccion', office: 'camara', text: 'Se aplica en la siguiente elección de la Cámara (en la realidad, el nuevo reparto suele seguir al censo).' },
      qualitative: {
        legal: 'Reforma de 2 U.S.C. § 2a.',
        political: 'Distritos más pequeños; el Colegio Electoral se acerca algo más a la población.',
        social: 'Representantes con menos electores cada uno.',
        economic: 'Coste administrativo pequeño (no cuantificado).',
        beneficiaries: ['Estados con población creciente'],
        costs: ['Presupuesto del Congreso'],
        uncertainty: 'El reparto entre estados se calcula; el efecto político es incierto.',
        timeline: 'Próxima elección de la Cámara.',
      },
      position: { econ: 0, social: -0.1 }, intensity: 0.3,
    },
    {
      id: 'us-limite', title: 'Cambiar el límite de mandatos presidenciales', area: 'ejecutivo', ruleId: 'us.presidente.limite',
      question: '¿Cuántas veces puede ser elegida una misma persona Presidente?',
      options: [{ value: 1, label: 'Una sola vez' }, { value: 3, label: 'Hasta tres veces' }, { value: 2, label: 'Dos veces (vigente)' }],
      classify: (v, g) => amendment(g, 'us.presidente.limite', v),
      transitional: { kind: 'siguiente-eleccion', office: 'presidencia', text: 'Se aplica a las elecciones presidenciales posteriores a la ratificación.' },
      qualitative: {
        legal: 'Modifica la 22.ª Enmienda.',
        political: 'Más límites fuerzan la renovación; menos límites permiten continuidad de presidentes populares.',
        social: 'Afecta la alternancia en el poder.',
        economic: 'Sin efecto económico directo modelado.',
        beneficiaries: ['Depende del contexto'],
        costs: ['Depende del contexto'],
        uncertainty: 'Escenario cualitativo.',
        timeline: 'Años.',
      },
      position: { econ: 0, social: 0 }, intensity: 0.4,
    },
    {
      id: 'us-filibuster', title: 'Eliminar el filibusterismo para leyes', area: 'legislativo', ruleId: 'us.senado.cloture',
      question: '¿Debe el Senado poder cerrar el debate de cualquier ley por mayoría simple?',
      options: [{ value: 0.5, label: 'Mayoría simple (sin filibusterismo)' }, { value: 0.6, label: '3/5 (vigente)' }],
      classify: (v, g) => {
        const same = ruleAt(g, 'us.senado.cloture').value === v;
        return {
          allowed: !same, normType: 'reglamento-parlamentario', procedureId: 'us.reglamento-senado', blockers: same ? ['El valor propuesto coincide con la regla vigente.'] : [],
          notes: ['No requiere ley ni enmienda: es una regla interna del Senado. Modificar formalmente la Regla XXII exige 2/3 para cerrar el debate; en la práctica el Senado ha usado precedentes por mayoría simple ("opción nuclear"). El juego modela la vía del precedente.'],
          initiators: 'Líder de la mayoría del Senado', ruleIds: ['us.senado.cloture'],
        };
      },
      transitional: { kind: 'inmediata', text: 'Efecto inmediato para las votaciones posteriores.' },
      qualitative: {
        legal: 'Cambio del procedimiento interno del Senado.',
        political: 'Facilita legislar a la mayoría y reduce el poder de bloqueo de la minoría; el cambio puede volverse contra quien lo impulsa cuando cambie la mayoría.',
        social: 'Mayor capacidad de respuesta legislativa; menos protección de minorías parlamentarias.',
        economic: 'Puede aumentar la volatilidad de las políticas.',
        beneficiaries: ['Mayoría del Senado en cada momento'],
        costs: ['Minoría del Senado'],
        uncertainty: 'Escenario cualitativo.',
        timeline: 'Inmediato.',
      },
      controversy: 'Controvertido: algunos lo consideran un uso abusivo de los precedentes del Senado.',
      position: { econ: 0, social: 0 }, intensity: 0.35,
    },
  ],
  shortcuts: [
    { id: 'orden-ejecutiva', label: 'Aplicar el cambio con una orden ejecutiva', explain: 'Inválido: una orden ejecutiva no puede modificar la Constitución ni una ley; el Artículo V es la única vía de enmienda.', ruleIds: ['us.enmienda.propuesta'] },
    { id: 'referendum-nacional', label: 'Someterlo a un referéndum nacional', explain: 'Inválido: la Constitución federal no prevé referéndums nacionales; la ratificación corresponde a los estados.', ruleIds: ['us.enmienda.ratificacion'] },
  ],
  procedures: [
    {
      id: 'us.ley', name: 'Ley federal', normType: 'ley-ordinaria', first: 'camara', initiators: 'Miembros del Congreso (las tributarias deben originarse en la Cámara)', ruleIds: ['us.ley.mayoria', 'us.senado.cloture', 'us.veto'],
      steps: [
        { id: 'camara', label: 'Votación en la Cámara de Representantes', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'simple' }, days: 40, daysKind: 'modelo', ruleIds: ['us.ley.mayoria', 'us.tributos.origen'], next: 'cloture' },
        { id: 'cloture', label: 'Cierre del debate en el Senado (cloture)', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 3, den: 5, base: 'miembros' }, majorityFromRule: 'us.senado.cloture', days: 30, daysKind: 'modelo', ruleIds: ['us.senado.cloture'], next: 'senado' },
        { id: 'senado', label: 'Votación final en el Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'simple' }, days: 3, daysKind: 'modelo', ruleIds: ['us.ley.mayoria'], next: 'sancion', explain: 'Empate: decide el Vicepresidente (el juego lo asigna al partido del Ejecutivo).' },
        { id: 'sancion', label: 'Firma o veto del Presidente', kind: 'sancion', institution: 'Presidencia', vetoAllowed: true, days: 12, daysKind: 'legal', ruleIds: ['us.veto'], next: 'vigencia', onFail: 'override-camara', explain: '10 días sin contar domingos (≈ 12 naturales).' },
        { id: 'override-camara', label: 'Superar el veto en la Cámara (2/3 presentes)', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'override-senado', onFail: null },
        { id: 'override-senado', label: 'Superar el veto en el Senado (2/3 presentes)', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'vigencia', onFail: null },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null, explain: 'Salvo que la ley fije otra fecha, rige desde su promulgación.' },
      ],
    },
    {
      id: 'us.presupuesto', name: 'Ley de asignaciones (presupuesto)', normType: 'ley-presupuesto', first: 'camara', initiators: 'Comités de Asignaciones del Congreso, a partir de la propuesta presidencial', ruleIds: ['us.presupuesto', 'us.senado.cloture', 'us.veto'],
      steps: [
        { id: 'camara', label: 'Votación en la Cámara', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'simple' }, days: 40, daysKind: 'modelo', ruleIds: ['us.presupuesto'], next: 'cloture' },
        { id: 'cloture', label: 'Cierre del debate en el Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 3, den: 5, base: 'miembros' }, majorityFromRule: 'us.senado.cloture', days: 25, daysKind: 'modelo', ruleIds: ['us.senado.cloture'], next: 'senado' },
        { id: 'senado', label: 'Votación final en el Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'simple' }, days: 3, daysKind: 'modelo', ruleIds: ['us.presupuesto'], next: 'sancion' },
        { id: 'sancion', label: 'Firma o veto del Presidente', kind: 'sancion', institution: 'Presidencia', vetoAllowed: true, days: 12, daysKind: 'legal', ruleIds: ['us.veto'], next: 'vigencia', onFail: 'override-camara' },
        { id: 'override-camara', label: 'Superar el veto en la Cámara', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'override-senado', onFail: null },
        { id: 'override-senado', label: 'Superar el veto en el Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'vigencia', onFail: null },
        { id: 'vigencia', label: 'Vigencia para el año fiscal', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'us.reconciliacion', name: 'Reconciliación presupuestaria', normType: 'ley-ordinaria', first: 'camara', initiators: 'Comités de Presupuesto (requiere resolución presupuestaria; simplificado)', ruleIds: ['us.presupuesto', 'us.veto'],
      notes: 'Sólo puede contener medidas con efecto presupuestario (regla Byrd). No está sujeta a filibusterismo.',
      steps: [
        { id: 'camara', label: 'Votación en la Cámara', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'simple' }, days: 40, daysKind: 'modelo', ruleIds: ['us.presupuesto', 'us.tributos.origen'], next: 'senado' },
        { id: 'senado', label: 'Votación en el Senado (mayoría simple)', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'simple' }, days: 20, daysKind: 'modelo', ruleIds: ['us.presupuesto'], next: 'sancion' },
        { id: 'sancion', label: 'Firma o veto del Presidente', kind: 'sancion', institution: 'Presidencia', vetoAllowed: true, days: 12, daysKind: 'legal', ruleIds: ['us.veto'], next: 'vigencia', onFail: 'override-camara' },
        { id: 'override-camara', label: 'Superar el veto en la Cámara', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'override-senado', onFail: null },
        { id: 'override-senado', label: 'Superar el veto en el Senado', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 14, daysKind: 'modelo', ruleIds: ['us.veto'], next: 'vigencia', onFail: null },
        { id: 'vigencia', label: 'Entrada en vigor', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
    {
      id: 'us.enmienda', name: 'Enmienda constitucional (Artículo V)', normType: 'constitucion', first: 'camara', initiators: 'Congreso (resolución conjunta)', ruleIds: ['us.enmienda.propuesta', 'us.enmienda.ratificacion'],
      steps: [
        { id: 'camara', label: 'Propuesta en la Cámara (2/3 de los presentes)', kind: 'votacion', institution: 'Cámara de Representantes', chamber: 'camara', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 60, daysKind: 'modelo', ruleIds: ['us.enmienda.propuesta'], next: 'senado' },
        { id: 'senado', label: 'Propuesta en el Senado (2/3 de los presentes)', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'cualificada', num: 2, den: 3, base: 'presentes' }, days: 45, daysKind: 'modelo', ruleIds: ['us.enmienda.propuesta'], next: 'estados' },
        { id: 'estados', label: 'Ratificación por 3/4 de los estados (38)', kind: 'ratificacion-territorial', institution: 'Legislaturas estatales', fraction: { num: 3, den: 4 }, days: 2555, daysKind: 'modelo', ruleIds: ['us.enmienda.ratificacion', 'us.enmienda.plazo'], next: 'vigencia' },
        { id: 'vigencia', label: 'Entrada en vigor tras la ratificación', kind: 'vigencia', institution: 'Archivero de los EE. UU. (certificación)', days: 0, daysKind: 'modelo', ruleIds: ['us.enmienda.ratificacion'], next: null },
      ],
    },
    {
      id: 'us.reglamento-senado', name: 'Cambio de práctica del Senado (precedente)', normType: 'reglamento-parlamentario', first: 'senado', initiators: 'Líder de la mayoría', ruleIds: ['us.senado.cloture'],
      steps: [
        { id: 'senado', label: 'Votación del precedente en el Senado (mayoría simple)', kind: 'votacion', institution: 'Senado', chamber: 'senado', majority: { kind: 'simple' }, days: 10, daysKind: 'modelo', ruleIds: ['us.senado.cloture'], next: 'vigencia' },
        { id: 'vigencia', label: 'Efecto inmediato', kind: 'vigencia', institution: '—', days: 0, daysKind: 'modelo', ruleIds: [], next: null },
      ],
    },
  ],
  scenario: {
    start: '2028-08-01',
    firstElection: '2028-11-07',
    offices: ['presidencia', 'camara', 'senado'],
    note: 'Escenario de campaña para la elección general del 7 de noviembre de 2028 (Presidencia, toda la Cámara y la clase III del Senado). Datos económicos de base 2025. Partidos y candidatos ficticios; los gobiernos estatales se simulan.',
    inauguration: { presidencia: '2029-01-20', camara: '2029-01-03', senado: '2029-01-03' },
  },
  nextElections: (game, after) => {
    for (let y = 2028; y < 2200; y += 2) {
      const d = usElectionDay(y);
      if (cmp(d, after) <= 0) continue;
      const offices = ['senado'];
      const houseTerm = num(game, 'us.camara.mandato', d);
      const lastHouse = [...game.elections].reverse().find((e) => e.office === 'camara');
      const lastHouseYear = lastHouse ? year(lastHouse.date) : 2026;
      if (y - lastHouseYear >= houseTerm) offices.push('camara');
      const presTerm = num(game, 'us.presidente.mandato', d);
      if ((y - 2028) % presTerm === 0) offices.unshift('presidencia');
      return [{ date: d, offices, reason: offices.includes('presidencia') ? 'Elección general' : 'Elecciones de mitad de mandato' }];
    }
    return [];
  },
  installationDate: (office, electionDate) => (office === 'presidencia' ? `${year(electionDate) + 1}-01-20` : `${year(electionDate) + 1}-01-03`),
  coverage: {
    implemented: [
      'Colegio Electoral (270 de 538) y elección contingente en la Cámara por delegaciones estatales',
      'Cámara de 435 distritos uninominales por mayoría relativa, reparto por estados del Censo 2020',
      'Senado de 100 miembros con tres clases',
      'Ley federal con filibusterismo (60 votos), veto y superación con 2/3',
      'Reconciliación presupuestaria por mayoría simple',
      'Enmiendas del Artículo V con ratificación de 38 estados',
      'Gobiernos estatales simulados (competencias en educación y policía)',
    ],
    simplified: [
      'Distritos: geografía partidista simulada con semilla, no mapas reales',
      'Maine y Nebraska tratados como "el ganador se lleva todo"',
      'Primarias no simuladas',
      'Cada legislatura estatal decide una vez sobre una enmienda',
      'Resolución de continuidad automática si no hay presupuesto',
    ],
    pending: ['Elecciones estatales y locales', 'Juicio político', 'Límite de deuda y cierre del gobierno', 'Emergencias nacionales jugables', 'Nombramientos judiciales'],
  },
  procedureFor: (kind) => (kind === 'presupuesto' ? 'us.presupuesto' : 'us.ley'),
  turnoutFactor: 0.92,
};

export default us;
