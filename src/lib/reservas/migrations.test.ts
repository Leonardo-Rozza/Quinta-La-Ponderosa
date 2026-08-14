import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function migration(name: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url)),
    'utf8',
  );
}

const baseline = migration('20260814000000_reservas_baseline.sql');
const securityCore = migration('20260814010000_reservas_security_core.sql');

describe('contrato estático de migraciones de reservas', () => {
  it('crea desde cero la tabla completa, protegida y con timestamps', () => {
    expect(baseline).toContain('create table if not exists public.reservas');
    expect(baseline).toMatch(/id uuid primary key default gen_random_uuid\(\)/);
    expect(baseline).toMatch(/creado_en timestamptz not null default now\(\)/);
    expect(baseline).toMatch(/actualizado_en timestamptz not null default now\(\)/);
    expect(baseline).toMatch(/next_reconciliation_at timestamptz not null default now\(\)/);
    expect(baseline).toContain('alter table public.reservas enable row level security');
    expect(baseline).toContain('revoke all on table public.reservas from public');
    expect(baseline).toContain(
      'grant select, insert, update on table public.reservas to service_role',
    );
  });

  it('no infiere aprobación y alerta las filas históricas ambiguas', () => {
    expect(securityCore).toMatch(
      /estado = 'confirmada'[\s\S]*nullif\(btrim\(mp_payment_id\), ''\) is not null[\s\S]*then 'aprobado'/,
    );
    expect(securityCore).toMatch(
      /estado = 'cancelada'[\s\S]*nullif\(btrim\(mp_payment_id\), ''\) is not null[\s\S]*requiere conciliación/,
    );
    expect(securityCore).toContain("'reserva_revision'");
    expect(securityCore.indexOf('create table if not exists public.email_outbox')).toBeLessThan(
      securityCore.indexOf('insert into public.email_outbox'),
    );
    expect(securityCore).toContain('on conflict (dedupe_key) do nothing');
  });

  it('permite que un reembolso progrese a contracargo en la base', () => {
    expect(securityCore).toContain(
      "new.estado_pago not in ('reembolsado', 'contracargo')",
    );
    expect(securityCore).toContain('Un reembolso solo puede progresar a contracargo');
  });

  it('mantiene balanceados los delimitadores de funciones y bloques PL/pgSQL', () => {
    for (const sql of [baseline, securityCore]) {
      expect(sql.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
      expect((sql.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
    }
  });
});
