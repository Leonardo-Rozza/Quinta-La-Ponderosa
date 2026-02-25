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
  porDia: 250_000, // $250.000 ARS
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

// Fechas ocupadas mock (en producción viene de la BD)
export const FECHAS_OCUPADAS_MOCK: Date[] = [];
