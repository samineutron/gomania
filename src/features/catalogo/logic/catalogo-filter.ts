/**
 * ============================================================================
 * QUÉ HACE:
 * Funciones puras (sin DOM ni llamadas de red) con todas las reglas de
 * búsqueda, filtrado jerárquico, compatibilidad de sabores con el mix activo
 * y validación de stock en gramos para el módulo `catalogo`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `MIN_BAG_GRAMS`: mínimo de gramos para considerar un sabor disponible
 *   (por regla de negocio GoManía SpA es `80` g).
 * - `LOW_STOCK_THRESHOLD_GRAMS`: umbral para avisar "Últimos X g" en la card.
 * - `CATEGORY_LABELS` / `TYPE_LABELS`: textos visibles de chips y badges.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa contratos: `ProductDTO`, `ProductType`, `ProductCategory`,
 *   `CatalogFilterDTO` (`src/contracts/catalogo.contract.ts`) y
 *   `MixContextDTO` (`src/contracts/mix-builder.contract.ts`).
 * - Consumido por `src/features/catalogo/index.ts` y `ui/catalogo.client.ts`.
 * ============================================================================
 */
import type {
  CatalogFilterDTO,
  ProductCategory,
  ProductDTO,
  ProductType,
} from '../../../contracts/catalogo.contract';
import type { MixContextDTO } from '../../../contracts/mix-builder.contract';

/** Tramo mínimo de venta en gramos (bolsita individual de 80 g). */
export const MIN_BAG_GRAMS = 80;

/** Umbral visual para destacar que quedan pocos gramos de un sabor. */
export const LOW_STOCK_THRESHOLD_GRAMS = 400;

/** Etiquetas legibles para badges y filtros de tipo de producto. */
export const TYPE_LABELS: Record<ProductType | 'todos', string> = {
  todos: 'Todos',
  gomita: 'Gomitas',
  mani: 'Maní',
};

/** Etiquetas legibles para badges y filtros de categoría de sabor. */
export const CATEGORY_LABELS: Record<ProductCategory | 'todas', string> = {
  todas: 'Todas',
  dulce: 'Dulce',
  acido: 'Ácido',
  salado: 'Salado',
};

/** Estado calculado de disponibilidad de una card respecto al stock y mix activo. */
export type ProductAvailabilityStatus =
  | 'disponible'
  | 'seleccionado'
  | 'agotado'
  | 'incompatible'
  | 'stock-insuficiente'
  | 'cupo-lleno';

/** Resultado completo de evaluación para renderizar cada tarjeta sin lógica en UI. */
export interface ProductCardEvaluation {
  status: ProductAvailabilityStatus;
  canSelect: boolean;
  buttonLabel: string;
  reasonBadge: string | null;
  stockText: string;
  isLowStock: boolean;
}

/**
 * Normaliza un texto para búsquedas insensibles a tildes, diacríticos y mayúsculas.
 * Ejemplo: "Maní Ácido  Merkén" -> "mani acido merken"
 */
export function normalizeSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Devuelve las subcategorías válidas según el tipo principal seleccionado:
 * - `gomita` solo habilita `dulce` y `acido` (no existe gomita salada).
 * - `mani` solo habilita `dulce` y `salado` (no existe maní ácido).
 * - `todos` habilita todas las categorías.
 */
export function getAvailableCategoriesForType(
  tipo: ProductType | 'todos'
): Array<ProductCategory | 'todas'> {
  if (tipo === 'gomita') {
    return ['todas', 'dulce', 'acido'];
  }
  if (tipo === 'mani') {
    return ['todas', 'dulce', 'salado'];
  }
  return ['todas', 'dulce', 'acido', 'salado'];
}

/**
 * Ajusta un filtro si la subcategoría activa deja de ser válida al cambiar de tipo.
 * Ejemplo: si estaba en `Maní > Salado` y cambia a `Gomitas`, resetea a `todas`.
 */
export function sanitizeFilterForType(
  filter: CatalogFilterDTO
): CatalogFilterDTO {
  const allowed = getAvailableCategoriesForType(filter.tipo);
  if (!allowed.includes(filter.categoria)) {
    return {
      ...filter,
      categoria: 'todas',
    };
  }
  return filter;
}

/**
 * Filtra los productos aplicando:
 * 1. Regla de permisos: solo productos con `activo === true`.
 * 2. Filtro de tipo (`gomita` / `mani` / `todos`).
 * 3. Subfiltro dinámico de categoría (`dulce` / `acido` / `salado` / `todas`).
 * 4. Buscador por nombre, tipo o categoría (insensible a tildes y mayúsculas).
 */
