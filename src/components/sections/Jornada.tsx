import { PRECIOS } from '@/lib/constants';
import { ArrowDownRight, Flame, Sun, Waves } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Dayline } from './shared/Dayline';
import { SectionIntro } from './shared/SectionIntro';

const MOMENTOS = [
  {
    numero: '01',
    hora: PRECIOS.horarioInicio,
    titulo: 'Llegar y bajar un cambio',
    texto: 'El parque, la sombra y los espacios abiertos reciben al grupo sin apuro.',
    icono: Sun,
  },
  {
    numero: '02',
    hora: 'Tu ritmo',
    titulo: 'Hacer el día propio',
    texto: 'Pileta, quincho, parrilla y sobremesa: todo queda cerca, cada plan encuentra su lugar.',
    icono: Waves,
  },
  {
    numero: '03',
    hora: PRECIOS.horarioFin,
    titulo: 'Cerrar alrededor del fuego',
    texto: 'Una jornada completa para celebrar sin mudanzas, turnos ni espacios compartidos.',
    icono: Flame,
  },
] as const;

export function Jornada() {
  return (
    <section id="experiencia" className="jornada section-shell" aria-labelledby="jornada-title">
      <div className="section-container">
        <div className="jornada__intro-grid">
          <SectionIntro
            align="left"
            eyebrow="La jornada Ponderosa"
            title={
              <span id="jornada-title">
                Un solo lugar.
                <br /> Todo el día por delante.
              </span>
            }
            description="Pensada para quien organiza: un espacio exclusivo, una capacidad clara y todo lo importante resuelto en el mismo predio."
          />

          <div className="jornada__portrait">
            <Image
              src="/images/reposeras-gazebo.jpeg"
              alt="Reposeras bajo la sombra del gazebo de La Ponderosa"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className="object-cover"
            />
            <p className="jornada__portrait-note">Sombra, agua y tiempo compartido.</p>
          </div>
        </div>

        <div className="jornada__line-wrap">
          <Dayline />
        </div>

        <ol className="jornada__moments">
          {MOMENTOS.map(({ numero, hora, titulo, texto, icono: Icono }) => (
            <li className="jornada-card" key={numero}>
              <div className="jornada-card__topline">
                <span>{numero}</span>
                <Icono aria-hidden="true" />
              </div>
              <p className="jornada-card__time">{hora}</p>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ol>

        <Link className="text-link jornada__link" href="#reservas">
          Elegir una fecha
          <ArrowDownRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
