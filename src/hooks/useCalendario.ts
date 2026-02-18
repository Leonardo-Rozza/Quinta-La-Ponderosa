import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { PRECIOS } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface DiaInfo {
  fecha: Date;
  esMesActual: boolean;
  esHoy: boolean;
  esOcupado: boolean;
  esPasado: boolean;
  esSeleccionado: boolean;
}

interface UseCalendarioProps {
  fechasOcupadas: Date[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useCalendario({ fechasOcupadas }: UseCalendarioProps) {
  // Estado: mes que se está mostrando
  const [mesActual, setMesActual] = useState(new Date());

  // Estado: fecha seleccionada (solo una, porque es alquiler por día)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Generar todos los días visibles en el calendario
  // Incluye días del mes anterior y siguiente para completar las semanas
  // ─────────────────────────────────────────────────────────────────────────
  const diasDelMes = useMemo(() => {
    const inicioMes = startOfMonth(mesActual);
    const finMes = endOfMonth(mesActual);
    // weekStartsOn: 0 = Domingo
    const inicioSemana = startOfWeek(inicioMes, { weekStartsOn: 0 });
    const finSemana = endOfWeek(finMes, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: inicioSemana, end: finSemana });
  }, [mesActual]);

  // ─────────────────────────────────────────────────────────────────────────
  // Verificar si una fecha está ocupada
  // ─────────────────────────────────────────────────────────────────────────
  const estaOcupada = useCallback(
    (fecha: Date) => {
      return fechasOcupadas.some((ocupada) => isSameDay(fecha, ocupada));
    },
    [fechasOcupadas]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Obtener información de cada día para renderizar
  // ─────────────────────────────────────────────────────────────────────────
  const getDiaInfo = useCallback(
    (fecha: Date): DiaInfo => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Fecha mínima: mañana (no se puede reservar para hoy)
      const fechaMinima = new Date(hoy);
      fechaMinima.setDate(fechaMinima.getDate() + 1);

      return {
        fecha,
        esMesActual: isSameMonth(fecha, mesActual),
        esHoy: isSameDay(fecha, hoy),
        esOcupado: estaOcupada(fecha),
        esPasado: isBefore(fecha, fechaMinima),
        esSeleccionado: fechaSeleccionada ? isSameDay(fecha, fechaSeleccionada) : false,
      };
    },
    [mesActual, fechaSeleccionada, estaOcupada]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Seleccionar un día
  // ─────────────────────────────────────────────────────────────────────────
  const seleccionarDia = useCallback((fecha: Date) => {
    const info = getDiaInfo(fecha);

    // No permitir seleccionar días no disponibles
    if (info.esOcupado || info.esPasado || !info.esMesActual) {
      return;
    }

    // Si ya está seleccionado, deseleccionar
    if (fechaSeleccionada && isSameDay(fecha, fechaSeleccionada)) {
      setFechaSeleccionada(null);
    } else {
      setFechaSeleccionada(fecha);
    }
  }, [getDiaInfo, fechaSeleccionada]);

  // ─────────────────────────────────────────────────────────────────────────
  // Navegación entre meses
  // ─────────────────────────────────────────────────────────────────────────
  const irMesAnterior = useCallback(() => {
    setMesActual((prev) => subMonths(prev, 1));
  }, []);

  const irMesSiguiente = useCallback(() => {
    setMesActual((prev) => addMonths(prev, 1));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Verificar si puede ir al mes anterior (no permitir meses pasados)
  // ─────────────────────────────────────────────────────────────────────────
  const puedeIrAtras = useMemo(() => {
    const mesAnterior = subMonths(mesActual, 1);
    const hoy = new Date();
    return (
      mesAnterior.getMonth() >= hoy.getMonth() &&
      mesAnterior.getFullYear() >= hoy.getFullYear()
    );
  }, [mesActual]);

  // ─────────────────────────────────────────────────────────────────────────
  // Calcular precio
  // ─────────────────────────────────────────────────────────────────────────
  const precioCalculado = useMemo(() => {
    if (!fechaSeleccionada) return null;

    return {
      total: PRECIOS.porDia,
      sena: PRECIOS.porDia * PRECIOS.porcentajeSena,
    };
  }, [fechaSeleccionada]);

  // ─────────────────────────────────────────────────────────────────────────
  // Resetear selección
  // ─────────────────────────────────────────────────────────────────────────
  const resetearSeleccion = useCallback(() => {
    setFechaSeleccionada(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Nombre del mes formateado
  // ─────────────────────────────────────────────────────────────────────────
  const nombreMes = format(mesActual, "MMMM yyyy", { locale: es });

  return {
    // Estado
    mesActual,
    fechaSeleccionada,
    diasDelMes,
    nombreMes,
    precioCalculado,

    // Helpers
    getDiaInfo,
    puedeIrAtras,

    // Acciones
    seleccionarDia,
    irMesAnterior,
    irMesSiguiente,
    resetearSeleccion,
  };
}