export function filterCatalogProducts(
  items: ProductDTO[],
  rawFilter: CatalogFilterDTO
): ProductDTO[] {
  const filter = sanitizeFilterForType(rawFilter);
  const normalizedQuery = normalizeSearchText(filter.query);

  return items.filter((item) => {
    // Regla de permisos: jamás renderizar productos inactivos
    if (!item.activo) return false;

    // Filtro por tipo principal
    if (filter.tipo !== 'todos' && item.tipo !== filter.tipo) {
      return false;
    }

    // Subfiltro por categoría
    if (filter.categoria !== 'todas' && item.categoria !== filter.categoria) {
      return false;
    }

    // Búsqueda textual sin tildes (busca en nombre, tipo y categoría)
    if (normalizedQuery.length > 0) {
      const searchable = normalizeSearchText(
        `${item.nombre} ${TYPE_LABELS[item.tipo]} ${CATEGORY_LABELS[item.categoria]}`
      );
      if (!searchable.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Verifica si un producto es compatible con el perfil del mix activo.
 * Regla de negocio inmutable:
 * - `dulce` y `acido` SÍ se mezclan (gomitas y maní).
 * - `salado` NUNCA se mezcla con `dulce` ni `acido`.
 */
export function isProductCompatibleWithMix(
  product: ProductDTO,
  mixContext: MixContextDTO | null
): boolean {
  if (!mixContext || !mixContext.profile || mixContext.profile === 'libre') {
    return true;
  }

  if (mixContext.profile === 'dulce-acido') {
    return product.categoria === 'dulce' || product.categoria === 'acido';
  }

  if (mixContext.profile === 'salado') {
    return product.categoria === 'salado';
  }

  return true;
}

/**
 * Calcula los gramos mínimos que necesitaría un sabor nuevo al sumarse al mix actual.
 * Si hay un tramo activo con `gramsPerFlavor` definido, valida contra ese valor
 * (o el mínimo de 80 g).
 */
export function getRequiredGramsForMix(
  mixContext: MixContextDTO | null
): number {
  if (!mixContext) return MIN_BAG_GRAMS;

  if (mixContext.gramsPerFlavor > 0) {
    return Math.max(MIN_BAG_GRAMS, mixContext.gramsPerFlavor);
  }

  if (mixContext.tier) {
    // Si aún no hay sabores elegidos, calculamos el reparto estimado al sumar el 1.er sabor
    const nextCount = Math.max(1, mixContext.selectedIds.length + 1);
    const estimated = Math.floor(mixContext.tier.grams / nextCount);
    return Math.max(MIN_BAG_GRAMS, estimated);
  }

  return MIN_BAG_GRAMS;
}

/**
 * Formatea una etiqueta clara y humana para el stock en gramos del sabor.
 */
export function formatStockLabel(stockGramos: number): string {
  if (stockGramos < MIN_BAG_GRAMS) {
    return 'Agotado';
  }
  if (stockGramos < LOW_STOCK_THRESHOLD_GRAMS) {
    return `Últimos ${stockGramos} g`;
  }
  return `${stockGramos.toLocaleString('es-CL')} g disponibles`;
}

/**
 * Evalúa el estado completo de una tarjeta del catálogo combinando:
 * - Stock mínimo global (< 80 g -> Agotado).
 * - Unicidad en el mix activo (si ya fue elegido, máximo 1 vez).
 * - Compatibilidad de perfil (`dulce-acido` vs `salado`).
 * - Stock suficiente para los gramos por sabor que exige el tramo actual.
 * - Cupo máximo de sabores del tramo actual.
 */
export function evaluateProductAvailability(
  product: ProductDTO,
  mixContext: MixContextDTO | null
): ProductCardEvaluation {
  const stockText = formatStockLabel(product.stockGramos);
  const isLowStock =
    product.stockGramos >= MIN_BAG_GRAMS &&
    product.stockGramos < LOW_STOCK_THRESHOLD_GRAMS;

  // 1. Si ya está seleccionado en el mix actual, lo mostramos marcado (máx. 1 vez)
  if (mixContext && mixContext.selectedIds.includes(product.id)) {
    return {
      status: 'seleccionado',
      canSelect: false,
      buttonLabel: 'Ya en tu mix',
      reasonBadge: 'Elegido',
      stockText,
      isLowStock,
    };
  }

  // 2. Sin stock mínimo global (< 80 g)
  if (product.stockGramos < MIN_BAG_GRAMS) {
    return {
      status: 'agotado',
      canSelect: false,
      buttonLabel: 'Agotado',
      reasonBadge: 'Agotado',
      stockText: 'Agotado',
      isLowStock: false,
    };
  }

  // 3. Reglas cuando existe un mix activo emitido por `mix-builder`
  if (mixContext) {
    if (!isProductCompatibleWithMix(product, mixContext)) {
      return {
        status: 'incompatible',
        canSelect: false,
        buttonLabel: 'No mezclable',
        reasonBadge: 'No mezclable con tu mix actual',
        stockText,
        isLowStock,
      };
    }

    const requiredGrams = getRequiredGramsForMix(mixContext);
    if (product.stockGramos < requiredGrams) {
      return {
        status: 'stock-insuficiente',
        canSelect: false,
        buttonLabel: 'Stock insuficiente',
        reasonBadge: `Stock insuficiente para este tramo (${requiredGrams} g)`,
        stockText,
        isLowStock: true,
      };
    }

    if (
      mixContext.tier &&
      mixContext.selectedIds.length >= mixContext.tier.maxFlavors
    ) {
      return {
        status: 'cupo-lleno',
        canSelect: false,
        buttonLabel: 'Cupo completo',
        reasonBadge: `Límite de ${mixContext.tier.maxFlavors} sabor(es) alcanzado`,
        stockText,
        isLowStock,
      };
    }
  }

  // 4. Sabor disponible para seleccionar
  return {
    status: 'disponible',
    canSelect: true,
    buttonLabel: mixContext?.tier ? 'Agregar al mix' : 'Elegir sabor',
    reasonBadge: null,
    stockText,
    isLowStock,
  };
}
