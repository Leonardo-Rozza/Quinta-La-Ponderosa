import { ConfirmacionReserva } from '@/components/sections/reservas/ConfirmacionReserva';

export const dynamic = 'force-dynamic';

export default async function ReservaPendiente({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.reservaId === 'string') query.set('reservaId', params.reservaId.slice(0, 64));
  if (typeof params.token === 'string') query.set('token', params.token.slice(0, 256));

  return <ConfirmacionReserva query={query.toString()} />;
}
