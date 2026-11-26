/**
 * ============================================================================
 * QUÉ HACE:
 * Funciones puras (sin DOM ni llamadas de red) para validar, limpiar y
 * normalizar las filas del inventario provenientes de Google Sheets (o del
 * mock local) hacia el contrato `ProductDTO`. También serializa un pedido
 * (`CustomerOrderDTO` + `CartStateDTO`) al formato JSON que espera el proxy
 * PHP y Google Apps Script.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `DEFAULT_CALCOMANIA_IMG` y `DEFAULT_PRODUCTO_IMG`: rutas locales de
 *   respaldo si algún sabor en el Google Sheet aún no tiene foto cargada.
 * - `formatOrderDetailText()`: formato legible del detalle que se guarda en
 *   la columna `detalle_texto` de la pestaña `Pedidos`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa contratos: `ProductDTO`, `ProductType`, `ProductCategory`
 *   (`src/contracts/catalogo.contract.ts`), `CartStateDTO`
 *   (`src/contracts/carrito.contract.ts`) y `CustomerOrderDTO`
 *   (`src/contracts/checkout.contract.ts`).
 * - Consumido por `sheets-proxy.repository.ts` dentro de `gestion-datos`.
 * ============================================================================
 */
import type {
  ProductCategory,
  ProductDTO,
  ProductType,
} from '../../../contracts/catalogo.contract';
import type { CartStateDTO } from '../../../contracts/carrito.contract';
import type { CustomerOrderDTO } from '../../../contracts/checkout.contract';

/** Imágenes locales de respaldo si en Sheets falta la ruta del producto. */
const DEFAULT_CALCOMANIA_IMG = '/images/brand/favicon-gm.svg';
const DEFAULT_PRODUCTO_IMG = '/images/brand/favicon-gm.svg';

/** Estructura serializada del consumo por sabor para descontar stock exacto. */
export interface SerializedFlavorUsage {
  productId: string;
  nombre: string;
  grams: number;
}

/** Estructura serializada de cada bolsa enviada al proxy PHP / Google Sheets. */
export interface SerializedOrderBag {
  tierId: string;
  grams: number;
  priceClp: number;
  profile: string;
  quantity: number;
  flavors: SerializedFlavorUsage[];
}

/** Payload completo que `sheets-proxy.repository.ts` envía a `/api/pedido.php`. */
export interface SerializedOrderPayload {
  cliente: {
    nombre: string;
    correo: string;
    telefono: string;
    entrega: CustomerOrderDTO['entrega'];
    direccion: string;
    comuna: string;
    region: string;
    notas: string;
    honeypot: string;
  };
  totalClp: number;
  totalItems: number;
  detalleTexto: string;
  items: SerializedOrderBag[];
  consumoGramos: Record<string, number>;
}

/**
 * Quita tildes, espacios sobrantes y convierte a minúsculas para comparar
 * valores escritos manualmente en Google Sheets (ej. "Maní" -> "mani").
 */
function normalizeToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Interpreta la columna `activo` de Sheets (`SI`, `SÍ`, `true`, `1` -> true).
 */
function parseActiveFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const token = normalizeToken(value);
  return token === 'si' || token === 'true' || token === '1' || token === 'activo';
}

/**
 * Valida y normaliza el tipo de producto al dominio estricto `'gomita' | 'mani'`.
 * Retorna `null` si la fila tiene un tipo inválido.
 */
function parseProductType(value: unknown): ProductType | null {
  const token = normalizeToken(value);
  if (token === 'gomita' || token === 'gomitas') return 'gomita';
  if (token === 'mani' || token === 'manies') return 'mani';
  return null;
}

/**
 * Valida y normaliza la categoría al dominio estricto `'dulce' | 'acido' | 'salado'`.
 * Retorna `null` si la fila tiene una categoría desconocida.
 */
function parseProductCategory(value: unknown): ProductCategory | null {
  const token = normalizeToken(value);
  if (token === 'dulce' || token === 'dulces') return 'dulce';
  if (token === 'acido' || token === 'acida' || token === 'acidos' || token === 'acidas') {
    return 'acido';
  }
  if (token === 'salado' || token === 'salada' || token === 'salados' || token === 'saladas') {
    return 'salado';
  }
  return null;
}

/**
 * Convierte el stock de gramos a un entero no negativo (>= 0).
 */
function parseStockGrams(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string') {
    // Limpia posibles separadores de miles o texto como "1.500 g"
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

/**
 * Asegura que una ruta de imagen local sea segura (evita esquemas `javascript:`).
 */
function sanitizeImagePath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  // Si en Sheets escribieron "images/productos/ositos.png", anteponemos "/"
  if (!trimmed.includes(':')) {
    return `/${trimmed}`;
  }
  return fallback;
}

/**
 * Normaliza una fila cruda (snake_case de Sheets o camelCase del mock) a `ProductDTO`.
 * Retorna `null` si la fila es inválida o si `activo` es `false`.
 */
