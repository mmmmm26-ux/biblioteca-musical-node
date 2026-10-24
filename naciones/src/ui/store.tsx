import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GameState } from '../engine/types';
import { saveSlot, type StorageLike } from '../engine/save/save';

export type Tab = 'resumen' | 'campana' | 'gobierno' | 'congreso' | 'constitucion' | 'mas';
export type MorePage = 'menu' | 'mapa' | 'indicadores' | 'noticias' | 'historial' | 'elecciones' | 'comparar' | 'guardar' | 'glosario' | 'fuentes' | 'acerca';

export type ModalState =
  | { kind: 'term'; id: string }
  | { kind: 'rule'; id: string }
  | { kind: 'why' }
  | { kind: 'custom'; title: string; body: ReactNode };

interface Ctx {
  game: GameState | null;
  setGame: (g: GameState | null) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  more: MorePage;
  setMore: (p: MorePage) => void;
  modal: ModalState | null;
  openModal: (m: ModalState | null) => void;
  toast: string | null;
  notify: (m: string) => void;
  storage: StorageLike;
  autosave: (g: GameState, reason: string) => void;
  tutorial: boolean;
  setTutorial: (b: boolean) => void;
}

const C = createContext<Ctx | null>(null);

export const memoryStorage = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

function safeStorage(): StorageLike {
  try {
    const k = '__naciones_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

export function Provider({ children }: { children: ReactNode }) {
  const [game, setGameRaw] = useState<GameState | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [more, setMore] = useState<MorePage>('menu');
  const [modal, openModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const storage = useMemo(safeStorage, []);
  const notify = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 4200);
  }, []);
  const autosave = useCallback(
    (g: GameState, reason: string) => {
      try {
        saveSlot(storage, `auto-${g.branchId}`, `Autoguardado (${reason})`, g);
      } catch {
        // almacenamiento lleno o no disponible: se ignora sin romper la partida
      }
    },
    [storage],
  );
  const setGame = useCallback(
    (g: GameState | null) => {
      setGameRaw(g);
      if (g) {
        try {
          saveSlot(storage, `ultima-${g.branchId}`, 'Última sesión', g);
        } catch {
          /* sin espacio */
        }
      }
    },
    [storage],
  );
  return <C.Provider value={{ game, setGame, tab, setTab, more, setMore, modal, openModal, toast, notify, storage, autosave, tutorial, setTutorial }}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('Fuera del proveedor');
  return c;
}

export function useGame(): GameState {
  const { game } = useApp();
  if (!game) throw new Error('No hay partida');
  return game;
}
