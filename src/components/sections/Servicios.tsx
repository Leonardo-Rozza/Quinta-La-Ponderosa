import { 
  Waves, 
  Flame, 
  Wifi, 
  Car, 
  Users, 
  Microwave
} from "lucide-react";

// Datos de los servicios
const SERVICIOS = [
  {
    icono: Waves,
    titulo: "Pileta",
    descripcion: "Pileta espaciada, ideal para toda la familia",
  },
  {
    icono: Microwave,
    titulo: "Horno de Barro",
    descripcion: "Contamos con un horno de barro para pizzas y guisos",
  },
  {
    icono: Flame,
    titulo: "Quincho Equipado",
    descripcion: "Quincho completo con parrilla, mesas y zona cubierta para 30 personas",
  },
  {
    icono: Wifi,
    titulo: "WiFi Gratis",
    descripcion: "Internet de alta velocidad en toda la propiedad",
  },
  {
    icono: Car,
    titulo: "Estacionamiento",
    descripcion: "Amplio espacio para estacionar varios vehículos dentro de la quinta",
  },
  {
    icono: Users,
    titulo: "Hasta 30 Personas",
    descripcion: "Capacidad para grupos grandes con múltiples espacios",
  },
];

export function Servicios() {
  return (
    <section id="servicios" className="py-16 sm:py-20 lg:py-24 bg-crema">
      <div className="section-container">
        
        {/* Header de la sección */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Servicios</span>
          <h2 className="section-title mb-4">Todo para tu estadía</h2>
          <p className="text-negro/70 text-base sm:text-lg max-w-2xl mx-auto">
            Contamos con todas las comodidades para que tu experiencia sea inolvidable
          </p>
        </div>

        {/* Grid de servicios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {SERVICIOS.map((servicio, index) => (
            <ServicioCard 
              key={index}
              icono={servicio.icono}
              titulo={servicio.titulo}
              descripcion={servicio.descripcion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE CARD DE SERVICIO
// ─────────────────────────────────────────────────────────────────────────────
interface ServicioCardProps {
  icono: React.ElementType;
  titulo: string;
  descripcion: string;
}

function ServicioCard({ icono: Icono, titulo, descripcion }: ServicioCardProps) {
  return (
    <div className="servicio-card">
      {/* Línea decorativa superior (aparece en hover) */}
      <div className="servicio-card-line" />
      
      {/* Contenido */}
      <div className="p-6 sm:p-8">
        {/* Icono */}
        <div className="servicio-icon">
          <Icono className="w-6 h-6 text-oliva" strokeWidth={1.5} />
        </div>
        
        {/* Texto */}
        <h3 className="font-serif text-lg sm:text-xl text-negro mb-2">
          {titulo}
        </h3>
        <p className="text-negro/60 text-sm sm:text-base leading-relaxed">
          {descripcion}
        </p>
      </div>
    </div>
  );
}
