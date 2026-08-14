import { Car, Flame, Microwave, Refrigerator, Users, Waves, Wifi } from 'lucide-react';
import { SectionIntro } from './shared/SectionIntro';

const SERVICIOS = [
  {
    icono: Waves,
    titulo: 'Pileta y solárium',
    descripcion: 'El centro del verano, con reposeras y sombra cerca para acompañar todo el día.',
    destacado: true,
  },
  {
    icono: Flame,
    titulo: 'Quincho y parrilla',
    descripcion: 'Un espacio cubierto para servir, comer y seguir la reunión aunque cambie el clima.',
    destacado: true,
  },
  {
    icono: Microwave,
    titulo: 'Horno de barro',
    descripcion: 'Para sumar pizzas, panes o una cocción lenta al plan del encuentro.',
    destacado: false,
  },
  {
    icono: Refrigerator,
    titulo: 'Heladera con freezer',
    descripcion: 'Capacidad para organizar bebidas y comida sin depender de conservadoras.',
    destacado: false,
  },
  {
    icono: Car,
    titulo: 'Estacionamiento interno',
    descripcion: 'Lugar para varios vehículos dentro del predio.',
    destacado: false,
  },
  {
    icono: Wifi,
    titulo: 'WiFi',
    descripcion: 'Conectividad disponible en la propiedad para resolver lo necesario.',
    destacado: false,
  },
] as const;

export function Servicios() {
  return (
    <section className="services section-shell" aria-labelledby="services-title">
      <div id="servicios" className="section-container">
        <div className="services__heading">
          <SectionIntro
            align="left"
            eyebrow="02 · Lo que ya está resuelto"
            title={<span id="services-title">Menos logística. Más encuentro.</span>}
            description="Los espacios y equipamientos que sostienen una jornada de hasta 30 personas, sin sumar traslados ni proveedores para lo esencial."
          />
          <div className="services__capacity" aria-label="Capacidad máxima: 30 personas">
            <Users aria-hidden="true" />
            <span>
              <strong>30</strong>
              personas como máximo
            </span>
          </div>
        </div>

        <ul className="services__grid">
          {SERVICIOS.map(({ icono: Icono, titulo, descripcion, destacado }) => (
            <li className={`service-card${destacado ? ' service-card--featured' : ''}`} key={titulo}>
              <span className="service-card__icon" aria-hidden="true">
                <Icono />
              </span>
              <div>
                <h3>{titulo}</h3>
                <p>{descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
