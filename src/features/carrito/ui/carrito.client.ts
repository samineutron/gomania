/**
 * ============================================================================
 * QUÉ HACE:
 * Controlador de interfaz del panel deslizable (`CarritoDrawer.astro`).
 * Conecta la vista del carrito con `carritoStore`, el `EventBus` global y el
 * catálogo real para:
 * - Abrir/cerrar de forma accesible (Escape, overlay, botón cerrar, foco).
 * - Escuchar `mix:agregadoAlCarrito`, `carrito:abrirDrawer` y
 *   `checkout:pedidoCompletado`.
 * - Emitir `carrito:actualizado` (para el badge del Header) y
 *   `carrito:editarItem` (para reabrir una bolsa en `mix-builder`).
 * - Renderizar los 5 estados: ideal, vacío con CTA, carga/rehidratación,
 *   alerta de stock insuficiente y bloqueo del botón "Continuar al pedido".
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Textos de etiquetas de perfil (`PROFILE_LABELS`), mensajes de aviso y
 *   destino de scroll al pulsar "Armar mi primera bolsa" o "Continuar al pedido".
 * - Mini ilustración de bolsa Doypack (`renderDoypackThumb`) y Kraft
 *   (`renderKraftThumb`).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Escucha/emite eventos de `src/contracts/events.contract.ts` vía
 *   `src/shared/event-bus.ts`.
 * - Consume `ICatalogoService` (vía fachada `src/features/catalogo/index.ts`)
 *   con respaldo en `inventoryRepository` (`src/features/gestion-datos/index.ts`).
 * - Usa `carritoStore` y `formatClp` desde `src/features/carrito/index.ts`.
 * ============================================================================
 */
import type { CartEntryDTO, CartStateDTO } from '../../../contracts/carrito.contract';
import type { ICatalogoService, ProductDTO } from '../../../contracts/catalogo.contract';
import type { IEventBus } from '../../../contracts/events.contract';
import type { BagSizeId, MixProfile } from '../../../contracts/mix-builder.contract';
import * as eventBusModule from '../../../shared/event-bus';
import * as catalogoFacade from '../../catalogo';
import { inventoryRepository } from '../../gestion-datos';
import {
  carritoStore,
  formatClp,
  type CartValidationReport,
  type StockIssue,
} from '../index';

/** Etiquetas amigables para cada perfil de bolsa. */
const PROFILE_LABELS: Record<MixProfile, string> = {
  'dulce-acido': 'Dulce / Ácido',
  salado: 'Salado',
  libre: 'Individual 80g',
};

/** Etiquetas legibles para el peso estampado en la mini bolsa Kraft. */
const TIER_STAMP_LABELS: Record<BagSizeId, string> = {
  '80g': '80 g',
  '500g': '500 g',
  '1kg': '1 kg',
  '2kg': '2 kg',
  '3kg': '3 kg',
};

/** Referencias verificadas al DOM interno del Drawer. */
interface CartDomRefs {
  root: HTMLElement;
  overlay: HTMLElement;
  panel: HTMLElement;
  closeBtn: HTMLButtonElement;
  countBadge: HTMLElement;
  liveRegion: HTMLElement;
  stateLoading: HTMLElement;
  stateEmpty: HTMLElement;
  stateContent: HTMLElement;
  emptyCtaBtn: HTMLButtonElement;
  stockBanner: HTMLElement;
  stockBannerList: HTMLElement;
  revalidateBtn: HTMLButtonElement;
  feedbackToast: HTMLElement;
  itemsList: HTMLElement;
  subtotalValue: HTMLElement;
  totalBagsLabel: HTMLElement;
  continueBtn: HTMLButtonElement;
  checkoutBtn: HTMLButtonElement;
  checkoutHint: HTMLElement;
}

/**
 * Resuelve de forma segura la instancia singleton de `IEventBus` exportada por
 * `src/shared/event-bus.ts` (independiente de si es named o default export).
 */
