/**
 * ============================================================================
 * QUÉ HACE:
 * Adaptador ligero de lectura de productos para `mix-builder` que resuelve un
 * `productId` (recibido vía `EventBus` desde `catalogo:saborSeleccionado` o
 * `carrito:editarItem`) hacia un `ProductDTO` completo (`nombre`, `categoria`,
 * `stockGramos`, `imgCalcomania`, `imgProducto`).
 *
 * Aislamiento SOLID estricto:
 * - Cero importaciones hacia el módulo `catalogo`.
 * - Depende únicamente de los contratos `ProductDTO` (`catalogo.contract.ts`)
 *   e `IInventoryRepository` (`datos.contract.ts`), usando la fachada pública
 *   `inventoryRepository` de `gestion-datos`.
 * - Incluye caché en memoria y deduplicación de llamadas concurrentes para
 *   responder al instante en cada clic del cliente.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - No requiere edición manual; hereda automáticamente la fuente de datos
 *   activa configurada en `src/features/gestion-datos/index.ts`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa `ProductDTO` (`src/contracts/catalogo.contract.ts`).
 * - Usa `IInventoryRepository` (`src/contracts/datos.contract.ts`) y la
 *   fachada `inventoryRepository` (`src/features/gestion-datos/index.ts`).
 * - Consumido por `ui/mix-builder.client.ts`.
 * ============================================================================
 */
import type { ProductDTO } from '../../../contracts/catalogo.contract';
import type { IInventoryRepository } from '../../../contracts/datos.contract';
import type {
  MixFlavorDTO,
  MixProfile,
} from '../../../contracts/mix-builder.contract';
import { inventoryRepository } from '../../gestion-datos/index';

/** Contrato interno mínimo para buscar productos por ID dentro de `mix-builder`. */
export interface IProductLookup {
  preload(): Promise<void>;
  getById(productId: string): Promise<ProductDTO | undefined>;
}

/**
 * Adaptador de consulta de inventario con caché en memoria por sesión.
 */
export class ProductLookupAdapter implements IProductLookup {
  private readonly repository: IInventoryRepository;
  private productMap = new Map<string, ProductDTO>();
  private inFlightLoad: Promise<void> | null = null;
  private hasLoaded = false;

  constructor(repository: IInventoryRepository = inventoryRepository) {
    this.repository = repository;
  }

  /**
   * Precarga el inventario en segundo plano una sola vez (deduplicando llamadas).
   */
  async preload(): Promise<void> {
    if (this.hasLoaded) return;
    if (this.inFlightLoad) {
      await this.inFlightLoad;
      return;
    }

    this.inFlightLoad = (async () => {
      try {
        const products = await this.repository.fetchProducts();
        const nextMap = new Map<string, ProductDTO>();
        for (const item of products) {
          nextMap.set(item.id, item);
        }
        this.productMap = nextMap;
        this.hasLoaded = true;
      } catch {
        // Si falla la red, dejamos el mapa vacío sin romper la interfaz
      } finally {
        this.inFlightLoad = null;
      }
    })();

    await this.inFlightLoad;
  }

  /**
   * Obtiene un `ProductDTO` por su ID. Si aún no se completó la precarga,
   * espera de forma transparente antes de responder.
   */
  async getById(productId: string): Promise<ProductDTO | undefined> {
    if (!this.hasLoaded) {
      await this.preload();
    }

    const cached = this.productMap.get(productId);
    if (cached) return cached;

    // Si no estaba en caché (ej. stock recién actualizado), intentamos 1 recarga fresca
    this.hasLoaded = false;
    await this.preload();
    return this.productMap.get(productId);
  }
}

/**
 * Crea un `ProductDTO` de respaldo únicamente si un ítem enviado desde
 * `carrito:editarItem` contiene un sabor que ya no figura en el inventario actual.
 */
export function createFallbackProductFromMixFlavor(
  flavor: MixFlavorDTO,
  profile: MixProfile
): ProductDTO {
  return {
    id: flavor.productId,
    nombre: flavor.nombre,
    tipo: profile === 'salado' ? 'mani' : 'gomita',
    categoria: profile === 'salado' ? 'salado' : 'dulce',
    stockGramos: Math.max(80, flavor.grams),
    activo: true,
    imgCalcomania: flavor.imgCalcomania,
    imgProducto: flavor.imgCalcomania,
  };
}

/** Instancia lista para usar dentro de `mix-builder`. */
export const productLookup = new ProductLookupAdapter(inventoryRepository);
