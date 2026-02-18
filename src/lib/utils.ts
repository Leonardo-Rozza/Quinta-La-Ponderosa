import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { CONFIG } from "./constants";

/**
 * Combina clases de Tailwind de forma inteligente
 * cn("bg-red-500", isHovered && "bg-blue-500") → resuelve conflictos
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como precio en ARS
 * 250000 → "$250.000"
 */
export function formatearPrecio(precio: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(precio);
}

/**
 * Formatea fecha corta
 * new Date(2026, 1, 15) → "15 feb"
 */
export function formatearFechaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(fecha);
}

/**
 * Formatea fecha completa
 * new Date(2026, 1, 15) → "domingo, 15 de febrero de 2026"
 */
export function formatearFechaCompleta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/**
 * Genera link de WhatsApp con mensaje
 */
export function generarLinkWhatsApp(mensajeCustom?: string): string {
  const mensaje = mensajeCustom || CONFIG.whatsappMessage;
  return `https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Verifica si dos fechas son el mismo día
 */
export function esMismaFecha(fecha1: Date, fecha2: Date): boolean {
  return (
    fecha1.getFullYear() === fecha2.getFullYear() &&
    fecha1.getMonth() === fecha2.getMonth() &&
    fecha1.getDate() === fecha2.getDate()
  );
}

/**
 * Verifica si una fecha está en el pasado
 */
export function esFechaPasada(fecha: Date): boolean {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaNormalizada = new Date(fecha);
  fechaNormalizada.setHours(0, 0, 0, 0);
  return fechaNormalizada < hoy;
}