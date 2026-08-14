'use client';

import { generarLinkWhatsApp } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 480);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <a
      href={generarLinkWhatsApp('Hola, quisiera consultar por una fecha en La Ponderosa.')}
      target="_blank"
      rel="noopener noreferrer"
      className={`whatsapp-contact${isVisible ? ' whatsapp-contact--visible' : ''}`}
      aria-label="Consultar disponibilidad por WhatsApp, se abre en una pestaña nueva"
      tabIndex={isVisible ? 0 : -1}
    >
      <MessageCircle aria-hidden="true" />
      <span>¿Una duda? Escribinos</span>
    </a>
  );
}
