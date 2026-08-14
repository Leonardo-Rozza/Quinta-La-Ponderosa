import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  hashRateLimitActor,
  hashRateLimitSignal,
  rateLimitActorHashesEqual,
} from './rate-limit';

const SECRET = 'rate-limit-test-secret-with-at-least-32-bytes';

describe('rate limit hashes', () => {
  it('persiste un actor estable que depende solo de la IP normalizada', () => {
    const first = hashRateLimitActor({ ip: ' 203.0.113.9 ' }, SECRET);
    const second = hashRateLimitActor({ ip: '203.0.113.9' }, SECRET);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value).toMatch(/^[a-f0-9]{64}$/);
    expect(rateLimitActorHashesEqual(first.value, second.value)).toBe(true);
  });

  it('separa los dominios de IP y email', () => {
    const ip = hashRateLimitSignal({ kind: 'ip', value: 'same-value' }, SECRET);
    const email = hashRateLimitSignal({ kind: 'email', value: 'same-value' }, SECRET);

    expect(ip.ok && email.ok).toBe(true);
    if (!ip.ok || !email.ok) return;

    expect(ip.value).not.toBe(email.value);
  });

  it('normaliza email sin almacenar el valor original', () => {
    const first = hashRateLimitSignal({ kind: 'email', value: ' USER@Example.COM ' }, SECRET);
    const second = hashRateLimitSignal({ kind: 'email', value: 'user@example.com' }, SECRET);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toBe(second.value);
    expect(first.value).not.toContain('user@example.com');
  });

  it('falla cerrado cuando el secreto no cumple el mínimo', () => {
    const result = hashRateLimitActor({ ip: '203.0.113.9' }, 'short');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFIGURATION_ERROR');
    expect(result.error.status).toBe(503);
  });
});
