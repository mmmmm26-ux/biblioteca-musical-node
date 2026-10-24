import type { GameState, LogEntry } from './types';

// Noticias: se generan EXCLUSIVAMENTE a partir de entradas del registro del motor.
// No añaden hechos: reformulan el título y detallan su origen.

export interface NewsItem { id: string; date: string; section: string; headline: string; lede: string; layer: LogEntry['layer']; logId: string }

const SECTION: Partial<Record<LogEntry['kind'], string>> = {
  eleccion: 'Elecciones', campana: 'Campaña', gobierno: 'Gobierno', investidura: 'Gobierno', procedimiento: 'Parlamento', votacion: 'Parlamento',
  'ley-vigente': 'Boletín oficial', 'reforma-vigente': 'Constitución', rechazo: 'Parlamento', 'intento-invalido': 'Justicia', evento: 'Actualidad', economia: 'Economía', tribunal: 'Justicia', grupo: 'Sociedad',
};

export function news(game: GameState, limit = 40): NewsItem[] {
  return game.log
    .filter((l) => SECTION[l.kind])
    .slice(-limit)
    .reverse()
    .map((l) => ({ id: `n-${l.id}`, date: l.date, section: SECTION[l.kind]!, headline: l.title, lede: l.detail, layer: l.layer, logId: l.id }));
}
