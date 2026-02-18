
import { MapPin, Clock, Car, Phone } from "lucide-react";
import { CONFIG, PRECIOS } from "@/lib/constants";

export function Ubicacion() {
  return (
    <section id="ubicacion" className="py-16 sm:py-20 lg:py-24 bg-crema">
      <div className="section-container">
        
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Ubicación</span>
          <h2 className="section-title mb-4">Cómo llegar</h2>
          <p className="text-negro/70 text-base sm:text-lg max-w-2xl mx-auto">
            Estamos a solo 40 minutos de Capital Federal
          </p>
        </div>

        {/* Contenido: Info + Mapa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Columna izquierda: Información */}
          <div className="space-y-6">
            
            {/* Card de dirección */}
            <div className="bg-crema rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-oliva/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-oliva" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-negro mb-1">Dirección</h3>
                  <p className="text-negro/70">
                    Eduardo Wilde 2055<br />
                    José C. Paz, Buenos Aires
                  </p>
                </div>
              </div>
            </div>

            {/* Card de horarios */}
            <div className="bg-crema rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-oliva/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-oliva" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-negro mb-1">Horario de uso</h3>
                  <p className="text-negro/70">
                    {PRECIOS.horarioInicio} a {PRECIOS.horarioFin} hs<br />
                    <span className="text-sm text-negro/50">Check-in flexible con aviso previo</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card de acceso */}
            <div className="bg-crema rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-oliva/10 flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-oliva" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-negro mb-1">Cómo llegar</h3>
                  <p className="text-negro/70 text-sm leading-relaxed">
                    • Desde Capital: Acceso Norte, Ruta 8, salida José C. Paz<br />
                    • Desde Zona Norte: Av. Constituyentes hasta Ruta 8<br />
                    • Coordenadas GPS disponibles al confirmar reserva
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de contacto */}
            <a 
              href={`https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent("Hola! Necesito indicaciones para llegar a La Ponderosa")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-oliva w-full justify-center"
            >
              <Phone className="w-5 h-5" />
              Consultar indicaciones
            </a>
          </div>

          {/* Columna derecha: Mapa */}
          <div className="relative">
            <div className="ubicacion-mapa-container">
              {/* 
                IMPORTANTE: Reemplazá este iframe con tu ubicación real
                
                Para obtener el embed de Google Maps:
                1. Andá a Google Maps
                2. Buscá tu dirección
                3. Click en "Compartir" → "Incorporar un mapa"
                4. Copiá el código del iframe
                5. Reemplazá el src de abajo
              */}
             <iframe
               src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3287.6769328947707!2d-58.765210787669744!3d-34.511073772875086!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95bc99aea53fc0b1%3A0xe36044ad0f8cbc2a!2sQuinta%20La%20Ponderosa!5e0!3m2!1ses-419!2sar!4v1771379914860!5m2!1ses-419!2sar"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de La Ponderosa"
              />
            </div>
            
            {/* Badge sobre el mapa */}
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
              <span className="text-sm font-medium text-negro">
                📍 José C. Paz, Buenos Aires
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

