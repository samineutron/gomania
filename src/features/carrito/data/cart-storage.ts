/**
 * ============================================================================
 * QUÉ HACE:
 * Adaptador seguro de persistencia en `localStorage` para el módulo `carrito`
 * usando la clave `gomania_cart_v1`. Protege la aplicación contra:
 * - Entornos sin `window`/`localStorage` (compilación SSR de Astro o modo privado).
 * - JSON corrupto, truncado o manipulado manualmente en el navegador.
 * - Estructuras antiguas o incompletas que no respeten `CartEntryDTO`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `CART_STORAGE_KEY`: clave en `localStorage` (si algún día cambias el formato
 *   de datos de las bolsas, sube la versión a `gomania_cart_v2`).
 * - Si mañana decides guardar el carrito en una API/base de datos, crea otro
 *   adaptador que implemente `ICartStorage` sin tocar `logic/cart-store.ts` (LSP).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa contratos: `CartEntryDTO` (`src/contracts/carrito.contract.ts`) y
 *   `BagSizeId`, `MixFlavorDTO`, `MixItemDTO`, `MixProfile`
 *   (`src/contracts/mix-builder.contract.ts`).
 * - Consumido exclusivamente por `src/features/carrito/logic/cart-store.ts` y
 *   `src/features/carrito/index.ts`.
 * ============================================================================
 */
import type { CartEntryDTO } from '../../../contracts/carrito.contract';
import type {
  BagSizeId,
  MixFlavorDTO,
  MixItemDTO,
  MixProfile,
} from '../../../contracts/mix-builder.contract';

/** Clave oficial de persistencia del carrito en `localStorage`. */
export const CART_STORAGE_KEY = 'gomania_cart_v1';

/** Interfaz LSP para desacoplar el almacenamiento del estado puro del carrito. */
export interface ICartStorage {
  load(): CartEntryDTO[];
  save(entries: CartEntryDTO[]): void;
  clear(): void;
}

const VALID_TIER_IDS: ReadonlySet<BagSizeId> = new Set<BagSizeId>([
  '80g',
  '500g',
  '1kg',
  '2kg',
  '3kg',
]);

const VALID_PROFILES: ReadonlySet<MixProfile> = new Set<MixProfile>([
  'dulce-acido',
  'salado',
  'libre',
]);

/** Verifica que un objeto crudo corresponda a un `MixFlavorDTO` válido. */
function sanitizeFlavor(raw: unknown): MixFlavorDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const productId = typeof obj.productId === 'string' ? obj.productId.trim() : '';
  const nombre = typeof obj.nombre === 'string' ? obj.nombre.trim() : '';
  const grams = typeof obj.grams === 'number' && Number.isFinite(obj.grams)
    ? Math.floor(obj.grams)
    : 0;
  const imgCalcomania = typeof obj.imgCalcomania === 'string' && obj.imgCalcomania.trim()
    ? obj.imgCalcomania.trim()
    : '/images/brand/favicon-gm.svg';

  if (!productId || !nombre || grams <= 0) {
    return null;
  }

  return { productId, nombre, grams, imgCalcomania };
}

/** Verifica que un objeto crudo corresponda a un `MixItemDTO` válido. */
function sanitizeMixItem(raw: unknown): MixItemDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const uid = typeof obj.uid === 'string' ? obj.uid.trim() : '';
  const tierId = typeof obj.tierId === 'string' ? (obj.tierId as BagSizeId) : null;
  const profile = typeof obj.profile === 'string' ? (obj.profile as MixProfile) : null;
  const grams = typeof obj.grams === 'number' && Number.isFinite(obj.grams)
    ? Math.floor(obj.grams)
    : 0;
  const priceClp = typeof obj.priceClp === 'number' && Number.isFinite(obj.priceClp)
    ? Math.floor(obj.priceClp)
    : -1;

  if (
    !uid ||
    !tierId ||
    !VALID_TIER_IDS.has(tierId) ||
    !profile ||
    !VALID_PROFILES.has(profile) ||
    grams <= 0 ||
    priceClp < 0 ||
    !Array.isArray(obj.flavors)
  ) {
    return null;
  }

  const flavors: MixFlavorDTO[] = [];
  for (const rawFlavor of obj.flavors) {
    const cleanFlavor = sanitizeFlavor(rawFlavor);
    if (cleanFlavor) {
      flavors.push(cleanFlavor);
    }
  }

  if (flavors.length === 0) {
    return null;
  }

  return {
    uid,
    tierId,
    grams,
    priceClp,
    profile,
    flavors,
  };
}

