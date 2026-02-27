import { CONFIG } from '@/lib/constants';
import { ArrowLeft, Clock, Phone } from 'lucide-react';
import Link from 'next/link';

export default function ReservaPendiente() {
  return (
    <main className="min-h-screen bg-crema flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl text-negro mb-4">Pago en Proceso</h1>

        <p className="text-negro/70 mb-8">
          Tu pago está siendo procesado. Esto puede demorar unos minutos. Te notificaremos por email
          cuando se confirme.
        </p>

        <div className="bg-blanco rounded-2xl p-6 mb-8 text-left">
          <h2 className="font-semibold text-negro mb-3">¿Qué significa esto?</h2>
          <p className="text-sm text-negro/70 mb-4">
            Si elegiste pagar con transferencia, Rapipago, Pago Fácil u otro medio que no sea
            tarjeta, el pago puede demorar hasta 48hs hábiles en acreditarse.
          </p>
          <p className="text-sm text-negro/70">
            Una vez confirmado, recibirás un email y tu fecha quedará reservada.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="btn-secondary flex-1 justify-center">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <a
            href={`https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent('Hola! Tengo un pago pendiente para mi reserva en La Ponderosa')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-oliva flex-1 justify-center"
          >
            <Phone className="w-4 h-4" />
            Consultar
          </a>
        </div>
      </div>
    </main>
  );
}
