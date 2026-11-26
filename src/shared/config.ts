/**
 * ============================================================================
 * QUÉ HACE:
 * Centraliza en un solo lugar toda la configuración editable de GoManía SpA:
 * datos de contacto, redes sociales, URLs del proxy PHP en HostGator,
 * tabla fija de formatos/precios, historia USM y tema visual por defecto.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `BRAND_CONFIG`: nombre, lema, dominio y rutas de logos a color.
 * - `SOCIAL_LINKS`: reemplaza el número de WhatsApp (`569XXXXXXXX`), correo
 *   y enlaces reales de TikTok, Instagram y Facebook.
 * - `API_ENDPOINTS`: rutas del proxy PHP en HostGator (`/api/catalogo.php`
 *   y `/api/pedido.php`) y tiempo máximo de espera.
 * - `BAG_TIERS`: precios y cupo máximo de sabores por formato (`80g` a `3kg`).
 * - `LANDING_CONFIG.defaultTheme`: cambia entre `'impacto-rosado'`,
 *   `'candy-limpio'` y `'pop-dual'`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa contratos `ILandingConfig` (`src/contracts/landing-shell.contract.ts`)
 *   y `BagTierDTO` (`src/contracts/mix-builder.contract.ts`).
 * - Consumido por `BaseLayout.astro`, `landing-shell`, `mix-builder`,
 *   `checkout-whatsapp` y `gestion-datos`.
 * ============================================================================
 */
import type {
  ILandingConfig,
  SocialLinksDTO,
  StoryMilestoneDTO,
  ThemeId,
} from '../contracts/landing-shell.contract';
import type { BagTierDTO } from '../contracts/mix-builder.contract';

/**
 * Identidad de marca y rutas de activos visuales (SOLO logos a color).
 * Reemplaza los archivos dentro de `public/images/brand/` con los PNG/SVG finales.
 */
export const BRAND_CONFIG = {
  name: 'GoManía SpA',
  shortName: 'GoManía',
  tagline: 'Más de 100 sabores',
  siteUrl: 'https://gomania.cl',
  description:
    'Arma tus bolsas de gomitas y maní por gramos en GoManía SpA. Más de 100 sabores dulces, ácidos y salados con despacho por Blue Express a todo Chile.',
  logoHorizontalUrl: '/images/brand/logo-horizontal-color.png',
  faviconUrl: '/images/brand/favicon-gm.svg',
  ogImageUrl: '/images/brand/og-gomania-color.png',
} as const;

/**
 * Tema visual activo por defecto.
 * Opciones válidas: 'impacto-rosado' | 'candy-limpio' | 'pop-dual'
 */
export const DEFAULT_THEME: ThemeId = 'candy-limpio';

/**
 * Placeholders de contacto y redes sociales.
 * IMPORTANTE: En `whatsappNumber` usa solo dígitos con código de país (sin `+` ni espacios).
 */
export const SOCIAL_LINKS: SocialLinksDTO = {
  whatsappNumber: '56900000000', // TODO: Reemplazar por el WhatsApp real de GoManía
  email: 'contacto@gomania.cl',  // TODO: Reemplazar cuando el correo corporativo esté activo
  tiktok: 'https://www.tiktok.com/@gomania.cl',
  instagram: 'https://www.instagram.com/gomania.cl',
  facebook: 'https://www.facebook.com/gomania.cl',
};

/**
 * Endpoints del proxy PHP en HostGator Plan Negocios.
 * En desarrollo local, si el proxy no responde, `gestion-datos` usará `mock-catalogo.ts`.
 */
export const API_ENDPOINTS = {
  catalogoUrl: '/api/catalogo.php',
  pedidoUrl: '/api/pedido.php',
  timeoutMs: 8000,
} as const;

/**
 * Tabla INMUTABLE de formatos y precios fijos (sin gramos personalizados).
 * - 80g: bolsa Doypack con ventana transparente (1 sabor exacto).
 * - 500g a 3kg: bolsa de papel kraft café (mezcla Dulce/Ácido o solo Salado).
 */
export const BAG_TIERS: readonly BagTierDTO[] = [
  {
    id: '80g',
    label: '80 g',
    grams: 80,
    priceClp: 1000,
    maxFlavors: 1,
    bagStyle: 'doypack',
  },
  {
    id: '500g',
    label: '500 g',
    grams: 500,
    priceClp: 6500,
    maxFlavors: 3,
    bagStyle: 'kraft',
  },
  {
    id: '1kg',
    label: '1 kg',
    grams: 1000,
    priceClp: 12000,
    maxFlavors: 5,
    bagStyle: 'kraft',
  },
  {
    id: '2kg',
    label: '2 kg',
    grams: 2000,
    priceClp: 24000,
    maxFlavors: 10,
    bagStyle: 'kraft',
  },
  {
    id: '3kg',
    label: '3 kg',
    grams: 3000,
    priceClp: 36000,
    maxFlavors: 15,
    bagStyle: 'kraft',
  },
] as const;

/**
 * Reglas operativas generales mostradas en carrito y checkout.
 */
export const BUSINESS_RULES = {
  minStockGramsToShowAvailable: 80,
  lowStockThresholdGrams: 300,
  shippingCarrier: 'Blue Express',
  shippingNote: 'Envío por Blue Express por pagar al recibir o retirar.',
  paymentNote:
    'Al enviar tu pedido por WhatsApp, GoManía te enviará tu link de pago de Mercado Pago. Tu pedido comienza a prepararse una vez confirmado el pago.',
} as const;

/**
 * Historia real de GoManía SpA (4 hitos para la sección Quiénes Somos).
 */
export const STORY_MILESTONES: StoryMilestoneDTO[] = [
  {
    step: 1,
    title: 'Los pasillos de la USM',
    body: 'Todo partió en la Universidad Técnica Federico Santa María, donde nos conocían simplemente como "los maní y las gomitas del C".',
  },
  {
    step: 2,
    title: 'El punto de inflexión',
    body: 'Cuando las normativas internas prohibieron la venta dentro de la universidad, transformamos ese freno en el impulso para profesionalizar nuestro sueño.',
  },
  {
    step: 3,
    title: 'Nace GoManía SpA',
    body: 'Unimos fuerzas fusionando Santamanía (maní) y Gominadoz (gomitas) para fundar formalmente GoManía SpA.',
  },
  {
    step: 4,
    title: 'Del Hall del C a todo Chile',
    body: 'Hoy evolucionamos aquel puesto manteniendo la misma cercanía, más de 100 sabores y despachos por Blue Express a través de gomanía.cl.',
  },
];

/**
 * Configuración consolidada que cumple el contrato `ILandingConfig`.
 */
export const LANDING_CONFIG: ILandingConfig = {
  defaultTheme: DEFAULT_THEME,
  socials: SOCIAL_LINKS,
  story: STORY_MILESTONES,
};

/**
 * Formatea un monto entero a pesos chilenos legibles (ej. 12000 -> "$12.000").
 */
export function formatClp(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}
