import type { CountryModule } from '../../engine/country';
import type { CountryId } from '../../engine/types';
import es from './es';
import sv from './sv';
import us from './us';

// Registro de países. Para añadir uno nuevo: crear su módulo y añadirlo aquí.
export const COUNTRIES: Record<CountryId, CountryModule> = { sv, us, es };

export function getCountry(id: CountryId): CountryModule {
  const c = COUNTRIES[id];
  if (!c) throw new Error(`País no disponible: ${id}`);
  return c;
}
