import { COUNTRIES } from '../../data/countries';
import { APP_VERSION, FORMAT_VERSION, clone } from '../game';
import { hashString } from '../rng';
import type { GameState } from '../types';

// Guardado y versionado. Cada archivo lleva la versión de formato, la versión de reglas de la partida
// y una suma de verificación. Al cargar se valida la estructura; las reglas guardadas se respetan
// aunque el juego tenga reglas más nuevas (no se actualizan silenciosamente).

export interface SaveFile {
  format: 'naciones-guardado';
  formatVersion: number;
  appVersion: string;
  savedAt: string;
  label: string;
  rulesetVersion: string;
  checksum: string;
  state: GameState;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function checksum(state: GameState): string {
  return hashString(JSON.stringify(state)).toString(16);
}

export function serialize(state: GameState, label: string, savedAt = new Date().toISOString()): string {
  const f: SaveFile = { format: 'naciones-guardado', formatVersion: FORMAT_VERSION, appVersion: APP_VERSION, savedAt, label, rulesetVersion: state.rulesetVersion, checksum: checksum(state), state };
  return JSON.stringify(f);
}

export interface ParseResult {
  ok: boolean;
  state?: GameState;
  label?: string;
  errors: string[];
  warnings: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateState(s: unknown): string[] {
  const e: string[] = [];
  if (!isObj(s)) return ['El estado de la partida no es un objeto.'];
  if (s.format !== 'naciones-partida') e.push('Formato de partida desconocido.');
  if (typeof s.seed !== 'string' || !s.seed) e.push('Falta la semilla.');
  if (typeof s.country !== 'string' || !(s.country in COUNTRIES)) e.push('País no disponible.');
  if (typeof s.date !== 'string' || !DATE.test(s.date)) e.push('Fecha inválida.');
  if (typeof s.startDate !== 'string' || !DATE.test(s.startDate)) e.push('Fecha de inicio inválida.');
  if (typeof s.rulesetVersion !== 'string') e.push('Falta la versión de reglas.');
  if (!isObj(s.rules) || Object.keys(s.rules).length === 0) e.push('Faltan las reglas jurídicas de la partida.');
  else
    for (const [id, r] of Object.entries(s.rules)) {
      if (!isObj(r) || r.id !== id || !('value' in r) || typeof r.sourceId !== 'string' || typeof r.article !== 'string') {
        e.push(`Regla mal formada: ${id}`);
        break;
      }
    }
  for (const k of ['parties', 'legislators', 'procedures', 'elections', 'schedule', 'polls', 'log', 'decisions', 'history', 'reports', 'amendments', 'groups', 'regional', 'installs']) if (!Array.isArray(s[k])) e.push(`Falta la lista «${k}».`);
  if (Array.isArray(s.parties) && !s.parties.some((p) => isObj(p) && p.id === s.playerParty)) e.push('No se encuentra el partido del jugador.');
  if (!isObj(s.economy) || typeof (s.economy as Record<string, unknown>).debt !== 'number' || !Number.isFinite((s.economy as Record<string, unknown>).debt as number)) e.push('Datos económicos inválidos.');
  if (!isObj(s.fiscal) || !isObj((s.fiscal as Record<string, unknown>).spendingNominal)) e.push('Datos fiscales inválidos.');
  if (!isObj(s.government) || typeof (s.government as Record<string, unknown>).executiveParty !== 'string') e.push('Datos de gobierno inválidos.');
  if (Array.isArray(s.amendments))
    for (const a of s.amendments) if (!isObj(a) || typeof a.ruleId !== 'string' || !isObj(s.rules) || !(a.ruleId in (s.rules as object)) || !DATE.test(String(a.effectiveFrom))) {
      e.push('Enmienda inválida o referida a una regla inexistente.');
      break;
    }
  return e;
}

export function parseSave(text: string): ParseResult {
  let f: unknown;
  try {
    f = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido.'], warnings: [] };
  }
  if (!isObj(f) || f.format !== 'naciones-guardado') return { ok: false, errors: ['No es un archivo de partida de «Naciones: Poder y Consecuencias».'], warnings: [] };
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof f.formatVersion !== 'number' || f.formatVersion > FORMAT_VERSION) errors.push(`Versión de formato no compatible (${String(f.formatVersion)}).`);
  errors.push(...validateState(f.state));
  if (errors.length) return { ok: false, errors, warnings };
  const state = f.state as GameState;
  if (checksum(state) !== f.checksum) errors.push('La suma de verificación no coincide: el archivo está dañado o fue modificado.');
  if (errors.length) return { ok: false, errors, warnings };
  const current = COUNTRIES[state.country].rulesetVersion;
  if (current !== state.rulesetVersion) warnings.push(`La partida usa la versión de reglas ${state.rulesetVersion}; el juego tiene la ${current}. Se conservan las reglas de la partida.`);
  return { ok: true, state, label: String(f.label ?? ''), errors, warnings };
}

// ------------------------------------------------------------------ ranuras locales

const INDEX = 'naciones:indice';

export interface SlotInfo {
  id: string;
  label: string;
  savedAt: string;
  country: string;
  date: string;
  gameId: string;
  branchId: string;
  branchLabel: string;
}

export function listSlots(st: StorageLike): SlotInfo[] {
  try {
    const v = JSON.parse(st.getItem(INDEX) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveSlot(st: StorageLike, id: string, label: string, g: GameState): SlotInfo {
  const savedAt = new Date().toISOString();
  st.setItem(`naciones:ranura:${id}`, serialize(g, label, savedAt));
  const info: SlotInfo = { id, label, savedAt, country: g.country, date: g.date, gameId: g.id, branchId: g.branchId, branchLabel: g.branchLabel };
  const list = listSlots(st).filter((s) => s.id !== id);
  list.unshift(info);
  st.setItem(INDEX, JSON.stringify(list.slice(0, 30)));
  return info;
}

export function loadSlot(st: StorageLike, id: string): ParseResult {
  const t = st.getItem(`naciones:ranura:${id}`);
  if (!t) return { ok: false, errors: ['No existe esa partida guardada.'], warnings: [] };
  return parseSave(t);
}

export function deleteSlot(st: StorageLike, id: string) {
  st.removeItem(`naciones:ranura:${id}`);
  st.setItem(INDEX, JSON.stringify(listSlots(st).filter((s) => s.id !== id)));
}

/** Crea una rama: misma partida, misma semilla y mismo historial hasta este punto. */
export function createBranch(g: GameState, label: string): GameState {
  const b = clone(g);
  b.parentBranch = g.branchId;
  b.branchId = `rama-${hashString(label + g.date + Date.now()).toString(36)}`;
  b.branchLabel = label;
  b.branchPoint = g.date;
  return b;
}
