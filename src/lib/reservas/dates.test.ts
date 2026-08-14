import { describe, expect, it } from 'vitest';
import {
  addIsoDays,
  getBusinessToday,
  getReservaMaxAdvanceDays,
  isStrictIsoDate,
  validarFechaReserva,
} from './dates';

describe('fechas de reserva', () => {
  it('valida por round-trip y rechaza fechas normalizadas por Date', () => {
    expect(isStrictIsoDate('2028-02-29')).toBe(true);
    expect(isStrictIsoDate('2026-02-29')).toBe(false);
    expect(isStrictIsoDate('2026-02-31')).toBe(false);
    expect(isStrictIsoDate('2026-13-01')).toBe(false);
  });

  it('calcula hoy en la zona horaria del negocio', () => {
    const instant = new Date('2026-08-14T01:30:00.000Z');
    expect(getBusinessToday(instant)).toBe('2026-08-13');
  });

  it('exige mañana como mínimo e incluye el límite del horizonte', () => {
    expect(
      validarFechaReserva('2026-08-13', {
        today: '2026-08-13',
        maxAdvanceDays: 30,
      })
    ).toMatchObject({ ok: false, error: { code: 'DATE_NOT_IN_FUTURE' } });

    expect(
      validarFechaReserva('2026-09-12', {
        today: '2026-08-13',
        maxAdvanceDays: 30,
      })
    ).toEqual({ ok: true, value: '2026-09-12' });

    expect(
      validarFechaReserva('2026-09-13', {
        today: '2026-08-13',
        maxAdvanceDays: 30,
      })
    ).toMatchObject({ ok: false, error: { code: 'DATE_OUT_OF_HORIZON' } });
  });

  it('suma días sin depender de DST ni de la zona horaria del proceso', () => {
    expect(addIsoDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addIsoDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('limita una configuración inválida al valor seguro por defecto', () => {
    expect(getReservaMaxAdvanceDays('90')).toBe(90);
    expect(getReservaMaxAdvanceDays('0')).toBe(365);
    expect(getReservaMaxAdvanceDays('999999')).toBe(365);
    expect(getReservaMaxAdvanceDays('invalido')).toBe(365);
  });
});
