/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública (único punto de entrada permitido) del módulo `mix-builder`.
 * Re-exporta las funciones puras de validación y reparto de gramos que otros
 * módulos (como `carrito`) pueden consultar sin acoplarse a archivos internos.
 *
 * Nota sobre componentes `.astro`:
 * Para montar la interfaz en `src/pages/index.astro`, importa directamente:
 * `import MixBuilderSection from '../features/mix-builder/ui/MixBuilderSection.astro';`
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Solo agrega nuevas exportaciones públicas si otro módulo las necesita por
 *   contrato; mantén la lógica interna encapsulada.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Expone utilidades basadas en `src/contracts/mix-builder.contract.ts`.
 * - Se comunica con `catalogo` y `carrito` vía `EventBus` (`src/shared/event-bus.ts`).
 * ============================================================================
 */
export {
  MIN_SELLABLE_STOCK_GRAMS,
  MIX_PROFILE_LABELS,
  areCategoriesMutuallyCompatible,
  buildMixContextDTO,
  buildMixItemDTO,
  calculateEquitableGramsPerFlavor,
  distributeGramsEquitably,
  findMixStockIssues,
  generateMixUid,
  getBagTierById,
  getMinPossibleGramsForTier,
  isCategoryCompatibleWithProfile,
  isDoypackTier,
  reconcileFlavorsForChange,
  requiresProfileSelection,
  validateFlavorAddition,
  validateMixForCart,
} from './logic/mix-rules';

export type {
  FlavorStockIssue,
  FlavorValidationResult,
  MixCartValidationResult,
  MixValidationErrorCode,
} from './logic/mix-rules';
