'use client';

import { PRECIOS } from '@/lib/constants';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';

export interface DiaInfo {
  fecha: Date;
  esMesActual: boolean;
  esHoy: boolean;
  esOcupado: boolean;
  esPasado: boolean;
  esFueraHorizonte: boolean;
  esSeleccionado: boolean;
}

interface UseCalendarioProps {
  fechasOcupadas: Date[];
  maxAdvanceDays: number;
}

function claveFecha(fecha: Date) {
  return format(fecha, 'yyyy-MM-dd');
}

export function useCalendario({ fechasOcupadas, maxAdvanceDays }: UseCalendarioProps) {
  const [mesActual, setMesActual] = useState(() => startOfMonth(new Date()));
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);

  const fechasOcupadasSet = useMemo(
    () => new Set(fechasOcupadas.map((fecha) => claveFecha(fecha))),
    [fechasOcupadas]
  );

  const diasDelMes = useMemo(() => {
    const inicioMes = startOfMonth(mesActual);
    const finMes = endOfMonth(mesActual);

    return eachDayOfInterval({
      start: startOfWeek(inicioMes, { weekStartsOn: 0 }),
      end: endOfWeek(finMes, { weekStartsOn: 0 }),
    });
  }, [mesActual]);

  const getDiaInfo = useCallback(
    (fecha: Date): DiaInfo => {
      const hoy = startOfDay(new Date());
      const fechaMinima = addDays(hoy, 1);
      const fechaMaxima = addDays(hoy, maxAdvanceDays);

      return {
        fecha,
        esMesActual: isSameMonth(fecha, mesActual),
        esHoy: isSameDay(fecha, hoy),
        esOcupado: fechasOcupadasSet.has(claveFecha(fecha)),
        esPasado: isBefore(fecha, fechaMinima),
        esFueraHorizonte: isAfter(fecha, fechaMaxima),
        esSeleccionado: fechaSeleccionada ? isSameDay(fecha, fechaSeleccionada) : false,
      };
    },
    [fechaSeleccionada, fechasOcupadasSet, maxAdvanceDays, mesActual]
  );

  const seleccionarDia = useCallback(
    (fecha: Date) => {
      const info = getDiaInfo(fecha);
      if (info.esOcupado || info.esPasado || info.esFueraHorizonte || !info.esMesActual) return;

      setFechaSeleccionada((actual) => (actual && isSameDay(actual, fecha) ? null : fecha));
    },
    [getDiaInfo]
  );

  const irMesAnterior = useCallback(() => setMesActual((actual) => subMonths(actual, 1)), []);
  const irMesSiguiente = useCallback(() => setMesActual((actual) => addMonths(actual, 1)), []);

  const puedeIrAtras = useMemo(() => {
    const mesAnterior = startOfMonth(subMonths(mesActual, 1));
    return !isBefore(mesAnterior, startOfMonth(new Date()));
  }, [mesActual]);

  const puedeIrAdelante = useMemo(() => {
    const inicioMesSiguiente = startOfMonth(addMonths(mesActual, 1));
    const fechaMaxima = addDays(startOfDay(new Date()), maxAdvanceDays);
    return !isAfter(inicioMesSiguiente, fechaMaxima);
  }, [maxAdvanceDays, mesActual]);

  const precioCalculado = useMemo(() => {
    if (!fechaSeleccionada) return null;
    return {
      total: PRECIOS.porDia,
      sena: PRECIOS.porDia * PRECIOS.porcentajeSena,
    };
  }, [fechaSeleccionada]);

  const resetearSeleccion = useCallback(() => setFechaSeleccionada(null), []);
  const nombreMes = format(mesActual, 'MMMM yyyy', { locale: es });

  return {
    mesActual,
    fechaSeleccionada,
    diasDelMes,
    nombreMes,
    precioCalculado,
    getDiaInfo,
    puedeIrAtras,
    puedeIrAdelante,
    seleccionarDia,
    irMesAnterior,
    irMesSiguiente,
    resetearSeleccion,
  };
}
