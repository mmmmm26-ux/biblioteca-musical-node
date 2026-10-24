import type { LegalRule, NormType, RuleCategory, RuleValue, Verification } from '../../engine/types';

/** Fecha de consulta de las fuentes para la versión de reglas 2026-10-23. */
export const CONSULTED = '2026-10-23';

export function rule(
  id: string,
  category: RuleCategory,
  title: string,
  plain: string,
  value: RuleValue,
  normLevel: NormType,
  sourceId: string,
  article: string,
  verification: Verification,
  extra: Partial<LegalRule> = {},
): LegalRule {
  return { id, category, title, plain, value, normLevel, sourceId, article, consulted: CONSULTED, verification, until: null, ...extra };
}