export function normalizeProductRow(raw: unknown): ProductDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;

  const activo = parseActiveFlag(row.activo ?? row.active);
  if (!activo) return null;

  const id = String(row.id ?? '').trim();
  const nombre = String(row.nombre ?? '').trim();
  const tipo = parseProductType(row.tipo);
  const categoria = parseProductCategory(row.categoria);

  if (!id || !nombre || !tipo || !categoria) {
    return null;
  }

  // Regla de dominio: las gomitas no son saladas y el maní no es ácido,
  // pero permitimos cualquier combinación válida de tipo+categoría si llegara
  // a existir un sabor especial en el catálogo futuro.
  const stockGramos = parseStockGrams(row.stockGramos ?? row.stock_gramos);
  const imgCalcomania = sanitizeImagePath(
    row.imgCalcomania ?? row.img_calcomania,
    DEFAULT_CALCOMANIA_IMG
  );
  const imgProducto = sanitizeImagePath(
    row.imgProducto ?? row.img_producto,
    DEFAULT_PRODUCTO_IMG
  );

  return {
    id,
    nombre,
    tipo,
    categoria,
    stockGramos,
    activo: true,
    imgCalcomania,
    imgProducto,
  };
}

/**
 * Mapea un arreglo crudo de filas del inventario:
 * - Filtra filas inactivas (`activo !== true`) o corruptas.
 * - Elimina IDs duplicados conservando el primero válido.
 */
export function mapInventoryRows(rows: unknown): ProductDTO[] {
  if (!Array.isArray(rows)) return [];

  const seenIds = new Set<string>();
  const products: ProductDTO[] = [];

  for (const rawRow of rows) {
    const product = normalizeProductRow(rawRow);
    if (!product) continue;
    if (seenIds.has(product.id)) continue;
    seenIds.add(product.id);
    products.push(product);
  }

  return products;
}

/**
 * Genera el resumen en texto plano de todas las bolsas del pedido
 * para la columna `detalle_texto` de Google Sheets y los correos automáticos.
 */
export function formatOrderDetailText(cart: CartStateDTO): string {
  return cart.entries
    .map((entry, idx) => {
      const { item, quantity } = entry;
      const flavorsLine = item.flavors
        .map((f) => `${f.nombre} (${f.grams}g)`)
        .join(', ');
      const qtyPrefix = quantity > 1 ? `${quantity}x ` : '';
      return `${idx + 1}. ${qtyPrefix}Bolsa ${item.tierId} [${item.profile}]: ${flavorsLine}`;
    })
    .join(' | ');
}

/**
 * Construye el payload JSON estructurado para `/api/pedido.php` y `Code.gs`.
 * Calcula además `consumoGramos` (diccionario `productId -> gramos totales`)
 * para que Google Apps Script descuente stock en 1 paso sin ambigüedad.
 */
export function buildOrderPayload(
  customer: CustomerOrderDTO,
  cart: CartStateDTO
): SerializedOrderPayload {
  const consumoGramos: Record<string, number> = {};

  const items: SerializedOrderBag[] = cart.entries.map(({ item, quantity }) => {
    const safeQty = Math.max(1, Math.floor(quantity));
    const flavors: SerializedFlavorUsage[] = item.flavors.map((flavor) => {
      const safeGrams = Math.max(0, Math.floor(flavor.grams));
      const totalForFlavor = safeGrams * safeQty;
      consumoGramos[flavor.productId] =
        (consumoGramos[flavor.productId] ?? 0) + totalForFlavor;

      return {
        productId: flavor.productId,
        nombre: flavor.nombre,
        grams: safeGrams,
      };
    });

    return {
      tierId: item.tierId,
      grams: item.grams,
      priceClp: item.priceClp,
      profile: item.profile,
      quantity: safeQty,
      flavors,
    };
  });

  const direccionCompleta =
    customer.entrega === 'blue-express'
      ? [customer.direccion, customer.comuna, customer.region]
          .map((part) => (part ?? '').trim())
          .filter(Boolean)
          .join(', ')
      : 'Coordinar retiro';

  return {
    cliente: {
      nombre: customer.nombre.trim(),
      correo: customer.correo.trim().toLowerCase(),
      telefono: (customer.telefono ?? '').trim(),
      entrega: customer.entrega,
      direccion: direccionCompleta,
      comuna: (customer.comuna ?? '').trim(),
      region: (customer.region ?? '').trim(),
      notas: (customer.notas ?? '').trim(),
      honeypot: (customer.honeypot ?? '').trim(),
    },
    totalClp: Math.max(0, Math.floor(cart.totalClp)),
    totalItems: Math.max(0, Math.floor(cart.totalItems)),
    detalleTexto: formatOrderDetailText(cart),
    items,
    consumoGramos,
  };
}
