// Tipos centrales del juego. Todo el estado de la partida es JSON serializable.

export type ISODate = string; // 'AAAA-MM-DD'
export type CountryId = 'sv' | 'us' | 'es';

/**
 * Nivel de verificación de una regla jurídica.
 * - contrastada: confirmada en esta versión con fuentes oficiales o reproducciones del texto oficial.
 * - por-cotejar: tomada del texto oficial según el conocimiento del equipo, sin cotejo directo en esta versión.
 *   Se usa en el juego, pero se marca visiblemente como pendiente de cotejo.
 * - simplificacion: aproximación de juego; no es derecho vigente.
 * - pendiente: no verificada; las acciones que dependen de ella quedan desactivadas.
 */
export type Verification = 'contrastada' | 'por-cotejar' | 'simplificacion' | 'pendiente';

/** Capas de información que la interfaz distingue. */
export type Layer = 'juridica' | 'observada' | 'simulacion';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: 'constitucion' | 'reforma' | 'ley' | 'decreto' | 'reglamento' | 'jurisprudencia' | 'estadistica' | 'oficial' | 'secundaria';
  /** Fecha de publicación oficial, si se conoce. */
  published?: ISODate;
  /** Fecha de entrada en vigor, si se conoce (distinta de la publicación). */
  inForce?: ISODate;
  note?: string;
}

export type RuleValue = number | string | boolean | Record<string, number>;

export type RuleCategory =
  | 'ejecutivo'
  | 'legislativo'
  | 'electoral'
  | 'judicial'
  | 'territorial'
  | 'presupuesto'
  | 'reforma'
  | 'control'
  | 'emergencia'
  | 'economia';

export interface LegalRule {
  id: string;
  category: RuleCategory;
  title: string;
  /** Explicación en lenguaje sencillo. */
  plain: string;
  value: RuleValue;
  /** Tipo de norma donde vive la regla (determina cómo se puede cambiar). */
  normLevel: NormType;
  sourceId: string;
  article: string;
  consulted: ISODate;
  published?: ISODate;
  inForce?: ISODate;
  until?: ISODate | null;
  verification: Verification;
  verificationNote?: string;
  controversy?: string;
}

export interface Amendment {
  id: string;
  ruleId: string;
  previous: RuleValue;
  value: RuleValue;
  /** Desde cuándo se aplica (respeta entrada en vigor y transitorias). */
  effectiveFrom: ISODate;
  procedureId: string;
  label: string;
  transitional: string;
}

// ---------------------------------------------------------------- mayorías

export type Majority =
  | { kind: 'simple' }
  | { kind: 'absoluta' }
  | { kind: 'cualificada'; num: number; den: number; base: 'miembros' | 'presentes' };

export interface VoteTally {
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  members: number;
}

// ---------------------------------------------------------------- normas y procedimientos

export type NormType =
  | 'constitucion'
  | 'ley-ordinaria'
  | 'ley-organica'
  | 'ley-presupuesto'
  | 'decreto-ejecutivo'
  | 'decreto-ley'
  | 'reglamento-parlamentario'
  | 'estatuto';

export type StepKind =
  | 'votacion' // una cámara vota; pasa si alcanza la mayoría
  | 'veto-camara' // segunda cámara: pasa salvo que una mayoría vete (Senado español)
  | 'espera' // plazo que debe transcurrir
  | 'sancion' // el Ejecutivo/Jefe del Estado sanciona; puede vetar si vetoAllowed
  | 'solicitud-referendum' // plazo para que una fracción pida referéndum
  | 'referendum'
  | 'ratificacion-territorial' // p. ej. 3/4 de los estados
  | 'disolucion-elecciones' // disolución y nueva legislatura (art. 168 CE)
  | 'nueva-legislatura' // esperar a que se instale la siguiente legislatura
  | 'publicacion'
  | 'vigencia';

