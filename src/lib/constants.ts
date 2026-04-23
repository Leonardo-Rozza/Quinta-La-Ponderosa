export const CONFIG = {
  siteName: 'La Ponderosa',
  telefono: '+5491124050772',
  telefonoDisplay: '+54 11 2405-0772',
  email: 'leonardorozza.dev@gmail.com',
  instagram: '@laponderosa',
  instagramUrl: 'https://www.instagram.com/quintalaponderosa.jcp/',
  direccion: 'José C. Paz · Buenos Aires',
  whatsappMessage: 'Hola! Me interesa hacer una reserva en La Ponderosa!',
} as const;

export const PRECIOS = {
  porDia: 300_000,
  porcentajeSena: 0.5, // 50%
  maximoPersonas: 30,
  horarioInicio: '10:00',
  horarioFin: '20:00',

  get sena() {
    return this.porDia * this.porcentajeSena;
  },
} as const;

export const NAV_LINKS = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#galeria', label: 'Galería' },
  { href: '#reservas', label: 'Reservas' },
  { href: '#ubicacion', label: 'Ubicación' },
  { href: '#contacto', label: 'Contacto' },
] as const;

export const SERVICIOS = [
  {
    id: 'pileta',
    titulo: 'Piscina',
    descripcion: 'Amplia piscina con zona de descanso y reposeras',
    icono: 'waves',
  },
  {
    id: 'parque',
    titulo: 'Parque Natural',
    descripcion: 'Parque arbolado',
    icono: 'trees',
  },
  {
    id: 'quincho',
    titulo: 'Quincho Equipado',
    descripcion: 'Parrilla, horno de barro y cocina completa',
    icono: 'flame',
  },
  {
    id: 'wifi',
    titulo: 'WiFi Gratis',
    descripcion: 'Internet de alta velocidad en toda la propiedad',
    icono: 'wifi',
  },
  {
    id: 'estacionamiento',
    titulo: 'Estacionamiento',
    descripcion: 'Amplio espacio para varios vehículos',
    icono: 'car',
  },
  {
    id: 'capacidad',
    titulo: 'Hasta 30 Personas',
    descripcion: 'Espacio ideal para eventos y reuniones grandes',
    icono: 'users',
  },
] as const;

// Fechas bloqueadas manualmente.
// Usá formato YYYY-MM-DD. Ejemplo: '2026-12-25'
// Cargá acá las fechas reservadas por otros canales para que el calendario las marque ocupadas.
export const FECHAS_BLOQUEADAS_MANUALES = [
  // '2026-12-25',
  // '2026-12-31',
] as const;

const FECHA_MANUAL_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function obtenerFechasBloqueadasManuales(): string[] {
  return [...new Set(FECHAS_BLOQUEADAS_MANUALES)]
    .filter((fecha) => {
      const esValida = FECHA_MANUAL_REGEX.test(fecha);

      if (!esValida) {
        console.warn(`Fecha manual ignorada por formato inválido: ${fecha}`);
      }

      return esValida;
    })
    .sort();
}
