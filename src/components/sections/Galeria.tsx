'use client';

import { ArrowDownRight, ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { KeyboardEvent, PointerEvent, SyntheticEvent, useEffect, useRef, useState } from 'react';
import { SectionIntro } from './shared/SectionIntro';

const IMAGENES = [
  {
    src: '/images/reposeras-gazebo.jpeg',
    alt: 'Reposeras de madera bajo el gazebo junto al parque',
    titulo: 'El parque',
    detalle: 'Sombra para acompañar el día',
  },
  {
    src: '/images/quincho-amplio.jpeg',
    alt: 'Interior amplio del quincho con mesas y sillas',
    titulo: 'El quincho',
    detalle: 'Una mesa larga para encontrarse',
  },
  {
    src: '/images/parrilla.jpeg',
    alt: 'Sector de parrilla de La Ponderosa',
    titulo: 'La parrilla',
    detalle: 'El fuego como punto de reunión',
  },
  {
    src: '/images/horno-barro.jpeg',
    alt: 'Horno de barro exterior',
    titulo: 'El horno',
    detalle: 'Otra forma de cocinar juntos',
  },
  {
    src: '/images/heladera-freezer.jpeg',
    alt: 'Heladera con freezer disponible en el quincho',
    titulo: 'El equipamiento',
    detalle: 'Lo práctico también importa',
  },
] as const;

export function Galeria() {
  const [imagenActiva, setImagenActiva] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const backdropPointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (imagenActiva !== null && dialog && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => closeRef.current?.focus());
    }
  }, [imagenActiva]);

  const abrirVisor = (index: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setImagenActiva(index);
  };
  const cerrarVisor = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  };
  const cancelarVisor = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    cerrarVisor();
  };
  const completarCierre = () => {
    backdropPointerIdRef.current = null;
    setImagenActiva(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };
  const estaFueraDelDialogo = (event: PointerEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    return (
      event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom
    );
  };
  const iniciarCierreDesdeBackdrop = (event: PointerEvent<HTMLDialogElement>) => {
    backdropPointerIdRef.current = event.isPrimary
      && event.button === 0
      && estaFueraDelDialogo(event)
      ? event.pointerId
      : null;
  };
  const completarCierreDesdeBackdrop = (event: PointerEvent<HTMLDialogElement>) => {
    const empezoFuera = backdropPointerIdRef.current === event.pointerId;
    backdropPointerIdRef.current = null;

    if (
      empezoFuera
      && event.isPrimary
      && event.button === 0
      && estaFueraDelDialogo(event)
    ) {
      cerrarVisor();
    }
  };
  const cancelarCierreDesdeBackdrop = () => {
    backdropPointerIdRef.current = null;
  };
  const moverImagen = (direccion: -1 | 1) => {
    setImagenActiva((actual) => {
      if (actual === null) return 0;
      return (actual + direccion + IMAGENES.length) % IMAGENES.length;
    });
  };
  const manejarTeclado = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cerrarVisor();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moverImagen(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moverImagen(1);
    }
  };

  return (
    <section className="gallery section-shell" aria-labelledby="gallery-title">
      <div id="galeria" className="section-container">
        <div className="gallery__heading">
          <SectionIntro
            align="left"
            eyebrow="03 · Recorrer el lugar"
            title={<span id="gallery-title">Espacios reales, sin letra chica.</span>}
            description="Una mirada honesta a los lugares que vas a usar. Las fotografías pertenecen a La Ponderosa."
          />
          <Link className="text-link" href="#ubicacion">
            Ver ubicación
            <ArrowDownRight aria-hidden="true" />
          </Link>
        </div>

        <div className="gallery__grid">
          {IMAGENES.map((imagen, index) => (
            <figure className={`gallery-card gallery-card--${index + 1}`} key={imagen.src}>
              <button
                type="button"
                className="gallery-card__button"
                onClick={(event) => abrirVisor(index, event.currentTarget)}
                aria-label={`Abrir foto ${index + 1} de ${IMAGENES.length}: ${imagen.titulo}`}
              >
                <span className="gallery-card__image">
                  <Image
                    src={imagen.src}
                    alt={imagen.alt}
                    fill
                    className="object-cover"
                    sizes={
                      index === 0
                        ? '(max-width: 760px) 100vw, 58vw'
                        : '(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 28vw'
                    }
                  />
                  <span className="gallery-card__expand" aria-hidden="true"><Expand /></span>
                </span>
              </button>
              <figcaption>
                <strong>{imagen.titulo}</strong>
                <span>{imagen.detalle}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <dialog
          ref={dialogRef}
          className="gallery-viewer"
          onClose={completarCierre}
          onCancel={cancelarVisor}
          onKeyDown={manejarTeclado}
          onPointerDown={iniciarCierreDesdeBackdrop}
          onPointerUp={completarCierreDesdeBackdrop}
          onPointerCancel={cancelarCierreDesdeBackdrop}
          aria-labelledby="gallery-viewer-title"
        >
          {imagenActiva !== null ? (
            <div className="gallery-viewer__inner">
              <div className="gallery-viewer__topline">
                <div>
                  <p>Foto {imagenActiva + 1} de {IMAGENES.length}</p>
                  <h3 id="gallery-viewer-title">{IMAGENES[imagenActiva].titulo}</h3>
                </div>
                <button ref={closeRef} type="button" onClick={cerrarVisor} aria-label="Cerrar galería">
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="gallery-viewer__image">
                <Image
                  src={IMAGENES[imagenActiva].src}
                  alt={IMAGENES[imagenActiva].alt}
                  fill
                  sizes="95vw"
                  className="object-contain"
                />
              </div>

              <p className="gallery-viewer__caption">{IMAGENES[imagenActiva].detalle}</p>
              <div className="gallery-viewer__nav">
                <button type="button" onClick={() => moverImagen(-1)}>
                  <ChevronLeft aria-hidden="true" /> Anterior
                </button>
                <button type="button" onClick={() => moverImagen(1)}>
                  Siguiente <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </dialog>
      </div>
    </section>
  );
}
