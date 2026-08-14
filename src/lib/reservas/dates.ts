import { err, ok, type Result } from '../api-errors';

export const RESERVA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const DEFAULT_RESERVA_MAX_ADVANCE_DAYS = 365;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ReservaDateErrorCode =
  | 'INVALID_DATE'
  | 'DATE_NOT_IN_FUTURE'
  | 'DATE_OUT_OF_HORIZON';

export interface ReservaDateError {
  code: ReservaDateErrorCode;
  message: string;
}

export interface ReservaDatePolicy {
  today?: string;
  maxAdvanceDays?: number;
  timeZone?: string;
}

function formatDateParts(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessToday(
  now: Date = new Date(),
  timeZone = RESERVA_TIME_ZONE
): string {
  return formatDateParts(now, timeZone);
}

export function isStrictIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function addIsoDays(value: string, days: number): string {
  if (!isStrictIsoDate(value) || !Number.isInteger(days)) {
    throw new TypeError('Fecha ISO o cantidad de días inválida');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getReservaMaxAdvanceDays(raw?: string): number {
  if (!raw) return DEFAULT_RESERVA_MAX_ADVANCE_DAYS;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 730
    ? parsed
    : DEFAULT_RESERVA_MAX_ADVANCE_DAYS;
}

export function getConfiguredReservaMaxAdvanceDays(): number {
  return getReservaMaxAdvanceDays(process.env.RESERVA_MAX_ADVANCE_DAYS);
}

export function validarFechaReserva(
  value: string,
  policy: ReservaDatePolicy = {}
): Result<string, ReservaDateError> {
  if (!isStrictIsoDate(value)) {
    return err({
      code: 'INVALID_DATE',
      message: 'Ingresá una fecha real con formato YYYY-MM-DD',
    });
  }

  const today = policy.today ?? getBusinessToday(new Date(), policy.timeZone);
  if (!isStrictIsoDate(today)) {
    throw new TypeError('La fecha base de la política es inválida');
  }

  const minDate = addIsoDays(today, 1);
  if (value < minDate) {
    return err({
      code: 'DATE_NOT_IN_FUTURE',
      message: 'La fecha debe ser posterior a hoy',
    });
  }

  const maxAdvanceDays = policy.maxAdvanceDays ?? getConfiguredReservaMaxAdvanceDays();
  const maxDate = addIsoDays(today, maxAdvanceDays);
  if (value > maxDate) {
    return err({
      code: 'DATE_OUT_OF_HORIZON',
      message: `Solo se puede reservar con hasta ${maxAdvanceDays} días de anticipación`,
    });
  }

  return ok(value);
}
