/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública (único punto de entrada permitido) del módulo `catalogo`.
 * Implementa `ICatalogoService`, carga el inventario únicamente a través de
 * `IInventoryRepository` (`src/features/gestion-datos/index.ts`), mantiene
 * una copia en memoria + caché local de respaldo y expone acceso controlado
 * al listado cargado para otros módulos (ej. `mix-builder` o `carrito`).
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `CATALOG_CACHE_KEY`: clave de `localStorage` usada como respaldo si la
 *   red falla temporalmente.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa `ICatalogoService` (`src/contracts/catalogo.contract.ts`).
 * - Consume `inventoryRepository` (`src/features/gestion-datos/index.ts`)
 *   sin acceder a archivos internos de `gestion-datos`.
 * - Exporta utilidades de consulta para `ui/catalogo.client.ts` y otros
 *   módulos que necesiten leer el catálogo ya cargado.
 * ============================================================================
 */
import type {
  CatalogFilterDTO,
  ICatalogoService,
  ProductDTO,
} from '../../contracts/catalogo.contract';
import type { IInventoryRepository } from '../../contracts/datos.contract';
import { inventoryRepository } from '../gestion-datos/index';
import { filterCatalogProducts } from './logic/catalogo-filter';

/** Clave en localStorage para respaldar el último catálogo válido en caso de error de red. */
const CATALOG_CACHE_KEY = 'gomania_catalogo_cache_v1';

/** Resultado extendido de carga usado internamente por la UI para mostrar estado de error. */
export interface CatalogLoadResult {
  products: ProductDTO[];
  fromCacheFallback: boolean;
  errorMessage: string | null;
}

/**
 * Servicio público del catálogo (cumple `ICatalogoService` y principio DIP
 * recibiendo `IInventoryRepository` por inyección).
 */
export class CatalogoService implements ICatalogoService {
  private readonly repository: IInventoryRepository;
  private loadedProducts: ProductDTO[] = [];

  constructor(repository: IInventoryRepository = inventoryRepository) {
    this.repository = repository;
  }

  /**
   * Carga los productos activos desde el repositorio configurado (`IInventoryRepository`).
   * Si el repositorio falla, intenta recuperar el último caché guardado en el navegador.
   */
  async loadProducts(): Promise<ProductDTO[]> {
    const result = await this.loadProductsWithMeta();
    return result.products;
  }

  /**
   * Carga los productos devolviendo metadatos de estado para que la UI pueda
   * mostrar un aviso discreto con botón "Reintentar" ante errores de red.
   */
  async loadProductsWithMeta(): Promise<CatalogLoadResult> {
    try {
      const fetched = await this.repository.fetchProducts();
      const activeOnly = fetched.filter((item) => item.activo === true);

      if (activeOnly.length === 0) {
        const cached = this.readLocalCache();
        if (cached.length > 0) {
          this.loadedProducts = cached;
          return {
            products: cached,
            fromCacheFallback: true,
            errorMessage:
              'El inventario remoto llegó vacío. Mostrando la última copia guardada.',
          };
        }
      }

      this.loadedProducts = activeOnly;
      this.saveLocalCache(activeOnly);

      return {
        products: activeOnly,
        fromCacheFallback: false,
        errorMessage: null,
      };
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
      const cached = this.readLocalCache();

      if (cached.length > 0) {
        this.loadedProducts = cached;
        return {
          products: cached,
          fromCacheFallback: true,
          errorMessage: `Problema de conexión (${reason}). Mostrando copia guardada.`,
        };
      }

      this.loadedProducts = [];
      return {
        products: [],
        fromCacheFallback: false,
        errorMessage: 'No pudimos cargar los sabores en este momento. Intenta nuevamente.',
      };
    }
  }

  /**
   * Aplica el filtro de búsqueda, tipo y subcategoría sobre un listado dado.
   */
  filterProducts(items: ProductDTO[], filter: CatalogFilterDTO): ProductDTO[] {
    return filterCatalogProducts(items, filter);
  }

  /**
   * Retorna una copia superficial del último listado cargado en memoria.
   */
  getLoadedProducts(): ProductDTO[] {
    return [...this.loadedProducts];
  }

  /**
   * Busca un producto específico por su `id` en el catálogo ya cargado.
   */
  getProductById(productId: string): ProductDTO | undefined {
    return this.loadedProducts.find((item) => item.id === productId);
  }

  /** Guarda el listado válido en localStorage de forma segura (resiste modo incógnito). */
  private saveLocalCache(products: ProductDTO[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(products));
      }
    } catch {
      // Ignoramos silenciosamente si localStorage está bloqueado o sin cuota
    }
  }

  /** Lee el último caché válido desde localStorage validando estructura básica. */
  private readLocalCache(): ProductDTO[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is ProductDTO =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as ProductDTO).id === 'string' &&
          typeof (item as ProductDTO).nombre === 'string' &&
          (item as ProductDTO).activo === true
      );
    } catch {
      return [];
    }
  }
}

/** Instancia pública única del servicio de catálogo (`ICatalogoService`). */
export const catalogoService: CatalogoService = new CatalogoService(
  inventoryRepository
);

/** Acceso rápido al listado cargado en memoria (copia inmutable). */
export function getLoadedCatalogProducts(): ProductDTO[] {
  return catalogoService.getLoadedProducts();
}

/** Acceso rápido a un producto por ID desde el listado ya cargado. */
export function getCatalogProductById(productId: string): ProductDTO | undefined {
  return catalogoService.getProductById(productId);
}

// Re-exportación controlada de utilidades puras que otros módulos pueden necesitar
export {
  CATEGORY_LABELS,
  TYPE_LABELS,
  evaluateProductAvailability,
  filterCatalogProducts,
  getAvailableCategoriesForType,
  isProductCompatibleWithMix,
  normalizeSearchText,
} from './logic/catalogo-filter';
export type {
  ProductAvailabilityStatus,
  ProductCardEvaluation,
} from './logic/catalogo-filter';