export interface StepDef {
  id: string;
  label: string;
  kind: StepKind;
  institution: string;
  chamber?: string;
  majority?: Majority;
  /** La fracción exigida se lee de una regla (p. ej. cloture del Senado). Si es <= 1/2 el paso se omite. */
  majorityFromRule?: string;
  /** Plazo o duración en días. */
  days?: number;
  /** 'legal' = plazo establecido por norma; 'modelo' = duración aproximada del juego. */
  daysKind?: 'legal' | 'modelo';
  ruleIds: string[];
  next: string | null; // siguiente paso si se supera (null = fin con éxito)
  onFail?: string | null; // paso si no se supera (null/undefined = rechazo)
  vetoAllowed?: boolean;
  /** Para ratificación territorial: fracción requerida. */
  fraction?: { num: number; den: number };
  /** Para solicitud de referéndum: fracción de miembros de cualquier cámara. */
  requestFraction?: { num: number; den: number };
  explain?: string;
}

export interface ProcedureDef {
  id: string;
  name: string;
  normType: NormType;
  first: string;
  steps: StepDef[];
  ruleIds: string[];
  initiators: string;
  notes?: string;
}

export type ProcedureStatus = 'en-tramite' | 'rechazada' | 'vigente' | 'anulada' | 'invalida';

export interface StepRecord {
  stepId: string;
  label: string;
  date: ISODate;
  outcome: 'superado' | 'no-superado' | 'vetado' | 'en-espera' | 'info';
  detail: string;
  tally?: VoteTally & { required: number; chamber: string; byParty?: Record<string, { yes: number; no: number; abstain: number }> };
}

