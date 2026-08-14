import { CONFIG } from '@/lib/constants';
import { generarLinkWhatsApp } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Leaf, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { Dayline } from '../shared/Dayline';

type VarianteEstado = 'success' | 'pending' | 'error';

interface EstadoReservaProps {
  variante: VarianteEstado;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  whatsappMessage: string;
}

const ICONOS = {
  success: CheckCircle2,
  pending: Clock3,
  error: AlertTriangle,
} as const;

export function EstadoReserva({
  variante,
  eyebrow,
  title,
  description,
  children,
  primaryHref = '/',
  primaryLabel = 'Volver al inicio',
  whatsappMessage,
}: EstadoReservaProps) {
  const Icono = ICONOS[variante];

  return (
    <main id="contenido" className={`status-page status-page--${variante}`}>
      <div className="status-page__background" aria-hidden="true" />
      <div className="status-page__shell">
        <Link href="/" className="brand brand--dark status-page__brand" aria-label="La Ponderosa, volver al inicio">
          <span className="brand__mark" aria-hidden="true"><Leaf /></span>
          <span className="brand__name">{CONFIG.siteName}</span>
        </Link>

        <section className="status-card" aria-labelledby="status-title">
          <div className="status-card__icon" aria-hidden="true"><Icono /></div>
          <p className="status-card__eyebrow">{eyebrow}</p>
          <h1 id="status-title">{title}</h1>
          <p className="status-card__description">{description}</p>

          {children}

          <div className="status-card__actions">
            <Link href={primaryHref} className="button button--secondary">
              <ArrowLeft aria-hidden="true" />
              {primaryLabel}
            </Link>
            <a
              href={generarLinkWhatsApp(whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--primary"
            >
              <MessageCircle aria-hidden="true" />
              Hablar con nosotros
            </a>
          </div>
        </section>

        <div className="status-page__dayline">
          <Dayline compact />
        </div>
      </div>
    </main>
  );
}
