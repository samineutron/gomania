/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública (único punto de entrada permitido) del módulo `gestion-datos`.
 * Exporta las instancias listas para usar de `IInventoryRepository` y
 * `IOrderRepository`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - MIGRACIÓN FUTURA A MYSQL (Principio LSP):
 *   Cuando decidas cambiar Google Sheets por una base de datos MySQL en
 *   HostGator, solo crea `data/mysql.repository.ts` implementando
 *   `IInventoryRepository` e `IOrderRepository` y cambia la instancia
 *   `activeRepository` en la línea de abajo. Ningún otro módulo del sitio
 *   (`catalogo`, `carrito`, `checkout-whatsapp`) tendrá que modificarse.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Expone contratos de `src/contracts/datos.contract.ts`.
 * - Consumido por `catalogo` (lectura de productos) y `checkout-whatsapp`
 *   (registro de nuevos pedidos).
 * ============================================================================
 */
import type {
  IInventoryRepository,
  IOrderRepository,
} from '../../contracts/datos.contract';
import { SheetsProxyRepository } from './data/sheets-proxy.repository';

// Instancia única activa (Google Sheets vía Proxy PHP en HostGator).
// Para migrar a MySQL mañana, basta reemplazar esta línea por `new MysqlRepository()`.
const activeRepository = new SheetsProxyRepository();

/** Repositorio público de lectura de inventario (cumple `IInventoryRepository`). */
export const inventoryRepository: IInventoryRepository = activeRepository;

/** Repositorio público de creación de pedidos (cumple `IOrderRepository`). */
export const orderRepository: IOrderRepository = activeRepository;

// Exportaciones de soporte para pruebas o extensión avanzada.
export { SheetsProxyRepository } from './data/sheets-proxy.repository';
export {
  buildOrderPayload,
  formatOrderDetailText,
  mapInventoryRows,
  normalizeProductRow,
} from './logic/stock-mapper';