export interface ProcedureInstance {
  id: string;
  defId: string;
  title: string;
  proposal: Proposal;
  proposerParty: string;
  startedOn: ISODate;
  currentStep: string | null;
  nextActionOn: ISODate;
  status: ProcedureStatus;
  log: StepRecord[];
  publishedOn?: ISODate;
  inForceOn?: ISODate;
  waitingDecision?: string; // id de PendingDecision
  /** Fecha de la primera votación (para plazos como el art. 99.5 CE). */
  meta?: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------- propuestas

export type ProposalKind = 'presupuesto' | 'tributaria' | 'sectorial' | 'reforma';

export interface Concession {
  partyId: string;
  kind: 'prioridad' | 'inversion-territorial' | 'coalicion' | 'moderacion';
  label: string;
  cost: number; // costo presupuestario anual en % del PIB (si aplica)
  value: number; // valor para el partido (0..1)
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  normType: NormType;
  procedureId: string;
  /** Cambios de políticas (palancas) */
  levers?: Record<string, number>;
  /** Presupuesto: gasto por categoría en % del PIB */
  budget?: Record<string, number>;
  fiscalYear?: number;
  /** Reforma institucional */
  reformId?: string;
  reformValue?: RuleValue;
  /** Posición ideológica percibida del cambio (-1..1 en cada eje) */
  position: { econ: number; social: number };
  intensity: number; // 0..1: cuánto se aleja del statu quo
  concessions: Concession[];
}

// ---------------------------------------------------------------- territorio, electores, partidos

export type IssueId =
  | 'empleo'
  | 'costo-vida'
  | 'salud'
  | 'educacion'
  | 'seguridad'
  | 'impuestos'
  | 'medioambiente'
  | 'instituciones'
  | 'infraestructura';

export interface Segment {
  id: string;
  name: string;
  desc: string;
  econ: number; // -1 (más intervención/redistribución) .. 1 (más mercado)
  social: number; // -1 (más liberal/progresista) .. 1 (más tradicional/orden)
  spread: number; // dispersión interna: los grupos no son bloques uniformes
  turnout: number; // propensión base a votar (0..1)
  priorities: Partial<Record<IssueId, number>>;
}

export interface Territory {
  id: string;
  name: string;
  short: string;
  group?: string; // comunidad autónoma, región
  pop: number; // población (miles) o peso relativo
  urban: number; // 0..1
  lean: { econ: number; social: number };
  identity?: number; // peso de identidad territorial propia (0..1)
  grid: [number, number];
  seats: Record<string, number>;
  senateClasses?: number[]; // EE. UU.
}

export interface PartyTemplate {
  id: string;
  name: string;
  short: string;
  color: string;
  econ: number;
  social: number;
  priorities: IssueId[];
  strength: number; // implantación organizativa (0..1)
  regionalGroups?: string[]; // si es un partido territorial: grupos donde concurre
  establishedSeats?: boolean;
  incumbent?: boolean;
}

export interface Party extends PartyTemplate {
  valence: number; // popularidad/competencia percibida (-1..1)
  isPlayer: boolean;
  leader: string;
  funds: number; // recursos de campaña (unidades de juego)
  promises: string[];
}

export interface Legislator {
  id: string;
  chamber: string;
  territory: string;
  party: string;
  econ: number;
  social: number;
  discipline: number; // 0..1
  termEnds: ISODate;
}

// ---------------------------------------------------------------- economía

export interface EconomyState {
  realIndex: number; // PIB real (índice 100 = inicio)
  potentialIndex: number;
  priceLevel: number; // 1 = inicio
  priceHistory: number[]; // últimos 13 niveles mensuales
  realHistory: number[]; // últimos 13 valores del PIB real
  inflation: number; // % anual
  unemployment: number; // %
  naturalUnemployment: number;
  poverty: number; // % población
  policyRate: number; // tipo de interés de referencia (%)
  effectiveDebtRate: number; // coste medio de la deuda (%)
  debt: number; // stock nominal (miles de millones de moneda local)
  nominalGDPBase: number; // PIB nominal anual inicial (miles de millones)
  privateShock: number; // componente de demanda privada (brecha)
  impulses: Record<string, number>; // impulso fiscal suavizado por categoría
  services: Record<string, number>; // calidad de servicios 0..100
  adminCapacity: number; // 0..100
  environment: number; // 0..100
  trust: number; // confianza institucional 0..100
  approval: number; // aprobación del Ejecutivo 0..100
  segmentApproval: Record<string, number>;
  coreInflation: number;
  /** Gasto real absorbido por la administración (capacidad de ejecución), por categoría */
  absorbed: Record<string, number>;
  /** Flujos de los últimos 12 meses (moneda nominal) */
  flows: { rev: number[]; spend: number[]; int: number[]; gdp: number[] };
  /** Choques pendientes que se disipan con el tiempo */
  shocks: { prices: number; trust: number; approval: number; rate: number; services: Record<string, number> };
}

export interface FiscalPolicy {
  /** gasto anual por categoría en % del PIB potencial nominal al aprobarse el presupuesto */
  spendingPct: Record<string, number>;
  /** gasto nominal anual congelado en el presupuesto vigente */
  spendingNominal: Record<string, number>;
  fiscalYear: number;
  approvedBy: 'ley' | 'prorroga' | 'inicial';
  levers: Record<string, number>;
}

// ---------------------------------------------------------------- explicaciones

export type CauseKind = 'decision' | 'evento' | 'aleatorio' | 'tendencia' | 'institucional';

export interface Contribution {
  indicator: string;
  kind: CauseKind;
  label: string;
  value: number;
}

export interface TurnReport {
  from: ISODate;
  to: ISODate;
  deltas: Record<string, number>;
  contributions: Contribution[];
  notes: string[];
}

// ---------------------------------------------------------------- registro, noticias, decisiones

export type LogKind =
  | 'inicio'
  | 'campana'
  | 'encuesta'
  | 'eleccion'
  | 'gobierno'
  | 'investidura'
  | 'procedimiento'
  | 'votacion'
  | 'ley-vigente'
  | 'reforma-vigente'
  | 'rechazo'
  | 'intento-invalido'
  | 'evento'
  | 'economia'
  | 'tribunal'
  | 'grupo'
  | 'decision'
  | 'guardado';

export interface LogEntry {
  id: string;
  date: ISODate;
  kind: LogKind;
  title: string;
  detail: string;
  layer: Layer;
  data?: Record<string, unknown>;
}

export interface PendingDecision {
  id: string;
  kind: 'sancion' | 'solicitud-referendum' | 'voto-investidura' | 'voto-ley';
  title: string;
  detail: string;
  procedureId?: string;
  deadline: ISODate;
  options: { id: string; label: string; explain: string }[];
}

export interface ElectionResult {
  id: string;
  date: ISODate;
  office: string; // 'presidencia' | id de cámara
  system: string;
  turnout: number;
  national: Record<string, number>; // % voto válido
  seats?: Record<string, number>;
  byTerritory: Record<string, { shares: Record<string, number>; seats?: Record<string, number>; winner?: string; electors?: number }>;
  winner?: string;
  electors?: Record<string, number>;
  runoff?: { shares: Record<string, number>; winner: string; date: ISODate };
  contingent?: { winner: string; detail: string };
  notes: string[];
  rulesUsed: string[];
}

export interface Poll {
  date: ISODate;
  sample: number;
  shares: Record<string, number>;
  moe: number; // margen de error (pp) al 95 %
  label: string;
}

export interface ScheduledElection {
  date: ISODate;
  offices: string[];
  reason: string;
}

export type Phase = 'campana' | 'resultados' | 'formacion' | 'gobierno' | 'fin';

export interface GovernmentState {
  executiveParty: string;
  executiveName: string;
  coalition: string[];
  supportParties: string[];
  since: ISODate;
  termEnds?: ISODate;
  /** Presidente electo pendiente de toma de posesión */
  electParty?: string;
  electInauguration?: ISODate;
  termsServed: Record<string, number>;
  /** España: estado de la formación de gobierno */
  formation?: {
    firstVoteOn?: ISODate;
    deadline?: ISODate;
    attempts: { candidateParty: string; date: ISODate; vote: 1 | 2; yes: number; no: number; abstain: number; passed: boolean }[];
    offers: Record<string, string>; // partyId -> tipo de oferta aceptada
    caretaker: string;
  };
}

export interface RegionalGovernment {
  group: string;
  party: string;
}

export interface InterestGroup {
  id: string;
  name: string;
  kind: 'empresas' | 'sindicatos' | 'civil';
  mood: number; // -1 .. 1
  prefs: Record<string, number>; // palanca o categoría -> dirección preferida
}

export interface GameState {
  format: 'naciones-partida';
  formatVersion: number;
  id: string; // identificador de la partida original (compartido por ramas)
  branchId: string;
  branchLabel: string;
  parentBranch?: string;
  branchPoint?: ISODate;
  seed: string;
  country: CountryId;
  rulesetVersion: string;
  rules: Record<string, LegalRule>; // copia fechada de las reglas al crear la partida
  amendments: Amendment[];
  difficulty: 'facil' | 'normal' | 'dificil';
  createdAt: string;
  date: ISODate;
  startDate: ISODate;
  phase: Phase;
  playerParty: string;
  playerRole: 'candidato' | 'gobierno' | 'oposicion';
  candidateName: string;
  parties: Party[];
  legislators: Legislator[];
  regional: RegionalGovernment[];
  groups: InterestGroup[];
  government: GovernmentState;
  economy: EconomyState;
  fiscal: FiscalPolicy;
  pendingFiscal?: FiscalPolicy; // presupuesto aprobado que entra en vigor al iniciar el ejercicio
  /** Orientación acumulada de las políticas vigentes (-1..1), usada por actores y votantes */
  policy: { econ: number; social: number };
  /** Tomas de posesión pendientes tras una elección */
  installs: { date: ISODate; office: string; legislators?: Legislator[]; seatIds?: string[]; winner?: string; electionId: string }[];
  procedures: ProcedureInstance[];
  elections: ElectionResult[];
  schedule: ScheduledElection[];
  polls: Poll[];
  log: LogEntry[];
  decisions: PendingDecision[];
  history: { date: ISODate; ind: Record<string, number> }[];
  reports: TurnReport[];
  campaign: { round: number; visited: string[]; focus: IssueId[]; mobilization: Record<string, number>; debateDone: boolean };
  counters: { seq: number; turn: number };
  lastElectionShown?: string;
  tutorialDone?: boolean;
}
