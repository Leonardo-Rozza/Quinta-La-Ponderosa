import Link from "next/link";
import { Instagram, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { CONFIG, NAV_LINKS } from "@/lib/constants";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contacto" className="bg-negro text-white">
      {/* Contenido principal */}
      <div className="section-container py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Columna 1: Logo y descripción */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-oliva flex items-center justify-center">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-6 h-6 text-white"
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5"
                >
                  <path d="M12 3c-1.5 3-3 5.5-3 9 0 4 2 6 3 6s3-2 3-6c0-3.5-1.5-6-3-9z" />
                  <path d="M12 12v9" />
                </svg>
              </div>
              <span className="font-serif text-xl">{CONFIG.siteName}</span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Tu refugio en la naturaleza. 5 hectáreas de parque, pileta y quincho 
              equipado para disfrutar con familia y amigos.
            </p>
            
            {/* Redes sociales */}
            <div className="flex gap-3">
              <a
                href={CONFIG.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61553456481253"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={`https://wa.me/${CONFIG.telefono}`}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Columna 2: Links rápidos */}

          {/* Columna 3: Contacto */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`tel:${CONFIG.telefono}`}
                  className="flex items-center gap-2 text-white/60 hover:text-terracota transition-colors text-sm"
                >
                  <Phone className="w-4 h-4" />
                  {CONFIG.telefonoDisplay}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONFIG.email}`}
                  className="flex items-center gap-2 text-white/60 hover:text-terracota transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  {CONFIG.email}
                </a>
              </li>
              <li>
                <span className="flex items-start gap-2 text-white/60 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {CONFIG.direccion}
                </span>
              </li>
            </ul>
          </div>

          {/* Columna 4: Horarios */}
          <div>
            <h4 className="font-semibold text-white mb-4">Horarios</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-white/60">Horario de uso</p>
                <p className="text-white">10:00 a 20:00 hs</p>
              </div>
              <div>
                <p className="text-white/60">Atención consultas</p>
                <p className="text-white">Lun a Sáb, 9:00 a 21:00 hs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Línea divisoria y copyright */}
      <div className="border-t border-white/10">
        <div className="section-container py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-white/40">
            <p>© {currentYear} {CONFIG.siteName}. Todos los derechos reservados.</p>
            <p>
              Hecho con 💚 en Argentina
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}