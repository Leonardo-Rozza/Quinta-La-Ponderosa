import Image from "next/image";

// Datos de las imágenes
// Reemplazá los src con tus imágenes reales
const IMAGENES = [
  {
    src: "/images/reposeras-gazebo.jpeg",
    alt: "Reposeras bajo el gazebo",
    titulo: "Reposeras y Gazebo",
  },
  {
    src: "/images/heladera-freezer.jpeg",
    alt: "Heladera con freezer para bebidas",
    titulo: "Heladera con Freezer",
  },
  {
    src: "/images/parrilla.jpeg",
    alt: "Parrilla",
    titulo: "Parrilla",
  },
  {
    src: "/images/quincho-amplio.jpeg",
    alt: "Quincho amplio para eventos",
    titulo: "Quincho Amplio",
  },
  {
    src: "/images/horno-barro.jpeg",
    alt: "Horno de barro para pizzas",
    titulo: "Horno de Barro",
  },
];

export function Galeria() {
  return (
    <section id="galeria" className="py-16 sm:py-20 lg:py-24 bg-blanco">
      <div className="section-container">
        
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Galería</span>
          <h2 className="section-title mb-4">Conocé La Ponderosa</h2>
          <p className="text-negro/70 text-base sm:text-lg max-w-2xl mx-auto">
            Descubrí todos los espacios que tenemos para vos
          </p>
        </div>

        {/* Grid asimétrico */}
        <div className="galeria-grid">
          {IMAGENES.map((imagen, index) => (
            <div 
              key={index} 
              className={`galeria-item galeria-item-${index + 1}`}
            >
              <Image
                src={imagen.src}
                alt={imagen.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              
              {/* Overlay con título */}
              <div className="galeria-overlay">
                <span className="font-serif text-white text-lg sm:text-xl">
                  {imagen.titulo}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}