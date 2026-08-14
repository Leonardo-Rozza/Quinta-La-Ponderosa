'use client';

import { DiaInfo } from '@/hooks/useCalendario';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { KeyboardEvent, useMemo, useRef, useState } from 'react';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface CalendarioProps {
  nombreMes: string;
  diasDelMes: Date[];
  getDiaInfo: (fecha: Date) => DiaInfo;
  onSeleccionarDia: (fecha: Date) => void;
  onMesAnterior: () => void;
  onMesSiguiente: () => void;
  puedeIrAtras: boolean;
  puedeIrAdelante: boolean;
}

function fechaKey(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export function Calendario({
  nombreMes,
  diasDelMes,
  getDiaInfo,
  onSeleccionarDia,
  onMesAnterior,
  onMesSiguiente,
  puedeIrAtras,
  puedeIrAdelante,
}: CalendarioProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [fechaConFoco, setFechaConFoco] = useState('');

  const semanas = useMemo(
    () => Array.from({ length: Math.ceil(diasDelMes.length / 7) }, (_, index) => diasDelMes.slice(index * 7, index * 7 + 7)),
    [diasDelMes]
  );

  const focoInicial = useMemo(() => {
    const seleccionada = diasDelMes.find((fecha) => getDiaInfo(fecha).esSeleccionado);
    const primeraDisponible = diasDelMes.find((fecha) => {
      const info = getDiaInfo(fecha);
      return info.esMesActual && !info.esOcupado && !info.esPasado && !info.esFueraHorizonte;
    });
    return seleccionada ?? primeraDisponible ?? diasDelMes[0];
  }, [diasDelMes, getDiaInfo]);

  const focoEfectivo = diasDelMes.some((fecha) => fechaKey(fecha) === fechaConFoco)
    ? fechaConFoco
    : focoInicial
      ? fechaKey(focoInicial)
      : '';

  const moverFoco = (indiceActual: number, indiceDestino: number) => {
    const indiceSeguro = Math.max(0, Math.min(diasDelMes.length - 1, indiceDestino));
    const destino = diasDelMes[indiceSeguro];
    if (!destino) return;

    setFechaConFoco(fechaKey(destino));
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-calendar-index="${indiceSeguro}"]`)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const movimientos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in movimientos) {
      event.preventDefault();
      moverFoco(indice, indice + movimientos[event.key]);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moverFoco(indice, indice - (indice % 7));
    }

    if (event.key === 'End') {
      event.preventDefault();
      moverFoco(indice, indice + (6 - (indice % 7)));
    }
  };

  return (
    <div className="calendar-card">
      <div className="calendar-card__header">
        <div>
          <p>Disponibilidad</p>
          <h3 id="calendar-month" className="capitalize">{nombreMes}</h3>
        </div>
        <div className="calendar-card__nav" aria-label="Cambiar mes">
          <button type="button" onClick={onMesAnterior} disabled={!puedeIrAtras} aria-label="Mes anterior">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={onMesSiguiente} disabled={!puedeIrAdelante} aria-label="Mes siguiente">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="sr-only" id="calendar-help">
        Usá las flechas para recorrer los días y Enter para seleccionar una fecha disponible.
      </p>

      <div
        ref={gridRef}
        className="calendar-grid"
        role="grid"
        aria-labelledby="calendar-month"
        aria-describedby="calendar-help"
      >
        <div className="calendar-grid__row calendar-grid__weekdays" role="row">
          {DIAS_SEMANA.map((dia) => (
            <span role="columnheader" aria-label={dia} key={dia}>{dia}</span>
          ))}
        </div>

        {semanas.map((semana, fila) => (
          <div className="calendar-grid__row" role="row" key={fechaKey(semana[0])}>
            {semana.map((fecha, columna) => {
              const info = getDiaInfo(fecha);
              const indice = fila * 7 + columna;
              const deshabilitado = info.esOcupado || info.esPasado || info.esFueraHorizonte || !info.esMesActual;
              const etiquetaEstado = info.esOcupado
                ? 'ocupado'
                : info.esPasado
                  ? 'no disponible'
                  : info.esFueraHorizonte
                    ? 'fuera del período habilitado para reservas'
                  : !info.esMesActual
                    ? 'fuera del mes actual'
                    : info.esSeleccionado
                      ? 'seleccionado'
                      : 'disponible';
              const etiquetaFecha = new Intl.DateTimeFormat('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              }).format(fecha);

              return (
                <span role="gridcell" aria-selected={info.esSeleccionado} key={fechaKey(fecha)}>
                  <button
                    type="button"
                    data-calendar-index={indice}
                    className={`calendar-day${info.esSeleccionado ? ' calendar-day--selected' : ''}${
                      info.esOcupado ? ' calendar-day--occupied' : ''
                    }${info.esPasado || info.esFueraHorizonte ? ' calendar-day--past' : ''}${
                      !info.esMesActual ? ' calendar-day--outside' : ''
                    }`}
                    onClick={() => !deshabilitado && onSeleccionarDia(fecha)}
                    onFocus={() => setFechaConFoco(fechaKey(fecha))}
                    onKeyDown={(event) => handleKeyDown(event, indice)}
                    tabIndex={focoEfectivo === fechaKey(fecha) ? 0 : -1}
                    aria-label={`${etiquetaFecha}, ${etiquetaEstado}`}
                    aria-disabled={deshabilitado}
                    aria-current={info.esHoy ? 'date' : undefined}
                  >
                    {fecha.getDate()}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="calendar-legend" aria-label="Referencias del calendario">
        <span><i className="calendar-legend__available" aria-hidden="true" /> Disponible</span>
        <span><i className="calendar-legend__occupied" aria-hidden="true" /> Ocupado</span>
        <span><i className="calendar-legend__selected" aria-hidden="true" /> Seleccionado</span>
      </div>
    </div>
  );
}
