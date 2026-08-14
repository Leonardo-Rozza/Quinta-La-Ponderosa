import { CONFIG, PRECIOS } from '@/lib/constants';
import { ArrowDown, CalendarDays, MapPin, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Dayline } from './shared/Dayline';

export function Hero() {
  return (
    <section id="inicio" className="hero" aria-labelledby="hero-title">
      <Image
        src="/images/hero.jpeg"
        alt="Pileta, parque y gazebo de La Ponderosa"
        fill
        priority
        quality={75}
        className="hero__image"
        sizes="100vw"
      />
      <div className="hero__wash" aria-hidden="true" />

      <div className="section-container hero__content">
        <div className="hero__location">
          <MapPin aria-hidden="true" />
          <span>{CONFIG.direccion}</span>
        </div>

        <p className="hero__kicker">La jornada Ponderosa</p>
        <h1 id="hero-title">
          Un día entero
          <span> para volver a encontrarse.</span>
        </h1>
        <p className="hero__lede">
          Quinta de uso exclusivo con pileta, parque y quincho equipado. Un plan simple de organizar
          para reuniones de hasta {PRECIOS.maximoPersonas} personas.
        </p>

        <div className="hero__actions">
          <Link href="#reservas" className="button button--primary button--large">
            <CalendarDays aria-hidden="true" />
            Ver fechas disponibles
          </Link>
          <Link href="#galeria" className="button button--ghost button--large">
            Conocer el lugar
            <ArrowDown aria-hidden="true" />
          </Link>
        </div>

        <div className="hero__facts" aria-label="Datos principales de la quinta">
          <div>
            <span className="hero__fact-icon" aria-hidden="true">
              <Users />
            </span>
            <p>
              <strong>Hasta {PRECIOS.maximoPersonas}</strong>
              <span>personas</span>
            </p>
          </div>
          <div>
            <span className="hero__fact-mark" aria-hidden="true" />
            <p>
              <strong>Uso exclusivo</strong>
              <span>sin compartir espacios</span>
            </p>
          </div>
        </div>
      </div>

      <div className="hero__dayline">
        <Dayline compact inverse />
      </div>
    </section>
  );
}
