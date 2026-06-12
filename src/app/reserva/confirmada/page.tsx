import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import { formatearPrecio, generarLinkWhatsApp } from '@/lib/utils';
import { ArrowLeft, CheckCircle, Clock, Phone } from 'lucide-react';
import Link from 'next/link';

// Mercado Pago no garantiza haber llamado al webhook antes de redirigir al
// usuario, así que la reserva puede seguir "pendiente" unos segundos. Por eso
// no cacheamos esta página.
export const dynamic = 'force-dynamic';

async function obtenerReserva(id: string | undefined): Promise<Reserva | null> {
  if (!id || !hasSupabaseAdminConfig()) return null;

  const { data } = await getSupabaseAdmin()
    .from('reservas')
    .select('*')
    .eq('id', id)
    .single();

  return (data as Reserva | null) ?? null;
}

function formatearFechaLarga(fechaISO: string) {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
}

export default async function ReservaConfirmada({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const reserva = await obtenerReserva(params.external_reference);
  const confirmada = reserva?.estado === 'confirmada';

  return (
    <main className="min-h-screen bg-crema flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            confirmada ? 'bg-disponible/20' : 'bg-amber-100'
          }`}
        >
          {confirmada ? (
            <CheckCircle className="w-10 h-10 text-disponible" />
          ) : (
            <Clock className="w-10 h-10 text-amber-600" />
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl text-negro mb-4">
          {confirmada ? '¡Reserva Confirmada!' : 'Confirmando tu pago...'}
        </h1>

        <p className="text-negro/70 mb-8">
          {confirmada
            ? 'Tu seña fue procesada correctamente. Te enviamos un email con los detalles de tu reserva.'
            : 'Recibimos tu pago y lo estamos confirmando. En cuanto se acredite te enviaremos un email; puede demorar unos minutos.'}
        </p>

        {reserva && (
          <div className="bg-blanco rounded-2xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-negro mb-3">Detalle de tu reserva</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-negro/60">Fecha</span>
                <span className="text-negro capitalize">{formatearFechaLarga(reserva.fecha)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-negro/60">Personas</span>
                <span className="text-negro">{reserva.cantidad_personas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-negro/60">Seña</span>
                <span className="text-negro font-medium">{formatearPrecio(reserva.monto_sena)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-negro/10">
                <span className="text-negro/60">Resto a pagar en el lugar</span>
                <span className="text-negro">
                  {formatearPrecio(reserva.precio_total - reserva.monto_sena)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blanco rounded-2xl p-6 mb-8 text-left">
          <h2 className="font-semibold text-negro mb-4">Próximos pasos</h2>
          <ul className="space-y-3 text-sm text-negro/70">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-terracota/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-terracota text-xs font-bold">1</span>
              </span>
              <span>Revisá tu email para ver los detalles completos</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-terracota/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-terracota text-xs font-bold">2</span>
              </span>
              <span>Te contactaremos para coordinar los detalles de tu llegada</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-terracota/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-terracota text-xs font-bold">3</span>
              </span>
              <span>El día del evento, aboná el resto en efectivo o transferencia</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="btn-secondary flex-1 justify-center">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <a
            href={generarLinkWhatsApp('Hola! Acabo de confirmar mi reserva en La Ponderosa 🎉')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-oliva flex-1 justify-center"
          >
            <Phone className="w-4 h-4" />
            Contactar
          </a>
        </div>
      </div>
    </main>
  );
}
