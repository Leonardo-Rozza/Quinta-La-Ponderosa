import { Navbar } from '@/components/layout/Navbar';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { Footer } from '@/components/sections/Footer';
import { Galeria } from '@/components/sections/Galeria';
import { Hero } from '@/components/sections/Hero';
import { Jornada } from '@/components/sections/Jornada';
import { Preguntas } from '@/components/sections/Preguntas';
import { Servicios } from '@/components/sections/Servicios';
import { Ubicacion } from '@/components/sections/Ubicacion';
import { Reservas } from '@/components/sections/reservas';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="contenido">
        <Hero />
        <Jornada />
        <Servicios />
        <Galeria />
        <Reservas />
        <Ubicacion />
        <Preguntas />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
