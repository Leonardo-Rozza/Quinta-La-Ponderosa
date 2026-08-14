export const MAX_LOSSLESS_JSON_BYTES = 64 * 1024;

export type LosslessJsonObjectResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'too_large' | 'invalid_json' | 'not_object' };

function isDigit(character: string | undefined) {
  return character !== undefined && character >= '0' && character <= '9';
}

function numberTokenEnd(raw: string, start: number) {
  let cursor = start;
  if (raw[cursor] === '-') cursor += 1;

  if (raw[cursor] === '0') {
    cursor += 1;
  } else {
    while (isDigit(raw[cursor])) cursor += 1;
  }

  if (raw[cursor] === '.') {
    cursor += 1;
    while (isDigit(raw[cursor])) cursor += 1;
  }

  if (raw[cursor] === 'e' || raw[cursor] === 'E') {
    cursor += 1;
    if (raw[cursor] === '+' || raw[cursor] === '-') cursor += 1;
    while (isDigit(raw[cursor])) cursor += 1;
  }

  return cursor;
}

/**
 * Entrecomilla tokens numéricos sin interpretar su valor. Una validación JSON
 * completa se ejecuta antes, por lo que este paso no puede volver válido un
 * documento originalmente inválido (por ejemplo, una clave numérica).
 */
function quoteNumericTokens(raw: string) {
  const output: string[] = [];
  let cursor = 0;
  let inString = false;
  let escaped = false;

  while (cursor < raw.length) {
    const character = raw[cursor] as string;

    if (inString) {
      output.push(character);
      cursor += 1;

      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output.push(character);
      cursor += 1;
      continue;
    }

    if (character === '-' || isDigit(character)) {
      const end = numberTokenEnd(raw, cursor);
      output.push('"', raw.slice(cursor, end), '"');
      cursor = end;
      continue;
    }

    output.push(character);
    cursor += 1;
  }

  return output.join('');
}

/**
 * Parsea un objeto JSON conservando la representación léxica exacta de todos
 * los números como strings. Está acotado a 64 KiB para el uso en webhooks.
 */
export function parseLosslessJsonObject(raw: string): LosslessJsonObjectResult {
  if (Buffer.byteLength(raw, 'utf8') > MAX_LOSSLESS_JSON_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  let validated: unknown;
  try {
    validated = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  if (!validated || typeof validated !== 'object' || Array.isArray(validated)) {
    return { ok: false, reason: 'not_object' };
  }

  try {
    const parsed: unknown = JSON.parse(quoteNumericTokens(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'not_object' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    // Una divergencia aquí señalaría un error del tokenizer; hacia la frontera
    // HTTP sigue siendo una entrada inválida y no debe continuar al webhook.
    return { ok: false, reason: 'invalid_json' };
  }
}
