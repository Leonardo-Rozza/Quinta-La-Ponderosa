import { CONFIG, PRECIOS } from '@/lib/constants';
import { generarLinkWhatsApp } from '@/lib/utils';
import { Facebook, Instagram, Leaf, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';

const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Quinta%20La%20Ponderosa%2C%20Eduardo%20Wilde%202055%2C%20Jos%C3%A9%20C.%20Paz';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contacto" className="footer">
      <div className="section-container footer__grid">
        <div className="footer__brand-column">
          <a href="#inicio" className="brand" aria-label="La Ponderosa, volver al inicio">
            <span className="brand__mark" aria-hidden="true">
              <Leaf />
            </span>
            <span className="brand__name">{CONFIG.siteName}</span>
          </a>
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
              href={generarLinkWhatsApp('Hola, quisiera consultar por La Ponderosa.')}
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
          <a href="#experiencia">La jornada</a>
          <a href="#servicios">Servicios</a>
          <a href="#galeria">Galería</a>
          <a href="#ubicacion">Ubicación</a>
          <a href="#reservas">Reservar</a>
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
          <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            <MapPin aria-hidden="true" />
            {CONFIG.direccion}
          </a>
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
