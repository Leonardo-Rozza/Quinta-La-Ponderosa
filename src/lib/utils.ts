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
 * Genera link de WhatsApp con mensaje
 */
export function generarLinkWhatsApp(mensajeCustom?: string): string {
  const mensaje = mensajeCustom || CONFIG.whatsappMessage;
  return `https://wa.me/${CONFIG.telefono}?text=${encodeURIComponent(mensaje)}`;
}