/** Verifica y limpia una entrada completa `CartEntryDTO` recuperada de storage. */
function sanitizeEntry(raw: unknown): CartEntryDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const item = sanitizeMixItem(obj.item);
  const quantity = typeof obj.quantity === 'number' && Number.isFinite(obj.quantity)
    ? Math.floor(obj.quantity)
    : 0;

  if (!item || quantity < 1) {
    return null;
  }

  return {
    item,
    quantity,
  };
}

/** Comprueba de forma segura si `localStorage` está disponible en el navegador. */
function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Adaptador de `localStorage` (`gomania_cart_v1`) con recuperación ante JSON corrupto.
 */
export class LocalStorageCartAdapter implements ICartStorage {
  private readonly storageKey: string;

  constructor(storageKey: string = CART_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /**
   * Lee y valida las bolsas guardadas en `localStorage`.
   * Si el JSON está corrupto o no es un arreglo válido, limpia la clave
   * dañada para evitar bloqueos futuros y devuelve `[]`.
   */
  load(): CartEntryDTO[] {
    const storage = getSafeLocalStorage();
    if (!storage) return [];

    let rawJson: string | null = null;
    try {
      rawJson = storage.getItem(this.storageKey);
    } catch (error) {
      console.warn('[carrito] No se pudo leer localStorage:', error);
      return [];
    }

    if (!rawJson) return [];

    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        console.warn('[carrito] Formato inesperado en localStorage. Reiniciando carrito.');
        this.clear();
        return [];
      }

      const validEntries: CartEntryDTO[] = [];
      const seenUids = new Set<string>();

      for (const rawEntry of parsed) {
        const cleanEntry = sanitizeEntry(rawEntry);
        if (!cleanEntry) continue;
        if (seenUids.has(cleanEntry.item.uid)) continue;
        seenUids.add(cleanEntry.item.uid);
        validEntries.push(cleanEntry);
      }

      // Si había entradas inválidas mezcladas, reescribimos la versión limpia
      if (validEntries.length !== parsed.length) {
        this.save(validEntries);
      }

      return validEntries;
    } catch (error) {
      console.warn(
        '[carrito] JSON corrupto detectado en gomania_cart_v1. Limpiando respaldo dañado.',
        error
      );
      this.clear();
      return [];
    }
  }

  /** Persiste el arreglo de entradas del carrito en `localStorage`. */
  save(entries: CartEntryDTO[]): void {
    const storage = getSafeLocalStorage();
    if (!storage) return;

    try {
      storage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (error) {
      console.warn('[carrito] No se pudo guardar el carrito en localStorage:', error);
    }
  }

  /** Elimina la clave del carrito en `localStorage`. */
  clear(): void {
    const storage = getSafeLocalStorage();
    if (!storage) return;

    try {
      storage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('[carrito] No se pudo limpiar localStorage:', error);
    }
  }
}

/** Adaptador en memoria útil para entornos sin navegador o pruebas unitarias. */
export class MemoryCartStorage implements ICartStorage {
  private entries: CartEntryDTO[] = [];

  load(): CartEntryDTO[] {
    return this.entries.map((entry) => ({
      quantity: entry.quantity,
      item: {
        ...entry.item,
        flavors: entry.item.flavors.map((flavor) => ({ ...flavor })),
      },
    }));
  }

  save(entries: CartEntryDTO[]): void {
    this.entries = entries.map((entry) => ({
      quantity: entry.quantity,
      item: {
        ...entry.item,
        flavors: entry.item.flavors.map((flavor) => ({ ...flavor })),
      },
    }));
  }

  clear(): void {
    this.entries = [];
  }
}
