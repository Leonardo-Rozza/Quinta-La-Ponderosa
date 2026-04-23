'use client';

import { CONFIG, NAV_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detectar scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Bloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
  }, [isMenuOpen]);

  // ─────────────────────────────────────────────────────────────────────────
  // FUNCIÓN PARA SCROLL SUAVE A UNA SECCIÓN
  // ─────────────────────────────────────────────────────────────────────────
  const scrollToSection = (sectionId: string) => {
    // Cerrar menú móvil si está abierto
    setIsMenuOpen(false);

    // Pequeño delay para que el menú se cierre primero
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 100);
  };

  return (
    <>
      {/* Navbar principal */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50',
          'transition-all duration-300',
          !isScrolled && 'bg-transparent',
          isScrolled && 'bg-crema/95 backdrop-blur-md shadow-sm'
        )}
      >
        <div className="section-container flex justify-between items-center h-16 md:h-20">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 z-10"
          >
            <div
              className={cn(
                'w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center',
                'transition-colors duration-300',
                !isScrolled ? 'bg-white/20' : 'bg-oliva'
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 md:w-6 md:h-6 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 3c-1.5 3-3 5.5-3 9 0 4 2 6 3 6s3-2 3-6c0-3.5-1.5-6-3-9z" />
                <path d="M12 12v9" />
              </svg>
            </div>
            <span
              className={cn(
                'font-serif text-lg md:text-xl',
                'transition-colors duration-300',
                !isScrolled ? 'text-white' : 'text-negro'
              )}
            >
              {CONFIG.siteName}
            </span>
          </button>

          {/* Links desktop */}
          <ul className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <button
                  onClick={() => scrollToSection(link.href.replace('#', ''))}
                  className={cn(
                    'text-sm font-medium transition-colors duration-300 hover-line',
                    !isScrolled
                      ? 'text-white/90 hover:text-white'
                      : 'text-negro/80 hover:text-negro'
                  )}
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Botón CTA desktop */}
          <button
            onClick={() => scrollToSection('reservas')}
            className={cn('hidden md:inline-flex btn-oliva py-2.5 px-5')}
          >
            Reservar Ahora
          </button>

          {/* Botón hamburguesa móvil */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              'md:hidden z-10 w-10 h-10 flex items-center justify-center rounded-full',
              'transition-colors duration-300',
              !isScrolled && !isMenuOpen && 'text-white',
              isScrolled && !isMenuOpen && 'text-negro',
              isMenuOpen && 'text-negro'
            )}
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Menú móvil overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-crema transition-all duration-300',
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center justify-center h-full px-4">
          <ul className="flex flex-col items-center gap-6 mb-8">
            {NAV_LINKS.map((link, index) => (
              <li
                key={link.href}
                style={{ transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms' }}
                className={cn(
                  'transition-all duration-300',
                  isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
              >
                <button
                  onClick={() => scrollToSection(link.href.replace('#', ''))}
                  className="font-serif text-3xl text-negro hover:text-terracota transition-colors"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          <div
            style={{ transitionDelay: isMenuOpen ? '200ms' : '0ms' }}
            className={cn(
              'transition-all duration-300',
              isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            <button onClick={() => scrollToSection('reservas')} className="btn-primary">
              Reservar Ahora
            </button>
          </div>

          <div
            style={{ transitionDelay: isMenuOpen ? '250ms' : '0ms' }}
            className={cn(
              'mt-12 text-center transition-all duration-300',
              isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            <p className="text-negro/60 text-sm mb-2">{CONFIG.direccion}</p>
            <a
              href={`tel:${CONFIG.telefono}`}
              className="text-terracota font-medium hover:underline"
            >
              {CONFIG.telefonoDisplay}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
