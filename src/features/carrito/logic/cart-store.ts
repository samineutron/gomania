/**
 * ============================================================================
 * QUÉ HACE:
 * Lógica pura del módulo `carrito` (sin acceso al DOM). Implementa
 * `ICarritoService` con todas las reglas de negocio de GoManía SpA:
 * - `upsertItem`: crea bolsas nuevas (agrupando idénticas) o actualiza una bolsa
 *   en edición (`isEdit = true`) sin duplicarla.
 * - `removeItem` y cambio de cantidad (`changeQuantity` / `setQuantity`) con
 *   validación de stock acumulado en gramos contra el catálogo real.
 * - `getUsedGramsByProduct()`: suma los gramos consumidos por cada `productId`
 *   a través de TODAS las bolsas y cantidades del carrito.
 * - `validateCartStock()`: detecta sabores desactivados o cuya demanda total
 *   supera `stockGramos` para resaltar los ítems afectados en el Drawer.
 * - `formatClp()`: formatea precios en pesos chilenos (`$12.000`).
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Mensajes de error de stock en `validateCartStock()` y `changeQuantity()`.
 * - `MAX_QUANTITY_PER_ENTRY`: tope de bolsas idénticas por fila si quieres
 *   ajustarlo (por defecto `20`).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa `ICarritoService`, `CartEntryDTO`, `CartStateDTO`
 *   (`src/contracts/carrito.contract.ts`).
 * - Consume tipos `MixItemDTO`, `MixFlavorDTO`
 *   (`src/contracts/mix-builder.contract.ts`) y `ProductDTO`
 *   (`src/contracts/catalogo.contract.ts`).
 * - Usa `ICartStorage` (`src/features/carrito/data/cart-storage.ts`).
 * ============================================================================
 */
import type {
  CartEntryDTO,
  CartStateDTO,
  ICarritoService,
} from '../../../contracts/carrito.contract';
import type { ProductDTO } from '../../../contracts/catalogo.contract';
import type { MixItemDTO } from '../../../contracts/mix-builder.contract';
import { MemoryCartStorage, type ICartStorage } from '../data/cart-storage';

/** Límite razonable por línea para evitar toques accidentales infinitos. */
const MAX_QUANTITY_PER_ENTRY = 20;

/** Tipos de incidencia detectables al cruzar el carrito contra el stock real. */
export type StockIssueCode = 'inactive_or_missing' | 'insufficient_stock';

/** Detalle de una incidencia de stock para un sabor específico. */
export interface StockIssue {
  code: StockIssueCode;
  productId: string;
  nombre: string;
  requestedGrams: number;
  availableGrams: number;
  message: string;
}

/** Resultado consolidado de validar todo el carrito contra el catálogo actual. */
export interface CartValidationReport {
  isValid: boolean;
  usedGramsByProduct: Record<string, number>;
  globalIssues: StockIssue[];
  issuesByEntryUid: Record<string, StockIssue[]>;
}

/** Resultado al intentar modificar la cantidad de una bolsa en el carrito. */
export interface QuantityChangeResult {
  ok: boolean;
  state: CartStateDTO;
  errorMessage?: string;
}

/**
 * Formatea un monto entero en pesos chilenos (ej. `12000` -> `"$12.000"`).
 * Función pura independiente de configuraciones regionales del navegador.
 */
