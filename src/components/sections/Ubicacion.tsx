import { CONFIG, PRECIOS } from '@/lib/constants';
import { generarLinkWhatsApp } from '@/lib/utils';
import { ArrowUpRight, Car, Clock3, MapPin, MessageCircle } from 'lucide-react';
import { SectionIntro } from './shared/SectionIntro';

const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Quinta%20La%20Ponderosa%2C%20Eduardo%20Wilde%202055%2C%20Jos%C3%A9%20C.%20Paz';

export function Ubicacion() {
  return (
    <section id="ubicacion" className="location section-shell" aria-labelledby="location-title">
      <div className="section-container">
        <SectionIntro
          eyebrow="05 · Llegar sin vueltas"
          title={<span id="location-title">En José C. Paz, cerca de todo el plan.</span>}
          description="Revisá el punto de llegada antes de reservar y compartilo con tu grupo cuando llegue el momento."
        />

        <div className="location__layout">
          <div className="location__map-wrap">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3287.6769328947707!2d-58.765210787669744!3d-34.511073772875086!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95bc99aea53fc0b1%3A0xe36044ad0f8cbc2a!2sQuinta%20La%20Ponderosa!5e0!3m2!1ses-419!2sar!4v1771379914860!5m2!1ses-419!2sar"
              title="Mapa con la ubicación de Quinta La Ponderosa"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="location__map-link">
              Abrir en Google Maps
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>

          <div className="location__details">
            <article>
              <span className="location__icon" aria-hidden="true">
                <MapPin />
              </span>
              <div>
                <p className="location__label">Dirección</p>
                <h3>{CONFIG.direccionCalle}</h3>
                <p>{CONFIG.direccionLocalidad}</p>
              </div>
            </article>
            <article>
              <span className="location__icon" aria-hidden="true">
                <Clock3 />
              </span>
              <div>
                <p className="location__label">La jornada</p>
                <h3>
                  {PRECIOS.horarioInicio} — {PRECIOS.horarioFin} hs
                </h3>
                <p>Ingreso y cierre del predio dentro del mismo día.</p>
              </div>
            </article>
            <article>
              <span className="location__icon" aria-hidden="true">
                <Car />
              </span>
              <div>
                <p className="location__label">Llegada</p>
                <h3>Indicaciones en Maps</h3>
                <p>Revisá el recorrido hasta {CONFIG.direccionCalle}. Hay estacionamiento dentro de la quinta.</p>
              </div>
            </article>

            <a
              href={generarLinkWhatsApp('Hola, quisiera consultar cómo llegar a La Ponderosa.')}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--secondary button--large"
            >
              <MessageCircle aria-hidden="true" />
              Consultar cómo llegar
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