function resolveEventBus(): IEventBus {
  const mod = eventBusModule as Record<string, unknown>;
  const candidates: unknown[] = [
    mod.eventBus,
    mod.appEventBus,
    mod.default,
    ...Object.values(mod),
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as Partial<IEventBus>).emit === 'function' &&
      typeof (candidate as Partial<IEventBus>).on === 'function'
    ) {
      return candidate as IEventBus;
    }
  }

  throw new Error(
    '[carrito] No se encontró una instancia válida de IEventBus en src/shared/event-bus.ts'
  );
}

/** Verifica en tiempo de ejecución si un objeto cumple `ICatalogoService`. */
function isCatalogoService(value: unknown): value is ICatalogoService {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<ICatalogoService>).loadProducts === 'function'
  );
}

/**
 * Carga los productos vigentes del catálogo a través de la fachada pública de
 * `catalogo` (`ICatalogoService`) con respaldo en `inventoryRepository`.
 */
async function loadCatalogProducts(): Promise<ProductDTO[]> {
  const mod = catalogoFacade as Record<string, unknown>;
  for (const exported of Object.values(mod)) {
    if (isCatalogoService(exported)) {
      return await exported.loadProducts();
    }
  }
  return await inventoryRepository.fetchProducts();
}

/** Escapa caracteres HTML para renderizado seguro contra XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sanitiza rutas de imagen para evitar URLs inválidas en atributos `src`. */
function safeImgSrc(src: string): string {
  const trimmed = src.trim();
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return escapeHtml(trimmed);
  }
  return '/images/brand/favicon-gm.svg';
}

/**
 * Renderiza la mini vista visual de bolsita Doypack (`80g`):
 * fondo rosado a rayas, calcomanía en esquina superior izquierda y ventana
 * central transparente mostrando el sabor elegido.
 */
function renderDoypackThumb(entry: CartEntryDTO): string {
  const mainFlavor = entry.item.flavors[0];
  const stickerSrc = mainFlavor
    ? safeImgSrc(mainFlavor.imgCalcomania)
    : '/images/brand/favicon-gm.svg';
  const altName = mainFlavor ? escapeHtml(mainFlavor.nombre) : 'Bolsita 80g';

  return `
    <div class="gm-cart-thumb gm-cart-thumb--doypack" aria-hidden="true">
      <span class="gm-cart-doypack-zip"></span>
      <span class="gm-cart-doypack-sticker">
        <img
          src="${stickerSrc}"
          alt="${altName}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='/images/brand/favicon-gm.svg';"
        />
      </span>
      <span class="gm-cart-doypack-window">
        <img
          src="${stickerSrc}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='/images/brand/favicon-gm.svg';"
        />
      </span>
      <span class="gm-cart-doypack-weight">80g</span>
    </div>
  `;
}

/**
 * Renderiza la mini vista visual de bolsa Papel Kraft (`500g` a `3kg`):
 * ilustración SVG limpia color `--kraft-bag` con sello del peso y sin ventana.
 */
function renderKraftThumb(tierId: BagSizeId): string {
  const stamp = escapeHtml(TIER_STAMP_LABELS[tierId] ?? tierId);

  return `
    <div class="gm-cart-thumb gm-cart-thumb--kraft" aria-hidden="true">
      <svg viewBox="0 0 60 76" width="56" height="72" focusable="false">
        <path
          d="M11 10 L49 10 L54 68 C54 71 51.5 73 48.5 73 L11.5 73 C8.5 73 6 71 6 68 Z"
          fill="var(--kraft-bag, #C89D70)"
          stroke="rgba(17, 24, 39, 0.16)"
          stroke-width="1.5"
        />
        <path
          d="M11 10 L15 4 L45 4 L49 10 Z"
          fill="color-mix(in srgb, var(--kraft-bag, #C89D70) 82%, #5C3D22)"
        />
        <line
          x1="10"
          y1="17"
          x2="50"
          y2="17"
          stroke="rgba(255, 255, 255, 0.35)"
          stroke-width="1.5"
          stroke-dasharray="3 2"
        />
        <rect
          x="12"
          y="31"
          width="36"
          height="22"
          rx="6"
          fill="rgba(255, 255, 255, 0.9)"
        />
        <text
          x="30"
          y="46"
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="#111827"
          font-family="Fredoka, system-ui, sans-serif"
        >${stamp}</text>
      </svg>
    </div>
  `;
}

