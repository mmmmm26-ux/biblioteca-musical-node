import { cmp } from '../calendar';
import type { Amendment, GameState, ISODate, LegalRule, RuleValue } from '../types';

// Resolución de reglas vigentes: la copia fechada de la partida + enmiendas aprobadas en la
// partida cuya fecha de efecto ya llegó. Una actualización del juego nunca altera game.rules.

export function ruleAt(game: GameState, id: string, date: ISODate = game.date): { rule: LegalRule; value: RuleValue; amendment?: Amendment } {
  const rule = game.rules[id];
  if (!rule) throw new Error(`Regla desconocida: ${id}`);
  let value = rule.value;
  let amendment: Amendment | undefined;
  const list = game.amendments.filter((a) => a.ruleId === id && cmp(a.effectiveFrom, date) <= 0).sort((a, b) => cmp(a.effectiveFrom, b.effectiveFrom));
  for (const a of list) {
    value = a.value;
    amendment = a;
  }
  return { rule, value, amendment };
}

export function num(game: GameState, id: string, date?: ISODate): number {
  const v = ruleAt(game, id, date).value;
  if (typeof v !== 'number') throw new Error(`La regla ${id} no es numérica`);
  return v;
}

export function str(game: GameState, id: string, date?: ISODate): string {
  const v = ruleAt(game, id, date).value;
  return String(v);
}

export function rec(game: GameState, id: string, date?: ISODate): Record<string, number> {
  const v = ruleAt(game, id, date).value;
  if (typeof v !== 'object') throw new Error(`La regla ${id} no es una tabla`);
  return v as Record<string, number>;
}

/** Enmiendas aprobadas que aún no surten efecto (p. ej. aplican desde la siguiente elección). */
export function pendingAmendments(game: GameState): Amendment[] {
  return game.amendments.filter((a) => cmp(a.effectiveFrom, game.date) > 0);
}

export function verificationLabel(v: LegalRule['verification']): string {
  return {
    contrastada: 'Contrastada',
    'por-cotejar': 'Pendiente de cotejo',
    simplificacion: 'Simplificación del juego',
    pendiente: 'Pendiente (acción desactivada)',
  }[v];
}
