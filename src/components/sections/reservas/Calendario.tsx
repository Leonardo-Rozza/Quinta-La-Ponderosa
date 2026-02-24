// ═══════════════════════════════════════════════════════════════════════════════
// Calendario.tsx - Componente visual del calendario
// ═══════════════════════════════════════════════════════════════════════════════
'use client';

import { DiaInfo } from '@/hooks/useCalendario';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface CalendarioProps {
  nombreMes: string;
  diasDelMes: Date[];
  getDiaInfo: (fecha: Date) => DiaInfo;
  onSeleccionarDia: (fecha: Date) => void;
  onMesAnterior: () => void;
  onMesSiguiente: () => void;
  puedeIrAtras: boolean;
}

export function Calendario({
  nombreMes,
  diasDelMes,
  getDiaInfo,
  onSeleccionarDia,
  onMesAnterior,
  onMesSiguiente,
  puedeIrAtras,
}: CalendarioProps) {
  return (
    <div className="calendario-container">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-serif text-xl sm:text-2xl text-negro capitalize">{nombreMes}</h3>
        <div className="flex gap-2">
          <button
            onClick={onMesAnterior}
            disabled={!puedeIrAtras}
            className="calendario-nav-btn"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onMesSiguiente}
            className="calendario-nav-btn"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="text-center text-xs sm:text-sm font-medium text-negro/50 py-2">
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {diasDelMes.map((fecha) => {
          const info = getDiaInfo(fecha);
          return (
            <DiaCelda
              key={fecha.toISOString()}
              info={info}
              onClick={() => onSeleccionarDia(fecha)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-negro/10">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="w-3 h-3 rounded-full bg-disponible" />
          <span className="text-negro/60">Disponible</span>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="w-3 h-3 rounded-full bg-ocupado" />
          <span className="text-negro/60">Ocupado</span>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="w-3 h-3 rounded-full bg-terracota" />
          <span className="text-negro/60">Seleccionado</span>
        </div>
      </div>
    </div>
  );
}

interface DiaCeldaProps {
  info: DiaInfo;
  onClick: () => void;
}

function DiaCelda({ info, onClick }: DiaCeldaProps) {
  const { fecha, esMesActual, esOcupado, esPasado, esSeleccionado, esHoy } = info;

  const deshabilitado = esOcupado || esPasado || !esMesActual;

  let clases = 'calendario-dia';

  if (!esMesActual) {
    clases += ' calendario-dia-otro-mes';
  } else if (esOcupado) {
    clases += ' calendario-dia-ocupado';
  } else if (esPasado) {
    clases += ' calendario-dia-pasado';
  } else if (esSeleccionado) {
    clases += ' calendario-dia-seleccionado';
  } else {
    clases += ' calendario-dia-disponible';
  }

  if (esHoy && esMesActual) {
    clases += ' calendario-dia-hoy';
  }

  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      className={clases}
      aria-label={`${fecha.getDate()} ${esOcupado ? '(ocupado)' : ''}`}
    >
      {fecha.getDate()}
    </button>
  );
}
