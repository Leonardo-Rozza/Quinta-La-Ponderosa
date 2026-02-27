import { CONFIG } from '@/lib/constants';
import { ArrowLeft, CheckCircle, Phone } from 'lucide-react';
import Link from 'next/link';

export default function ReservaConfirmada() {
  return (
    <main className="min-h-screen bg-crema flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-disponible/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-disponible" />
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl text-negro mb-4">¡Reserva Confirmada!</h1>

        <p className="text-negro/70 mb-8">
          Tu seña fue procesada correctamente. Te enviamos un email con los detalles de tu reserva.
        </p>

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
            href={`https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent('Hola! Acabo de confirmar mi reserva en La Ponderosa 🎉')}`}
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
