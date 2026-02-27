import { CONFIG } from '@/lib/constants';
import { Phone, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function ReservaError() {
  return (
    <main className="min-h-screen bg-crema flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-ocupado/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-ocupado" />
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl text-negro mb-4">Error en el Pago</h1>

        <p className="text-negro/70 mb-8">
          Hubo un problema al procesar tu pago. No te preocupes, no se realizó ningún cobro. Podés
          intentar nuevamente.
        </p>

        <div className="bg-blanco rounded-2xl p-6 mb-8 text-left">
          <h2 className="font-semibold text-negro mb-3">Posibles causas</h2>
          <ul className="text-sm text-negro/70 space-y-2">
            <li>• Fondos insuficientes en la tarjeta</li>
            <li>• Tarjeta vencida o datos incorrectos</li>
            <li>• Límite de compra excedido</li>
            <li>• Problemas de conexión</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/#reservas" className="btn-primary flex-1 justify-center">
            <RefreshCw className="w-4 h-4" />
            Intentar de nuevo
          </Link>
          <a
            href={`https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent('Hola! Tuve un problema con el pago de mi reserva en La Ponderosa')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 justify-center"
          >
            <Phone className="w-4 h-4" />
            Pedir ayuda
          </a>
        </div>
      </div>
    </main>
  );
}
