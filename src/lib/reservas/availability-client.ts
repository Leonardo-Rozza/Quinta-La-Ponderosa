import type { DisponibilidadResponse } from './contracts';
import { isStrictIsoDate } from './dates';

export type TipoErrorDisponibilidad =
  | 'http'
  | 'network'
  | 'invalid-response'
  | 'aborted';

export interface ErrorConsultaDisponibilidad {
  type: TipoErrorDisponibilidad;
  message: string;
  retryable: boolean;
  status?: number;
  code?: string;
}

export type ResultadoConsultaDisponibilidad =
  | { ok: true; value: DisponibilidadResponse }
  | { ok: false; error: ErrorConsultaDisponibilidad };

export type AvailabilityFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const MENSAJE_HTTP_GENERICO = 'No pudimos consultar las fechas.';
const MENSAJE_RED = 'No pudimos conectarnos para consultar la disponibilidad.';
const MENSAJE_RESPUESTA_INVALIDA =
  'Recibimos una respuesta inválida al consultar la disponibilidad.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return isRecord(error) && error.name === 'AbortError';
}

function parseApiError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return null;

  const { code, message, retryable } = payload.error;
  if (
    typeof code !== 'string' ||
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    typeof retryable !== 'boolean'
  ) {
    return null;
  }

  return {
    code,
    message: message.trim().slice(0, 240),
    retryable,
  };
}

function parseSuccess(payload: unknown): DisponibilidadResponse | null {
  if (!isRecord(payload)) return null;

  const { fechasOcupadas, maxAdvanceDays } = payload;
  if (
    !Array.isArray(fechasOcupadas) ||
    !fechasOcupadas.every(
      (fecha): fecha is string => typeof fecha === 'string' && isStrictIsoDate(fecha),
    ) ||
    !Number.isInteger(maxAdvanceDays) ||
    typeof maxAdvanceDays !== 'number' ||
    maxAdvanceDays < 1
  ) {
    return null;
  }

  return { fechasOcupadas: [...fechasOcupadas], maxAdvanceDays };
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function abortedResult(): ResultadoConsultaDisponibilidad {
  return {
    ok: false,
    error: {
      type: 'aborted',
      message: '',
      retryable: false,
    },
  };
}

export async function consultarDisponibilidad(
  options: {
    signal?: AbortSignal;
    fetcher?: AvailabilityFetcher;
  } = {},
): Promise<ResultadoConsultaDisponibilidad> {
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher('/api/reservas', {
      cache: 'no-store',
      signal: options.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (isAbortError(error)) return abortedResult();
      return {
        ok: false,
        error: {
          type: 'invalid-response',
          message: MENSAJE_RESPUESTA_INVALIDA,
          retryable: true,
          status: response.status,
        },
      };
    }

    if (!response.ok) {
      const apiError = parseApiError(payload);
      return {
        ok: false,
        error: {
          type: 'http',
          message: apiError?.message ?? MENSAJE_HTTP_GENERICO,
          retryable: apiError?.retryable ?? shouldRetryStatus(response.status),
          status: response.status,
          ...(apiError?.code ? { code: apiError.code } : {}),
        },
      };
    }

    if (isRecord(payload) && typeof payload.warning === 'string' && payload.warning) {
      return {
        ok: false,
        error: {
          type: 'invalid-response',
          message: 'La disponibilidad online está temporalmente incompleta.',
          retryable: true,
          status: response.status,
        },
      };
    }

    const disponibilidad = parseSuccess(payload);
    if (!disponibilidad) {
      return {
        ok: false,
        error: {
          type: 'invalid-response',
          message: MENSAJE_RESPUESTA_INVALIDA,
          retryable: true,
          status: response.status,
        },
      };
    }

    return { ok: true, value: disponibilidad };
  } catch (error) {
    if (isAbortError(error)) return abortedResult();
    return {
      ok: false,
      error: {
        type: 'network',
        message: MENSAJE_RED,
        retryable: true,
      },
    };
  }
}
