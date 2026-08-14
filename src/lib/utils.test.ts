import { describe, expect, it } from 'vitest';
import { generarLinkWhatsApp } from './utils';

describe('generarLinkWhatsApp', () => {
  it('normaliza el teléfono y codifica el mensaje para wa.me', () => {
    expect(generarLinkWhatsApp('Hola, ¿hay fecha?')).toBe(
      'https://wa.me/5491124050772?text=Hola%2C%20%C2%BFhay%20fecha%3F',
    );
  });
});
