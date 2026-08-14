'use client';

import { CONFIG, NAV_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Leaf, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    const backgroundElements = [
      headerInnerRef.current,
      ...Array.from(document.querySelectorAll<HTMLElement>('main, footer, .skip-link, .whatsapp-contact')),
    ].filter((element): element is HTMLElement => Boolean(element));
    const previousInert = backgroundElements.map((element) => element.hasAttribute('inert'));

    document.body.style.overflow = 'hidden';
    backgroundElements.forEach((element) => element.setAttribute('inert', ''));
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusables = mobileMenuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute('inert');
      });
      window.removeEventListener('keydown', handleKeyDown);
      menuButton?.focus();
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 64.0625rem)');
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMenuOpen(false);
    };
    desktopQuery.addEventListener('change', closeAtDesktop);
    return () => desktopQuery.removeEventListener('change', closeAtDesktop);
  }, []);

  useEffect(() => {
    const closeOnNavigation = () => setIsMenuOpen(false);
    window.addEventListener('hashchange', closeOnNavigation);
    window.addEventListener('popstate', closeOnNavigation);
    return () => {
      window.removeEventListener('hashchange', closeOnNavigation);
      window.removeEventListener('popstate', closeOnNavigation);
    };
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={cn('site-header', isScrolled && 'site-header--scrolled')}>
      <div ref={headerInnerRef} className="section-container site-header__inner" aria-hidden={isMenuOpen || undefined}>
        <Link href="/#inicio" className="brand" aria-label="La Ponderosa, volver al inicio">
          <span className="brand__mark" aria-hidden="true">
            <Leaf />
          </span>
          <span className="brand__name">{CONFIG.siteName}</span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegación principal">
          <ul>
            {NAV_LINKS.slice(0, 4).map((link) => (
              <li key={link.href}>
                <Link href={`/${link.href}`}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/#reservas" className="button button--header">
          Reservar
          <ArrowUpRight aria-hidden="true" />
        </Link>

        <button
          ref={menuButtonRef}
          type="button"
          className="menu-toggle"
          onClick={() => setIsMenuOpen(true)}
          aria-expanded={isMenuOpen}
          aria-controls="menu-movil"
          aria-label="Abrir menú"
        >
          <Menu aria-hidden="true" />
        </button>
      </div>

      {isMenuOpen ? (
        <div ref={mobileMenuRef} id="menu-movil" className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="mobile-menu__top">
            <span className="brand brand--dark" aria-hidden="true">
              <span className="brand__mark">
                <Leaf />
              </span>
              <span className="brand__name">{CONFIG.siteName}</span>
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              className="menu-toggle menu-toggle--close"
              onClick={closeMenu}
              aria-label="Cerrar menú"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <nav className="mobile-nav" aria-label="Navegación móvil">
            <ol>
              {NAV_LINKS.map((link, index) => (
                <li key={link.href}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <Link href={`/${link.href}`} onClick={closeMenu}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mobile-menu__footer">
            <p>{CONFIG.direccion}</p>
            <Link href="/#reservas" className="button button--primary button--large" onClick={closeMenu}>
              Ver disponibilidad
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