/** Construye el HTML de una tarjeta de ítem dentro de la lista del carrito. */
function renderCartItemCard(
  entry: CartEntryDTO,
  issues: readonly StockIssue[]
): string {
  const { item, quantity } = entry;
  const hasIssue = issues.length > 0;
  const isDoypack = item.tierId === '80g';
  const title = isDoypack
    ? `Bolsita ${TIER_STAMP_LABELS[item.tierId]}`
    : `Mix ${TIER_STAMP_LABELS[item.tierId]}`;
  const profileLabel = PROFILE_LABELS[item.profile] ?? item.profile;
  const lineTotal = formatClp(item.priceClp * quantity);
  const unitPrice = formatClp(item.priceClp);
  const safeUid = escapeHtml(item.uid);

  const flavorsHtml = item.flavors
    .map((flavor) => {
      const hasFlavorIssue = issues.some((iss) => iss.productId === flavor.productId);
      return `
        <li class="gm-cart-flavor-row ${hasFlavorIssue ? 'is-flavor-issue' : ''}">
          <span class="gm-cart-flavor-name">
            <img
              class="gm-cart-flavor-dot"
              src="${safeImgSrc(flavor.imgCalcomania)}"
              alt=""
              width="20"
              height="20"
              loading="lazy"
              decoding="async"
              onerror="this.onerror=null;this.src='/images/brand/favicon-gm.svg';"
            />
            <span>${escapeHtml(flavor.nombre)}</span>
          </span>
          <span class="gm-cart-flavor-grams">${flavor.grams}g</span>
        </li>
      `;
    })
    .join('');

  const issuesHtml = hasIssue
    ? `
      <div class="gm-cart-item-alert" role="alert">
        ${issues.map((iss) => `<p>${escapeHtml(iss.message)}</p>`).join('')}
      </div>
    `
    : '';

  const thumbHtml = isDoypack
    ? renderDoypackThumb(entry)
    : renderKraftThumb(item.tierId);

  return `
    <article
      class="gm-cart-item ${hasIssue ? 'is-error' : ''}"
      data-item-uid="${safeUid}"
    >
      <div class="gm-cart-item-top">
        ${thumbHtml}
        <div class="gm-cart-item-meta">
          <div class="gm-cart-item-head">
            <div>
              <h3 class="gm-cart-item-title">${escapeHtml(title)}</h3>
              <span class="gm-cart-profile-badge gm-cart-profile-badge--${escapeHtml(item.profile)}">
                ${escapeHtml(profileLabel)}
              </span>
            </div>
            <div class="gm-cart-item-price">
              <strong>${lineTotal}</strong>
              ${quantity > 1 ? `<small>${quantity} × ${unitPrice}</small>` : ''}
            </div>
          </div>

          <ul class="gm-cart-flavor-list" aria-label="Sabores incluidos">
            ${flavorsHtml}
          </ul>
        </div>
      </div>

      ${issuesHtml}

      <div class="gm-cart-item-actions">
        <div class="gm-cart-qty" role="group" aria-label="Cantidad de bolsas">
          <button
            type="button"
            class="gm-cart-qty-btn"
            data-action="qty-dec"
            data-uid="${safeUid}"
            aria-label="Restar una bolsa de ${escapeHtml(title)}"
            ${quantity <= 1 ? 'disabled' : ''}
          >−</button>
          <span class="gm-cart-qty-value" aria-live="polite">${quantity}</span>
          <button
            type="button"
            class="gm-cart-qty-btn"
            data-action="qty-inc"
            data-uid="${safeUid}"
            aria-label="Sumar una bolsa de ${escapeHtml(title)}"
          >+</button>
        </div>

        <div class="gm-cart-item-btns">
          <button
            type="button"
            class="gm-cart-btn-edit"
            data-action="edit"
            data-uid="${safeUid}"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <span>Editar</span>
          </button>

          <button
            type="button"
            class="gm-cart-btn-remove"
            data-action="remove"
            data-uid="${safeUid}"
            aria-label="Eliminar ${escapeHtml(title)} del carrito"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

/** Recolecta y verifica todas las referencias DOM requeridas por el Drawer. */
function queryCartDom(): CartDomRefs | null {
  const root = document.getElementById('gm-carrito-drawer');
  if (!root) return null;

  const overlay = root.querySelector<HTMLElement>('[data-cart-overlay]');
  const panel = root.querySelector<HTMLElement>('[data-cart-panel]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-cart-close]');
  const countBadge = root.querySelector<HTMLElement>('[data-cart-count]');
  const liveRegion = root.querySelector<HTMLElement>('[data-cart-live]');
  const stateLoading = root.querySelector<HTMLElement>('[data-cart-state="loading"]');
  const stateEmpty = root.querySelector<HTMLElement>('[data-cart-state="empty"]');
  const stateContent = root.querySelector<HTMLElement>('[data-cart-state="content"]');
  const emptyCtaBtn = root.querySelector<HTMLButtonElement>('[data-cart-empty-cta]');
  const stockBanner = root.querySelector<HTMLElement>('[data-cart-stock-banner]');
  const stockBannerList = root.querySelector<HTMLElement>('[data-cart-stock-list]');
  const revalidateBtn = root.querySelector<HTMLButtonElement>('[data-cart-revalidate]');
  const feedbackToast = root.querySelector<HTMLElement>('[data-cart-feedback]');
  const itemsList = root.querySelector<HTMLElement>('[data-cart-items]');
  const subtotalValue = root.querySelector<HTMLElement>('[data-cart-subtotal]');
  const totalBagsLabel = root.querySelector<HTMLElement>('[data-cart-bags-label]');
  const continueBtn = root.querySelector<HTMLButtonElement>('[data-cart-continue]');
  const checkoutBtn = root.querySelector<HTMLButtonElement>('[data-cart-checkout]');
  const checkoutHint = root.querySelector<HTMLElement>('[data-cart-checkout-hint]');

  if (
    !overlay ||
    !panel ||
    !closeBtn ||
    !countBadge ||
    !liveRegion ||
    !stateLoading ||
    !stateEmpty ||
    !stateContent ||
    !emptyCtaBtn ||
    !stockBanner ||
    !stockBannerList ||
    !revalidateBtn ||
    !feedbackToast ||
    !itemsList ||
    !subtotalValue ||
    !totalBagsLabel ||
    !continueBtn ||
    !checkoutBtn ||
    !checkoutHint
  ) {
    return null;
  }

  return {
    root,
    overlay,
    panel,
    closeBtn,
    countBadge,
    liveRegion,
    stateLoading,
    stateEmpty,
    stateContent,
    emptyCtaBtn,
    stockBanner,
    stockBannerList,
    revalidateBtn,
    feedbackToast,
    itemsList,
    subtotalValue,
    totalBagsLabel,
    continueBtn,
    checkoutBtn,
    checkoutHint,
  };
}

/**
 * Inicializa el módulo interactivo del Drawer del carrito.
 * Protegido contra doble inicialización si el componente se re-evalúa.
 */
export function initCarritoDrawer(): void {
  const maybeDom = queryCartDom();
  if (!maybeDom) return;
  mountCarritoDrawer(maybeDom);
}

/**
 * Monta la interactividad del Drawer recibiendo `dom` ya tipado como
 * `CartDomRefs` no-nulo (evita errores TS18047 dentro de funciones anidadas).
 */
function mountCarritoDrawer(dom: CartDomRefs): void {
  if (dom.root.dataset.initialized === 'true') {
    return;
  }
  dom.root.dataset.initialized = 'true';

  const eventBus = resolveEventBus();

  // Estado reactivo interno de la UI del Drawer
  let isOpen = false;
  let isLoadingCatalog = false;
  let catalogLoadFailed = false;
  let catalogProducts: ProductDTO[] = [];
  let lastFocusedElement: HTMLElement | null = null;
  let toastTimer: number | null = null;
  let validationReport: CartValidationReport = {
    isValid: true,
    usedGramsByProduct: {},
    globalIssues: [],
    issuesByEntryUid: {},
  };

  /** Anuncia cambios relevantes para lectores de pantalla. */
  function announce(message: string): void {
    dom.liveRegion.textContent = message;
  }

  /** Muestra un aviso temporal dentro del Drawer (ej. límite de stock al pulsar +). */
  function showFeedback(message: string, variant: 'info' | 'warn' | 'success' = 'info'): void {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    dom.feedbackToast.textContent = message;
    dom.feedbackToast.dataset.variant = variant;
    dom.feedbackToast.hidden = false;

    toastTimer = window.setTimeout(() => {
      dom.feedbackToast.hidden = true;
      toastTimer = null;
    }, 4200);
  }

  /** Emite `carrito:actualizado` para mantener sincronizado el badge del Header. */
  function emitCartUpdated(state: CartStateDTO): void {
    eventBus.emit('carrito:actualizado', {
      totalItems: state.totalItems,
      totalClp: state.totalClp,
    });
  }

  /** Revalida el carrito contra el catálogo ya cargado en memoria. */
  function recomputeValidation(): void {
    if (catalogProducts.length > 0) {
      validationReport = carritoStore.validateAgainstCatalog(catalogProducts);
    } else {
      validationReport = {
        isValid: !catalogLoadFailed,
        usedGramsByProduct: carritoStore.getUsedGramsByProduct(),
        globalIssues: [],
        issuesByEntryUid: {},
      };
    }
  }

  /**
   * Consulta el catálogo vigente (estado Carga/Rehidratación) y valida stock
   * antes de habilitar el paso al checkout.
   */
  async function syncCatalogAndValidate(forceRefresh: boolean = false): Promise<void> {
    if (isLoadingCatalog) return;
    if (!forceRefresh && catalogProducts.length > 0) {
      recomputeValidation();
      render();
      return;
    }

    isLoadingCatalog = true;
    catalogLoadFailed = false;
    render();

    try {
      catalogProducts = await loadCatalogProducts();
      catalogLoadFailed = false;
      recomputeValidation();
    } catch (error) {
      console.warn('[carrito] Error verificando stock contra el catálogo:', error);
      catalogLoadFailed = true;
      recomputeValidation();
    } finally {
      isLoadingCatalog = false;
      render();
    }
  }

  /** Abre o cierra el panel deslizable gestionando accesibilidad y scroll del body. */
  function setDrawerOpen(nextOpen: boolean): void {
    if (isOpen === nextOpen) return;
    isOpen = nextOpen;

    dom.root.classList.toggle('is-open', isOpen);
    dom.root.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.classList.toggle('gm-cart-scroll-lock', isOpen);

    if (isOpen) {
      lastFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // Al abrir con bolsas guardadas, aseguramos stock verificado
      const currentState = carritoStore.getState();
      if (currentState.totalItems > 0 && catalogProducts.length === 0) {
        void syncCatalogAndValidate(false);
      } else {
        recomputeValidation();
        render();
      }
      window.requestAnimationFrame(() => {
        dom.closeBtn.focus();
      });
    } else if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  /** Renderiza la UI completa respetando la matriz de los 5 estados. */
  function render(): void {
    const state = carritoStore.getState();
    const hasItems = state.entries.length > 0;

    // Cabecera y totales
    dom.countBadge.textContent = String(state.totalItems);
    dom.subtotalValue.textContent = formatClp(state.totalClp);
    dom.totalBagsLabel.textContent =
      state.totalItems === 1 ? '1 bolsa' : `${state.totalItems} bolsas`;

    // Estado 3: Carga / Rehidratación (cuando hay ítems guardados y validamos stock)
    if (isLoadingCatalog && hasItems) {
      dom.stateLoading.hidden = false;
      dom.stateEmpty.hidden = true;
      dom.stateContent.hidden = true;
      dom.checkoutBtn.disabled = true;
      dom.checkoutBtn.setAttribute('aria-disabled', 'true');
      dom.checkoutHint.textContent = 'Verificando disponibilidad de gramos...';
      dom.checkoutHint.hidden = false;
      return;
    }

    dom.stateLoading.hidden = true;

    // Estado 2: Vacío (con ilustración dulce y CTA)
    if (!hasItems) {
      dom.stateEmpty.hidden = false;
      dom.stateContent.hidden = true;
      dom.stockBanner.hidden = true;
      dom.itemsList.innerHTML = '';

      // Estado 5 (Permisos): Bloqueo si el carrito está vacío
      dom.checkoutBtn.disabled = true;
      dom.checkoutBtn.setAttribute('aria-disabled', 'true');
      dom.checkoutHint.textContent = 'Agrega al menos una bolsa para finalizar tu compra.';
      dom.checkoutHint.hidden = false;
      return;
    }

    // Estado 1 (Ideal) o Estado 4 (Error / Alerta de stock)
    dom.stateEmpty.hidden = true;
    dom.stateContent.hidden = false;

    const hasStockIssues = validationReport.globalIssues.length > 0;
    const hasBlockingError = hasStockIssues || catalogLoadFailed;

    if (catalogLoadFailed) {
      dom.stockBanner.hidden = false;
      dom.stockBannerList.innerHTML =
        '<li>No pudimos verificar el stock actual. Pulsa "Revalidar stock" para continuar.</li>';
    } else if (hasStockIssues) {
      dom.stockBanner.hidden = false;
      dom.stockBannerList.innerHTML = validationReport.globalIssues
        .map((issue) => `<li>${escapeHtml(issue.message)}</li>`)
        .join('');
    } else {
      dom.stockBanner.hidden = true;
      dom.stockBannerList.innerHTML = '';
    }

    // Lista de bolsas
    dom.itemsList.innerHTML = state.entries
      .map((entry) =>
        renderCartItemCard(
          entry,
          validationReport.issuesByEntryUid[entry.item.uid] ?? []
        )
      )
      .join('');

    // Estado 5 (Permisos): Bloquear checkout si hay errores de stock o red
    if (hasBlockingError) {
      dom.checkoutBtn.disabled = true;
      dom.checkoutBtn.setAttribute('aria-disabled', 'true');
      dom.checkoutHint.textContent =
        'Ajusta o edita las bolsas marcadas antes de finalizar tu compra.';
      dom.checkoutHint.hidden = false;
    } else {
      dom.checkoutBtn.disabled = false;
      dom.checkoutBtn.setAttribute('aria-disabled', 'false');
      dom.checkoutHint.textContent = '';
      dom.checkoutHint.hidden = true;
    }
  }

  /** Navega suavemente a una sección del documento cerrando antes el Drawer. */
  function scrollToSection(sectionIds: readonly string[]): void {
    for (const id of sectionIds) {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  // ==========================================================================
  // EVENTOS DE INTERFAZ (CLIC, TECLADO, DELEGACIÓN DE BOTONES)
  // ==========================================================================

  dom.closeBtn.addEventListener('click', () => {
    setDrawerOpen(false);
  });

  dom.overlay.addEventListener('click', () => {
    setDrawerOpen(false);
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setDrawerOpen(false);
    }
  });

  // CTA del estado vacío: lleva directo al armador de bolsas
  dom.emptyCtaBtn.addEventListener('click', () => {
    setDrawerOpen(false);
    scrollToSection(['armador-mix', 'catalogo']);
  });

  // Botón revalidar stock dentro del banner de error
  dom.revalidateBtn.addEventListener('click', () => {
    void syncCatalogAndValidate(true);
  });

  // Delegación de clics para Editar, +/- Cantidad y Eliminar en cada bolsa
  dom.itemsList.addEventListener('click', (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>('button[data-action][data-uid]');
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const uid = button.dataset.uid;
    if (!action || !uid) return;

    const currentState = carritoStore.getState();
    const targetEntry = currentState.entries.find((e) => e.item.uid === uid);

    if (action === 'edit' && targetEntry) {
      // Cierra el carrito y envía la bolsa a mix-builder para editar sin duplicar
      setDrawerOpen(false);
      eventBus.emit('carrito:editarItem', { item: targetEntry.item });
      announce(`Editando bolsa ${targetEntry.item.tierId}.`);
      return;
    }

    if (action === 'remove') {
      const nextState = carritoStore.removeItem(uid);
      recomputeValidation();
      render();
      emitCartUpdated(nextState);
      showFeedback('Bolsa eliminada del carrito.', 'info');
      announce('Bolsa eliminada del carrito.');
      return;
    }

    if (action === 'qty-inc' || action === 'qty-dec') {
      const delta = action === 'qty-inc' ? 1 : -1;
      const result = carritoStore.changeQuantity(uid, delta, catalogProducts);

      if (!result.ok) {
        showFeedback(
          result.errorMessage ?? 'No hay suficiente stock para sumar otra bolsa.',
          'warn'
        );
        announce(result.errorMessage ?? 'Stock insuficiente.');
        return;
      }

      recomputeValidation();
      render();
      emitCartUpdated(result.state);
      announce(
        delta > 0
          ? 'Se sumó una bolsa al carrito.'
          : 'Se restó una bolsa del carrito.'
      );
    }
  });

  // Botón secundario "Seguir armando": cierra el carrito y lleva al armador
  dom.continueBtn.addEventListener('click', () => {
    setDrawerOpen(false);
    scrollToSection(['armador-mix', 'catalogo']);
  });

  // Botón principal "Finalizar compra": abre el modal flotante de WhatsApp
  dom.checkoutBtn.addEventListener('click', () => {
    const state = carritoStore.getState();
    if (state.totalItems === 0 || isLoadingCatalog || catalogLoadFailed || !validationReport.isValid) {
      return;
    }

    setDrawerOpen(false);
    // Notificación DOM desacoplada para que `checkout-whatsapp` abra su modal
    window.dispatchEvent(
      new CustomEvent('gomania:irACheckout', {
        detail: state,
      })
    );
  });

  // ==========================================================================
  // SUSCRIPCIONES AL EVENTBUS GLOBAL (OCP / DIP)
  // ==========================================================================

  // 1. Cuando `mix-builder` agrega o guarda la edición de una bolsa
  eventBus.on('mix:agregadoAlCarrito', ({ item, isEdit }) => {
    const nextState = carritoStore.upsertItem(item, isEdit);
    recomputeValidation();
    render();
    emitCartUpdated(nextState);

    showFeedback(
      isEdit ? '¡Bolsa actualizada correctamente!' : '¡Bolsa agregada a tu carrito!',
      'success'
    );
    announce(isEdit ? 'Bolsa actualizada en el carrito.' : 'Bolsa agregada al carrito.');
    setDrawerOpen(true);

    // Si todavía no habíamos consultado el catálogo real, validamos ahora
    if (catalogProducts.length === 0) {
      void syncCatalogAndValidate(false);
    }
  });

  // 2. Cuando el Header o cualquier módulo solicita abrir/cerrar el Drawer
  eventBus.on('carrito:abrirDrawer', ({ open }) => {
    setDrawerOpen(Boolean(open));
  });

  // 3. Cuando `checkout-whatsapp` confirma el pedido, vaciamos el carrito
  eventBus.on('checkout:pedidoCompletado', () => {
    carritoStore.clear();
    recomputeValidation();
    render();
    emitCartUpdated(carritoStore.getState());
    setDrawerOpen(false);
    announce('Pedido completado. Tu carrito fue vaciado.');
  });

  // ==========================================================================
  // REHIDRATACIÓN INICIAL DESDE `localStorage` (`gomania_cart_v1`)
  // ==========================================================================
  const initialState = carritoStore.hydrate();
  render();
  emitCartUpdated(initialState);

  // Re-emite en el siguiente frame para garantizar sincronía con Header.astro
  // sin importar el orden en que carguen los scripts de Astro.
  window.requestAnimationFrame(() => {
    emitCartUpdated(carritoStore.getState());
  });

  // Si había ítems guardados tras recargar, verificamos vigencia contra el catálogo
  if (initialState.totalItems > 0) {
    void syncCatalogAndValidate(false);
  }
}
