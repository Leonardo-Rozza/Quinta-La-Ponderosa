import { describe, expect, it } from 'vitest';
import {
  MAX_LOSSLESS_JSON_BYTES,
  parseLosslessJsonObject,
} from './lossless-json';

describe('parseLosslessJsonObject', () => {
  it('preserva IDs numéricos grandes del evento y del recurso', () => {
    const result = parseLosslessJsonObject(
      '{"id":217000061307271001,"type":"topic_chargebacks_wh","data":{"id":217000061307271001}}',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        id: '217000061307271001',
        type: 'topic_chargebacks_wh',
        data: { id: '217000061307271001' },
      },
    });
  });

  it('no modifica dígitos ni escapes que están dentro de strings', () => {
    const result = parseLosslessJsonObject(
      '{"text":"ID 217000061307271001, decimal 1.20e+3, quote: \\"123\\", slash: \\\\456","escaped":"\\u0031\\u0032\\u0033","data":{"id":"217000061307271001"}}',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        text: 'ID 217000061307271001, decimal 1.20e+3, quote: "123", slash: \\456',
        escaped: '123',
        data: { id: '217000061307271001' },
      },
    });
  });

  it('conserva signo, ceros, decimales y exponentes en forma léxica', () => {
    const result = parseLosslessJsonObject(
      '{"zero":-0,"decimal":-12.3400,"exponent":6.022e+23,"upper":1E-09,"nested":[0,42]}',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        zero: '-0',
        decimal: '-12.3400',
        exponent: '6.022e+23',
        upper: '1E-09',
        nested: ['0', '42'],
      },
    });
  });

  it.each([
    ['', 'invalid_json'],
    ['{"id":01}', 'invalid_json'],
    ['{"id":1,}', 'invalid_json'],
    ['null', 'not_object'],
    ['[]', 'not_object'],
  ] as const)('rechaza %j como %s', (raw, reason) => {
    expect(parseLosslessJsonObject(raw)).toEqual({ ok: false, reason });
  });

  it('rechaza el cuerpo cuando supera 64 KiB', () => {
    const raw = `{"value":"${'x'.repeat(MAX_LOSSLESS_JSON_BYTES)}"}`;
    expect(parseLosslessJsonObject(raw)).toEqual({ ok: false, reason: 'too_large' });
  });
});
