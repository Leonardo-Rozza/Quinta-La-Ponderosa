import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { CONFIG } from "@/lib/constants";

export function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">

      {/* Imagen de fondo */}
      <Image
        src="/images/hero.jpeg"  // Cambiá a .webp si tu imagen es webp
        alt="Vista del parque de La Ponderosa"
        fill
        priority
        quality={85}
        className="object-cover object-center"
        sizes="100vw"
      />

      {/* Overlay oscuro con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />

      {/* Contenido */}
      <div className="relative z-10 flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">

          {/* Badge de ubicación */}
          <div
            className="
              mb-4 sm:mb-6
              inline-flex items-center gap-2
              rounded-full
              bg-white/10 backdrop-blur-sm
              px-4 py-2
              text-white/90 text-sm
              animate-fade-in-down
            "
          >
            <MapPin className="h-4 w-4" />
            <span>{CONFIG.direccion}</span>
          </div>

          {/* Título principal */}
          <h1
            className="
              font-serif text-white
              text-4xl sm:text-5xl md:text-6xl lg:text-7xl
              leading-tight
              max-w-xl lg:max-w-2xl
              mb-4 sm:mb-6
              animate-fade-in-up
            "
            style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
          >
            Tu refugio en la{" "}
            <span className="text-terracota italic">naturaleza</span>
          </h1>

          {/* Descripción */}
          <p
            className="
              text-white/80
              text-base sm:text-lg lg:text-xl
              leading-relaxed
              max-w-md lg:max-w-lg
              mb-6 sm:mb-8
              animate-fade-in-up
            "
            style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
          >
            Desconectate de la ciudad en nuestra quinta.
            Perfecta para familias y grupos de amigos que buscan tranquilidad,
            naturaleza y momentos inolvidables.
          </p>

          {/* Botones */}
          <div
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-in-up"
            style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
          >
            <Link href="#reservas" className="btn-primary">
              Ver Disponibilidad
            </Link>
            <Link
              href="#galeria"
              className="btn-secondary border-white text-white hover:bg-white hover:text-negro"
            >
              Ver Galería
            </Link>
          </div>
        </div>
      </div>

      {/* Indicador de scroll (solo desktop) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-white/60">
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2">
          <div className="w-1 h-2 bg-white/60 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}