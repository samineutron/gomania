/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública (Barrel) del módulo `landing-shell`. Exporta sus helpers
 * puros, su configuración tipada (`ILandingConfig`) y documenta las rutas
 * exactas de importación para los componentes `.astro`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Si agregas una nueva utilidad pública del módulo `landing-shell`,
 *   expórtala desde este archivo para mantener el encapsulamiento SOLID.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Reexporta tipos desde `src/contracts/landing-shell.contract.ts`.
 * - Reexporta `LANDING_CONFIG` desde `src/shared/config.ts`.
 * - Los componentes `.astro` se importan directamente en `src/pages/index.astro`:
 *     import Header from '../features/landing-shell/ui/Header.astro';
 *     import Hero from '../features/landing-shell/ui/Hero.astro';
 *     import QuienesSomos from '../features/landing-shell/ui/QuienesSomos.astro';
 *     import Contacto from '../features/landing-shell/ui/Contacto.astro';
 *     import Footer from '../features/landing-shell/ui/Footer.astro';
 * ============================================================================
 */
export type {
  ILandingConfig,
  SocialLinksDTO,
  StoryMilestoneDTO,
  ThemeId,
} from '../../contracts/landing-shell.contract';

export { LANDING_CONFIG } from '../../shared/config';

export {
  NAV_ITEMS,
  DEFAULT_WHATSAPP_GREETING,
  buildWhatsAppContactUrl,
  formatChilePhoneDisplay,
  clampStepIndex,
  getNextStepIndex,
  getPrevStepIndex,
  type NavItem,
} from './logic/landing-helpers';
