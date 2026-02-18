
import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Servicios } from "@/components/sections/Servicios";
import { Galeria } from "@/components/sections/Galeria";
import { Ubicacion } from "@/components/sections/Ubicacion";
import { Reservas } from "@/components/sections/reservas";
import { Footer } from "@/components/sections/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Servicios />
      <Galeria />
      {/* <Testimonios /> */}
      <Ubicacion />
      <Reservas />    
      <Footer />
      <WhatsAppButton/>
    </>
  );
}