/**
 * ============================================================================
 * QUÉ HACE:
 * Funciones puras de TypeScript (sin acceso al DOM) para el módulo
 * `landing-shell`: enlaces de navegación, cálculo de índices del carrusel
 * de historia USM y armado del enlace directo a WhatsApp de contacto.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `NAV_ITEMS`: cambia el texto o el orden de los enlaces del Header y Footer.
 * - `DEFAULT_WHATSAPP_GREETING`: personaliza el mensaje inicial cuando un
 *   cliente hace clic en el botón de WhatsApp de la sección Contacto.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usado por `Header.astro`, `QuienesSomos.astro`, `Contacto.astro` y
 *   `Footer.astro` dentro de `src/features/landing-shell/ui/`.
 * - Reexportado por `src/features/landing-shell/index.ts`.
 * ============================================================================
 */

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Enlaces principales de navegación interna (anclas de `src/pages/index.astro`).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Catálogo', href: '#catalogo' },
  { label: 'Quiénes Somos', href: '#quienes-somos' },
  { label: 'Contacto', href: '#contacto' },
] as const;

/**
 * Mensaje precargado al tocar el acceso directo de WhatsApp en Contacto.
 */
export const DEFAULT_WHATSAPP_GREETING =
  'Hola GoManía! Tengo una consulta sobre sus gomitas y maníes.';

/**
 * Limpia un número telefónico dejando solo dígitos y construye la URL `wa.me`.
 */
export function buildWhatsAppContactUrl(
  rawPhone: string,
  message: string = DEFAULT_WHATSAPP_GREETING
): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encodedText}`;
}

/**
 * Formatea un número chileno de 11 dígitos (ej. `56912345678`) a formato
 * legible (`+56 9 1234 5678`) para mostrar en pantalla.
 */
export function formatChilePhoneDisplay(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('569')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return digits ? `+${digits}` : rawPhone;
}

/**
 * Restringe un índice dentro del rango válido `[0, total - 1]`.
 */
export function clampStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  if (index < 0) return 0;
  if (index >= total) return total - 1;
  return index;
}

/**
 * Calcula el índice siguiente del carrusel con rotación circular.
 */
export function getNextStepIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/**
 * Calcula el índice anterior del carrusel con rotación circular.
 */
export function getPrevStepIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}
