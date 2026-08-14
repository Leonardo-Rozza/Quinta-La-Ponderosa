import { CONFIG } from '@/lib/constants';
import { ArrowLeft, Leaf } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface LegalLayoutProps {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}

export function LegalLayout({ eyebrow, title, summary, children }: LegalLayoutProps) {
  return (
    <main className="legal-page" id="contenido">
      <header className="legal-header">
        <div className="section-container legal-header__inner">
          <Link href="/" className="brand brand--dark" aria-label="La Ponderosa, volver al inicio">
            <span className="brand__mark" aria-hidden="true"><Leaf /></span>
            <span className="brand__name">{CONFIG.siteName}</span>
          </Link>
          <Link href="/#reservas" className="text-link">
            <ArrowLeft aria-hidden="true" /> Volver a la reserva
          </Link>
        </div>
      </header>

      <div className="section-container legal-page__layout">
        <aside>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{summary}</span>
          <small>Última actualización: 13 de agosto de 2026</small>
        </aside>
        <article className="legal-content">{children}</article>
      </div>

      <footer className="legal-footer">
        <div className="section-container">
          <p>¿Necesitás aclarar algo antes de continuar?</p>
          <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
        </div>
      </footer>
    </main>
  );
}
