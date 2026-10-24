import type {
  CountryId,
  GameState,
  InterestGroup,
  ISODate,
  IssueId,
  LegalRule,
  NormType,
  PartyTemplate,
  ProcedureDef,
  RuleValue,
  ScheduledElection,
  Source,
  Territory,
  Verification,
} from './types';

// Contrato que cumple cada módulo de país. Para añadir un país basta con crear un módulo
// que implemente esta interfaz y registrarlo en src/data/countries/index.ts.

export interface ChamberDef {
  id: string;
  name: string;
  short: string;
  membersRule: string;
  termRule: string;
  system: 'dhondt' | 'smd' | 'senado-clases' | 'voto-limitado';
  seatKey: string;
  discipline: number;
  upper?: boolean;
  /** Miembros no elegidos directamente (p. ej. senadores autonómicos en España). */
  designated?: { count: number; ruleId: string; note: string };
}

export interface ExecutiveDef {
  title: string;
  kind: 'presidencial' | 'parlamentario';
  methodRule: string;
  termRule?: string;
  limitRule?: string;
  headOfState: string;
}

export interface BudgetCategoryDef {
  id: string;
  name: string;
  desc: string;
  basePct: number; // % del PIB al inicio (dato aproximado)
  competence: 'nacional' | 'territorial' | 'mixta';
  adjustable: boolean;
  note?: string;
  multiplier: number; // multiplicador de demanda (parámetro C)
  lag: number; // meses característicos de efecto
  service?: string; // servicio afectado
  issue?: IssueId;
}

export interface TaxDef {
  id: string;
  name: string;
  desc: string;
  basePct: number; // recaudación en % del PIB
  unit: 'indice' | 'tipo';
  base: number; // valor inicial (índice 100 o tipo legal)
  min: number;
  max: number;
  step: number;
  multiplier: number; // efecto de demanda por punto de PIB recaudado (negativo)
  competence: 'nacional' | 'territorial' | 'supranacional' | 'no-aplica';
  note?: string;
  ruleId?: string;
}

export interface RegulationLeverDef {
  id: string;
  name: string;
  desc: string;
  base: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  normType: NormType;
  procedureId: string;
  competence: string;
  enabled: boolean;
  disabledReason?: string;
  ruleIds: string[];
  econDir: number; // percepción ideológica por unidad de cambio relativo
  socialDir: number;
}

export interface EconomyBaseline {
  currency: string;
  nominalGDP: number; // miles de millones, moneda local, año base
  gdpYear: number;
  debtPct: number;
  deficitPct: number;
  unemployment: number;
  inflation: number;
  poverty: number;
  povertyDef: string;
  potentialGrowth: number;
  naturalUnemployment: number;
  okun: number;
  openness: number; // escala de multiplicadores (fuga por importaciones)
  policyRate: number;
  monetary: 'propia' | 'eurosistema' | 'dolarizada';
  monetaryNote: string;
  marketRate: number;
  riskThreshold: number;
  interestPct: number;
  inflationTarget: number;
  fiscalYearStartMonth: number; // 1 = enero, 10 = octubre
  /** Fuentes y nivel de verificación de cada dato observado. */
  observed: { key: string; label: string; value: string; sourceId: string; year: string; verification: Verification }[];
}

export interface ReformOption {
  value: RuleValue;
  label: string;
}

export interface ReformRouting {
  allowed: boolean;
  normType: NormType;
  procedureId?: string;
  routes?: { id: string; label: string; procedureId: string }[];
  blockers: string[];
  notes: string[];
  initiators: string;
  ruleIds: string[];
}

export interface ReformDef {
  id: string;
  title: string;
  question: string;
  area: 'ejecutivo' | 'legislativo' | 'electoral' | 'territorial' | 'corona';
  ruleId: string;
  options: ReformOption[];
  classify: (value: RuleValue, game: GameState) => ReformRouting;
  transitional: { kind: 'inmediata' | 'siguiente-eleccion' | 'siguiente-mandato'; office?: string; text: string };
  qualitative: { legal: string; political: string; social: string; economic: string; beneficiaries: string[]; costs: string[]; uncertainty: string; timeline: string };
  controversy?: string;
  position: { econ: number; social: number };
  intensity: number;
}

export interface Shortcut {
  id: string;
  label: string;
  explain: string; // por qué es inválido
  ruleIds: string[];
}

export interface CountryModule {
  id: CountryId;
  name: string;
  officialName: string;
  status: 'completo' | 'simplificado';
  system: { executive: 'presidencial' | 'parlamentario'; territorial: 'unitario' | 'federal' | 'autonomico'; label: string; summary: string };
  rulesetVersion: ISODate;
  rules: LegalRule[];
  sources: Source[];
  territories: Territory[];
  territoryLabel: string;
  groups?: { id: string; name: string }[];
  chambers: ChamberDef[];
  executive: ExecutiveDef;
  parties: PartyTemplate[];
  interestGroups: InterestGroup[];
  economy: EconomyBaseline;
  budget: BudgetCategoryDef[];
  taxes: TaxDef[];
  regulations: RegulationLeverDef[];
  reforms: ReformDef[];
  shortcuts: Shortcut[];
  procedures: ProcedureDef[];
  scenario: {
    start: ISODate;
    firstElection: ISODate;
    offices: string[];
    note: string;
    inauguration: Record<string, ISODate>;
  };
  /** Calcula elecciones futuras a partir de las reglas vigentes en la partida. */
  nextElections: (game: GameState, after: ISODate) => ScheduledElection[];
  /** Fecha de inicio de la nueva legislatura/mandato tras una elección. */
  installationDate: (office: string, electionDate: ISODate, game: GameState) => ISODate;
  coverage: { implemented: string[]; simplified: string[]; pending: string[] };
  /** Procedimiento para una ley según su tipo. */
  procedureFor: (kind: 'presupuesto' | 'tributaria' | 'sectorial' | 'electoral-ley' | 'organica') => string;
  turnoutFactor: number;
}
