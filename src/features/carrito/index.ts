/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública (único punto de entrada permitido) del módulo `carrito`.
 * Expone la instancia singleton `carritoService` implementando `ICarritoService`
 * junto con utilidades puras de validación y formateo CLP.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Si algún día cambias el almacenamiento de `localStorage` a un servidor,
 *   reemplaza `new LocalStorageCartAdapter()` por tu nuevo adaptador que
 *   implemente `ICartStorage`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Expone `ICarritoService` (`src/contracts/carrito.contract.ts`).
 * - Consumido por `ui/carrito.client.ts` y por el futuro módulo
 *   `checkout-whatsapp` para leer las bolsas y totales antes de generar el pedido.
 * ============================================================================
 */
import type { ICarritoService } from '../../contracts/carrito.contract';
import { LocalStorageCartAdapter } from './data/cart-storage';
import { CartStore } from './logic/cart-store';

// Instancia única compartida en el navegador respaldada por `gomania_cart_v1`.
const cartStoreInstance = new CartStore(new LocalStorageCartAdapter());

/** Fachada pública tipada estrictamente al contrato `ICarritoService`. */
export const carritoService: ICarritoService = cartStoreInstance;

/**
 * Instancia extendida del store (expone `changeQuantity`, `hydrate` y
 * `validateAgainstCatalog`) para la UI del carrito y módulos autorizados.
 */
export const carritoStore: CartStore = cartStoreInstance;

// Re-exportación controlada de utilidades puras y tipos de soporte.
export {
  CartStore,
  calculateUsedGramsByProduct,
  computeCartState,
  formatClp,
  validateCartStock,
  type CartValidationReport,
  type QuantityChangeResult,
  type StockIssue,
  type StockIssueCode,
} from './logic/cart-store';
export {
  CART_STORAGE_KEY,
  LocalStorageCartAdapter,
  MemoryCartStorage,
  type ICartStorage,
} from './data/cart-storage';
