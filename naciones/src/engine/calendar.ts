import type { ISODate } from './types';

// Calendario interno. Los turnos son mensuales, pero cada plazo legal se fija en días.

export function toDate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromDate(x);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const x = toDate(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return fromDate(x);
}

export function addYears(d: ISODate, n: number): ISODate {
  return addMonths(d, 12 * n);
}

export function cmp(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

export function year(d: ISODate): number {
  return Number(d.slice(0, 4));
}

export function month(d: ISODate): number {
  return Number(d.slice(5, 7));
}

export function monthsBetween(a: ISODate, b: ISODate): number {
  return (year(b) - year(a)) * 12 + (month(b) - month(a));
}

/** Primer martes después del primer lunes de noviembre (3 U.S.C. § 1). */
export function usElectionDay(y: number): ISODate {
  const d = new Date(Date.UTC(y, 10, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return fromDate(d);
}

/** Último domingo del mes indicado (1-12). */
export function lastSunday(y: number, m: number): ISODate {
  const d = new Date(Date.UTC(y, m, 0));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1);
  return fromDate(d);
}

/** Primer domingo en o después de la fecha. */
export function nextSunday(dt: ISODate): ISODate {
  const d = toDate(dt);
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return fromDate(d);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fmtDate(d: ISODate): string {
  const x = toDate(d);
  return `${x.getUTCDate()} de ${MESES[x.getUTCMonth()]} de ${x.getUTCFullYear()}`;
}

export function fmtMonth(d: ISODate): string {
  const x = toDate(d);
  const m = MESES[x.getUTCMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} ${x.getUTCFullYear()}`;
}

export function fmtShort(d: ISODate): string {
  const x = toDate(d);
  return `${x.getUTCDate()} ${MESES[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
}

/** Número con formato español (coma decimal). */
export function fmtNum(x: number, d = 1): string {
  return x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}