export function formatClp(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const formatted = String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted}`;
}

/**
 * Genera una copia profunda de `MixItemDTO` para garantizar inmutabilidad
 * y evitar mutaciones accidentales entre `mix-builder`, `carrito` y `checkout`.
 */
function cloneMixItem(item: MixItemDTO): MixItemDTO {
  return {
    uid: item.uid,
    tierId: item.tierId,
    grams: Math.max(0, Math.floor(item.grams)),
    priceClp: Math.max(0, Math.floor(item.priceClp)),
    profile: item.profile,
    flavors: item.flavors.map((flavor) => ({
      productId: flavor.productId,
      nombre: flavor.nombre,
      grams: Math.max(0, Math.floor(flavor.grams)),
      imgCalcomania: flavor.imgCalcomania,
    })),
  };
}

/** Clona un arreglo de entradas `CartEntryDTO`. */
function cloneEntries(entries: readonly CartEntryDTO[]): CartEntryDTO[] {
  return entries.map((entry) => ({
    quantity: entry.quantity,
    item: cloneMixItem(entry.item),
  }));
}

/**
 * Firma determinista de una bolsa según formato, perfil y sabores ordenados.
 * Permite sumar cantidad automáticamente cuando el cliente agrega dos bolsas
 * exactamente iguales (mismo tramo, perfil y sabores).
 */
function buildBagSignature(item: MixItemDTO): string {
  const flavorKey = [...item.flavors]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((f) => `${f.productId}:${Math.floor(f.grams)}`)
    .join('|');
  return `${item.tierId}::${item.profile}::${flavorKey}`;
}

/**
 * Calcula los totales (`totalItems` y `totalClp`) a partir de las entradas.
 */
export function computeCartState(entries: readonly CartEntryDTO[]): CartStateDTO {
  let totalItems = 0;
  let totalClp = 0;

  for (const entry of entries) {
    const qty = Math.max(1, Math.floor(entry.quantity));
    totalItems += qty;
    totalClp += Math.max(0, Math.floor(entry.item.priceClp)) * qty;
  }

  return {
    entries: cloneEntries(entries),
    totalItems,
    totalClp,
  };
}

/**
 * Suma los gramos acumulados de cada `productId` considerando TODAS las bolsas
 * y sus respectivas cantidades (`grams * quantity`).
 */
export function calculateUsedGramsByProduct(
  entries: readonly CartEntryDTO[]
): Record<string, number> {
  const used: Record<string, number> = {};

  for (const entry of entries) {
    const qty = Math.max(1, Math.floor(entry.quantity));
    for (const flavor of entry.item.flavors) {
      const pid = flavor.productId.trim();
      const grams = Math.max(0, Math.floor(flavor.grams)) * qty;
      if (!pid || grams <= 0) continue;
      used[pid] = (used[pid] ?? 0) + grams;
    }
  }

  return used;
}

/**
 * Cruza el consumo acumulado del carrito contra el inventario real (`ProductDTO[]`).
 * Detecta tanto sabores desactivados/eliminados como excesos de gramos acumulados
 * entre múltiples bolsas.
 */
export function validateCartStock(
  entries: readonly CartEntryDTO[],
  catalogProducts: readonly ProductDTO[]
): CartValidationReport {
  const usedGramsByProduct = calculateUsedGramsByProduct(entries);
  const productMap = new Map<string, ProductDTO>();

  for (const product of catalogProducts) {
    productMap.set(product.id, product);
  }

  const issueByProductId = new Map<string, StockIssue>();

  // 1. Evaluar cada sabor único usado en el carrito
  for (const entry of entries) {
    for (const flavor of entry.item.flavors) {
      if (issueByProductId.has(flavor.productId)) continue;

      const requestedGrams = usedGramsByProduct[flavor.productId] ?? 0;
      const catalogItem = productMap.get(flavor.productId);

      if (!catalogItem || !catalogItem.activo) {
        issueByProductId.set(flavor.productId, {
          code: 'inactive_or_missing',
          productId: flavor.productId,
          nombre: flavor.nombre,
          requestedGrams,
          availableGrams: 0,
          message: `"${flavor.nombre}" ya no está disponible en el catálogo. Edita o elimina la bolsa afectada.`,
        });
        continue;
      }

      const availableGrams = Math.max(0, Math.floor(catalogItem.stockGramos));
      if (requestedGrams > availableGrams) {
        issueByProductId.set(flavor.productId, {
          code: 'insufficient_stock',
          productId: flavor.productId,
          nombre: catalogItem.nombre || flavor.nombre,
          requestedGrams,
          availableGrams,
          message: `Stock insuficiente de "${catalogItem.nombre || flavor.nombre}": tus bolsas suman ${requestedGrams}g y quedan ${availableGrams}g disponibles.`,
        });
      }
    }
  }

  // 2. Asociar cada incidencia a las bolsas específicas que usan ese sabor
  const issuesByEntryUid: Record<string, StockIssue[]> = {};
  for (const entry of entries) {
    const entryIssues: StockIssue[] = [];
    const seenForEntry = new Set<string>();

    for (const flavor of entry.item.flavors) {
      const issue = issueByProductId.get(flavor.productId);
      if (issue && !seenForEntry.has(flavor.productId)) {
        seenForEntry.add(flavor.productId);
        entryIssues.push(issue);
      }
    }

    if (entryIssues.length > 0) {
      issuesByEntryUid[entry.item.uid] = entryIssues;
    }
  }

  const globalIssues = Array.from(issueByProductId.values());

  return {
    isValid: globalIssues.length === 0,
    usedGramsByProduct,
    globalIssues,
    issuesByEntryUid,
  };
}

/**
 * Store principal del carrito que implementa `ICarritoService` y persiste
 * automáticamente cada cambio en `ICartStorage` (`gomania_cart_v1`).
 */
export class CartStore implements ICarritoService {
  private readonly storage: ICartStorage;
  private entries: CartEntryDTO[];

  constructor(storage: ICartStorage = new MemoryCartStorage()) {
    this.storage = storage;
    this.entries = this.storage.load();
  }

  /** Vuelve a leer desde `storage` (útil al rehidratar en el cliente). */
  hydrate(): CartStateDTO {
    this.entries = this.storage.load();
    return this.getState();
  }

  /** Devuelve el estado actual inmutable del carrito. */
  getState(): CartStateDTO {
    return computeCartState(this.entries);
  }

  /**
   * Agrega una nueva bolsa o actualiza una bolsa existente en modo edición
   * (`isEdit = true`) sin duplicarla.
   */
  upsertItem(item: MixItemDTO, isEdit: boolean = false): CartStateDTO {
    const cleanItem = cloneMixItem(item);
    if (!cleanItem.uid || cleanItem.flavors.length === 0) {
      return this.getState();
    }

    const indexByUid = this.entries.findIndex((e) => e.item.uid === cleanItem.uid);

    if (isEdit) {
      // Modo edición: reemplaza exactamente la bolsa editada conservando posición y cantidad
      if (indexByUid !== -1) {
        const currentQty = this.entries[indexByUid].quantity;
        this.entries[indexByUid] = {
          item: cleanItem,
          quantity: Math.max(1, currentQty),
        };
      } else {
        this.entries.push({ item: cleanItem, quantity: 1 });
      }
      this.persist();
      return this.getState();
    }

    // Si llega un UID repetido sin bandera isEdit, actualizamos para evitar duplicación
    if (indexByUid !== -1) {
      this.entries[indexByUid] = {
        item: cleanItem,
        quantity: this.entries[indexByUid].quantity,
      };
      this.persist();
      return this.getState();
    }

    // Si ya existe una bolsa con los mismos sabores y formato, sumamos 1 unidad
    const incomingSignature = buildBagSignature(cleanItem);
    const indexBySignature = this.entries.findIndex(
      (e) => buildBagSignature(e.item) === incomingSignature
    );

    if (indexBySignature !== -1) {
      const nextQty = Math.min(
        MAX_QUANTITY_PER_ENTRY,
        this.entries[indexBySignature].quantity + 1
      );
      this.entries[indexBySignature] = {
        ...this.entries[indexBySignature],
        quantity: nextQty,
      };
    } else {
      this.entries.push({ item: cleanItem, quantity: 1 });
    }

    this.persist();
    return this.getState();
  }

  /** Elimina una bolsa por su `uid` y persiste el cambio. */
  removeItem(uid: string): CartStateDTO {
    const nextEntries = this.entries.filter((entry) => entry.item.uid !== uid);
    if (nextEntries.length !== this.entries.length) {
      this.entries = nextEntries;
      this.persist();
    }
    return this.getState();
  }

  /**
   * Ajusta la cantidad de una bolsa en `delta` (`+1` o `-1`).
   * Cuando `delta > 0` y se provee `catalogProducts`, verifica que el consumo
   * acumulado en gramos de cada sabor NO supere el stock disponible real.
   */
  changeQuantity(
    uid: string,
    delta: number,
    catalogProducts?: readonly ProductDTO[]
  ): QuantityChangeResult {
    const index = this.entries.findIndex((entry) => entry.item.uid === uid);
    if (index === -1) {
      return { ok: false, state: this.getState(), errorMessage: 'No se encontró la bolsa.' };
    }

    const currentEntry = this.entries[index];
    const targetQuantity = currentEntry.quantity + Math.trunc(delta);

    if (targetQuantity <= 0) {
      return {
        ok: true,
        state: this.removeItem(uid),
      };
    }

    if (targetQuantity > MAX_QUANTITY_PER_ENTRY) {
      return {
        ok: false,
        state: this.getState(),
        errorMessage: `Máximo ${MAX_QUANTITY_PER_ENTRY} bolsas iguales por línea.`,
      };
    }

    // Validación estricta de stock acumulado al aumentar cantidad
    if (delta > 0 && catalogProducts && catalogProducts.length > 0) {
      const simulatedEntries = cloneEntries(this.entries);
      simulatedEntries[index] = {
        ...simulatedEntries[index],
        quantity: targetQuantity,
      };

      const validation = validateCartStock(simulatedEntries, catalogProducts);
      const entryIssues = validation.issuesByEntryUid[uid];
      if (entryIssues && entryIssues.length > 0) {
        return {
          ok: false,
          state: this.getState(),
          errorMessage: entryIssues[0].message,
        };
      }
    }

    this.entries[index] = {
      ...currentEntry,
      quantity: targetQuantity,
    };
    this.persist();

    return {
      ok: true,
      state: this.getState(),
    };
  }

  /**
   * Retorna el diccionario `{ [productId]: gramosAcumulados }` sumando todas
   * las bolsas y sus cantidades actuales en el carrito.
   */
  getUsedGramsByProduct(): Record<string, number> {
    return calculateUsedGramsByProduct(this.entries);
  }

  /** Valida el estado actual del carrito contra los productos reales del catálogo. */
  validateAgainstCatalog(catalogProducts: readonly ProductDTO[]): CartValidationReport {
    return validateCartStock(this.entries, catalogProducts);
  }

  /** Vacía completamente el carrito (usado al confirmar un pedido en checkout). */
  clear(): void {
    this.entries = [];
    this.storage.clear();
  }

  /** Guarda el arreglo actual en el adaptador de almacenamiento. */
  private persist(): void {
    if (this.entries.length === 0) {
      this.storage.clear();
      return;
    }
    this.storage.save(this.entries);
  }
}
