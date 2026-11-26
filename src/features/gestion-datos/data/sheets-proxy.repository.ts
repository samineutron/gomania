/**
 * ============================================================================
 * QUÉ HACE:
 * Implementación concreta de `IInventoryRepository` e `IOrderRepository`
 * conectada al proxy PHP en HostGator (`/api/catalogo.php` y `/api/pedido.php`),
 * el cual a su vez se comunica de forma segura con Google Sheets / Apps Script.
 *
 * Incluye:
 * - Timeout estricto de 8 segundos vía `AbortController`.
 * - Fallback automático al catálogo demo local (`src/shared/mock-catalogo.ts`)
 *   cuando el proxy PHP aún no está activo (por ejemplo en `npm run dev`).
 * - Arquitectura LSP: el día que migres a MySQL, solo creas otro archivo
 *   en `data/` que implemente las mismas interfaces sin tocar UI ni lógica.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Las URLs y el timeout se leen automáticamente desde `src/shared/config.ts`
 *   (`API_ENDPOINTS`). No necesitas editar rutas aquí.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa `IInventoryRepository` y `IOrderRepository`
 *   (`src/contracts/datos.contract.ts`).
 * - Usa `API_ENDPOINTS` (`src/shared/config.ts`), `mock-catalogo.ts` y
 *   `stock-mapper.ts`.
 * ============================================================================
 */
import type { CartStateDTO } from '../../../contracts/carrito.contract';
import type { ProductDTO } from '../../../contracts/catalogo.contract';
import type { CustomerOrderDTO } from '../../../contracts/checkout.contract';
import type {
  CreateOrderResponseDTO,
  IInventoryRepository,
  IOrderRepository,
} from '../../../contracts/datos.contract';
import { API_ENDPOINTS } from '../../../shared/config';
import * as mockCatalogoModule from '../../../shared/mock-catalogo';
import { buildOrderPayload, mapInventoryRows } from '../logic/stock-mapper';

/** Opciones opcionales para inyectar endpoints distintos en pruebas o migraciones. */
export interface SheetsProxyOptions {
  catalogoUrl?: string;
  pedidoUrl?: string;
  timeoutMs?: number;
}

/**
 * Extrae el arreglo de productos demo desde `src/shared/mock-catalogo.ts`
 * independientemente del nombre de exportación (`MOCK_CATALOGO`, `default`, etc.).
 */
function getLocalMockCatalogo(): ProductDTO[] {
  const mod = mockCatalogoModule as Record<string, unknown>;
  const candidates = [
    mod.MOCK_CATALOGO,
    mod.MOCK_PRODUCTS,
    mod.mockCatalogo,
    mod.default,
    ...Object.values(mod),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return mapInventoryRows(candidate);
    }
  }
  return [];
}

/**
 * Ejecuta `fetch` con timeout controlado usando `AbortController`.
 * Si el servidor supera `timeoutMs` (8s por defecto), aborta la petición.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timerId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timerId);
  }
}

/**
 * Adaptador de repositorio para HostGator PHP Proxy + Google Sheets.
 * Cumple el Principio de Sustitución de Liskov (LSP) respecto a `datos.contract.ts`.
 */
export class SheetsProxyRepository
  implements IInventoryRepository, IOrderRepository
{
  private readonly catalogoUrl: string;
  private readonly pedidoUrl: string;
  private readonly timeoutMs: number;

  constructor(options: SheetsProxyOptions = {}) {
    this.catalogoUrl = options.catalogoUrl ?? API_ENDPOINTS.catalogoUrl;
    this.pedidoUrl = options.pedidoUrl ?? API_ENDPOINTS.pedidoUrl;
    this.timeoutMs = options.timeoutMs ?? API_ENDPOINTS.timeoutMs;
  }

  /**
   * Obtiene el catálogo activo desde `/api/catalogo.php`.
   * Si el proxy PHP no responde, demora más de 8s, devuelve HTML/PHP crudo
   * (caso normal en desarrollo local con Astro) o viene vacío, entrega
   * automáticamente el catálogo demo local normalizado.
   */
  async fetchProducts(): Promise<ProductDTO[]> {
    try {
      const response = await fetchWithTimeout(
        this.catalogoUrl,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        this.timeoutMs
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al consultar ${this.catalogoUrl}`);
      }

      // En `npm run dev` (Astro), un archivo .php en `public/` puede devolverse
      // como texto plano en lugar de ejecutarse. Validamos JSON explícitamente.
      const rawText = await response.text();
      if (rawText.trim().startsWith('<?php') || rawText.trim().startsWith('<')) {
        throw new Error('El proxy PHP no se está ejecutando en este entorno local.');
      }

      const parsed: unknown = JSON.parse(rawText);
      const rawRows = this.extractInventoryArray(parsed);
      const normalized = mapInventoryRows(rawRows);

      if (normalized.length === 0) {
        console.warn(
          '[gestion-datos] El inventario remoto llegó vacío. Usando catálogo demo local.'
        );
        return getLocalMockCatalogo();
      }

      return normalized;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Error de red desconocido';
      console.warn(
        `[gestion-datos] Fallback automático a mock-catalogo.ts (${reason})`
      );
      return getLocalMockCatalogo();
    }
  }

  /**
   * Registra un nuevo pedido enviando los datos al proxy `/api/pedido.php`.
   * Nunca lanza excepciones no controladas: siempre retorna `CreateOrderResponseDTO`
   * para que `checkout-whatsapp` pueda activar el respaldo directo a WhatsApp
   * si el servidor no está disponible.
   */
  async createOrder(
    customer: CustomerOrderDTO,
    cart: CartStateDTO
  ): Promise<CreateOrderResponseDTO> {
    if (!cart.entries || cart.entries.length === 0 || cart.totalClp <= 0) {
      return {
        ok: false,
        folio: '',
        error: 'El carrito está vacío o el total es inválido.',
      };
    }

    const payload = buildOrderPayload(customer, cart);

    try {
      const response = await fetchWithTimeout(
        this.pedidoUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
        this.timeoutMs
      );

      const rawText = await response.text();
      if (rawText.trim().startsWith('<?php') || rawText.trim().startsWith('<')) {
        return {
          ok: false,
          folio: '',
          error: 'El servidor PHP no está activo en desarrollo local.',
        };
      }

      const data = JSON.parse(rawText) as Record<string, unknown>;

      if (!response.ok || data.ok !== true) {
        return {
          ok: false,
          folio: '',
          error:
            typeof data.error === 'string' && data.error.trim()
              ? data.error
              : `No se pudo registrar el pedido (HTTP ${response.status}).`,
        };
      }

      return {
        ok: true,
        folio: typeof data.folio === 'string' ? data.folio : '',
      };
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      return {
        ok: false,
        folio: '',
        error: isAbort
          ? 'Tiempo de espera agotado (8s) al registrar el pedido.'
          : 'No se pudo conectar con el servidor de pedidos.',
      };
    }
  }

  /**
   * Soporta respuestas con formato `{ products: [...] }`, `{ items: [...] }`,
   * `{ data: [...] }` o directamente un arreglo `[...]`.
   */
  private extractInventoryArray(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.products)) return obj.products;
      if (Array.isArray(obj.items)) return obj.items;
      if (Array.isArray(obj.data)) return obj.data;
    }
    return [];
  }
}
