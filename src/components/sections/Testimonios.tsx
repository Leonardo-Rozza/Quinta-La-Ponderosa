import { Star } from "lucide-react";

// Datos de testimonios
const TESTIMONIOS = [
  {
    nombre: "María González",
    ubicacion: "Buenos Aires",
    fecha: "Octubre 2024",
    texto: "Un lugar espectacular para desconectar. La pileta es hermosa y el parque increíble. Fuimos con toda la familia y quedamos encantados.",
    rating: 5,
  },
  {
    nombre: "Carlos Rodríguez",
    ubicacion: "Rosario",
    fecha: "Septiembre 2024",
    texto: "Excelente atención y el lugar superó nuestras expectativas. Muy limpio, cómodo y con todas las comodidades. Ya reservamos para el verano.",
    rating: 5,
  },
  {
    nombre: "Laura Fernández",
    ubicacion: "Córdoba",
    fecha: "Noviembre 2024",
    texto: "Pasamos un fin de semana inolvidable. Los chicos disfrutaron muchísimo de la pileta y nosotros del quincho. Todo impecable.",
    rating: 5,
  },
];

export function Testimonios() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-crema">
      <div className="section-container">
        
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="section-title mb-4">Testimonios</h2>
          <p className="text-negro/70 text-base sm:text-lg">
            Lo que dicen nuestros huéspedes
          </p>
        </div>

        {/* Grid de testimonios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10">
          {TESTIMONIOS.map((testimonio, index) => (
            <TestimonioCard key={index} {...testimonio} />
          ))}
        </div>

        {/* Rating general */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 bg-blanco px-6 py-3 rounded-full shadow-sm">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span className="font-serif text-2xl text-negro">5.0</span>
            <span className="text-negro/60 text-sm">· Basado en 47 reseñas</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE CARD DE TESTIMONIO
// ─────────────────────────────────────────────────────────────────────────────
interface TestimonioCardProps {
  nombre: string;
  ubicacion: string;
  fecha: string;
  texto: string;
  rating: number;
}

function TestimonioCard({ nombre, ubicacion, fecha, texto, rating }: TestimonioCardProps) {
  return (
    <div className="testimonio-card">
      {/* Estrellas */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star 
            key={i} 
            className="w-5 h-5 fill-amber-400 text-amber-400" 
          />
        ))}
      </div>
      
      {/* Texto */}
      <p className="text-negro/80 text-sm sm:text-base leading-relaxed mb-6">
        {texto}
      </p>
      
      {/* Autor */}
      <div>
        <p className="font-semibold text-negro">{nombre}</p>
        <p className="text-negro/50 text-sm">{ubicacion}</p>
        <p className="text-negro/40 text-xs mt-1">{fecha}</p>
      </div>
    </div>
  );
}
