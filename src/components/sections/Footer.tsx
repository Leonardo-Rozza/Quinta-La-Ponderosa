import { CONFIG, PRECIOS } from '@/lib/constants';
import { ArrowUp, Facebook, Instagram, Leaf, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contacto" className="footer">
      <div className="section-container footer__lead">
        <p>¿Ya imaginaste la jornada?</p>
        <h2>Elegí el día. El lugar ya está listo.</h2>
        <Link href="/#reservas" className="button button--light button--large">
          Ver disponibilidad
          <ArrowUp aria-hidden="true" />
        </Link>
      </div>

      <div className="section-container footer__grid">
        <div className="footer__brand-column">
          <Link href="/#inicio" className="brand" aria-label="La Ponderosa, volver al inicio">
            <span className="brand__mark" aria-hidden="true">
              <Leaf />
            </span>
            <span className="brand__name">{CONFIG.siteName}</span>
          </Link>
          <p>
            Quinta de uso exclusivo con pileta, parque y quincho para encuentros de hasta{' '}
            {PRECIOS.maximoPersonas} personas.
          </p>
          <div className="footer__socials" aria-label="Redes sociales">
            <a href={CONFIG.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram aria-hidden="true" />
            </a>
            <a href={CONFIG.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook aria-hidden="true" />
            </a>
            <a
              href={`https://wa.me/${CONFIG.telefono.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <MessageCircle aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="footer__column">
          <h3>Explorar</h3>
          <Link href="/#experiencia">La jornada</Link>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#galeria">Galería</Link>
          <Link href="/#ubicacion">Ubicación</Link>
          <Link href="/#reservas">Reservar</Link>
        </div>

        <div className="footer__column footer__contact">
          <h3>Contacto</h3>
          <a href={`tel:${CONFIG.telefono}`}>
            <Phone aria-hidden="true" />
            {CONFIG.telefonoDisplay}
          </a>
          <a href={`mailto:${CONFIG.email}`}>
            <Mail aria-hidden="true" />
            {CONFIG.email}
          </a>
          <span>
            <MapPin aria-hidden="true" />
            {CONFIG.direccion}
          </span>
        </div>
      </div>

      <div className="section-container footer__bottom">
        <p>© {currentYear} {CONFIG.siteName}. Todos los derechos reservados.</p>
        <nav aria-label="Información legal">
          <Link href="/terminos">Términos de reserva</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
      </div>
    </footer>
  );
}
