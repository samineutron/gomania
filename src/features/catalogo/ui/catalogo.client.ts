/**
 * ============================================================================
 * QUÉ HACE:
 * Controlador de cliente (TypeScript nativo, cero frameworks) para la sección
 * `<CatalogoSection />`. Gestiona:
 * - Carga asíncrona del inventario vía `catalogoService` (con 8 skeletons).
 * - Buscador instantáneo sin tildes y chips de filtros jerárquicos
 *   (`Gomitas` -> Dulce/Ácido; `Maní` -> Dulce/Salado).
 * - Renderizado responsive de cards con `imgCalcomania` (`loading="lazy"`) y
 *   fallback automático SVG si falta el archivo local.
 * - Los 5 estados completos: Ideal, Vacío ("Limpiar filtros"), Carga (skeleton),
 *   Error ("Reintentar") y Permisos/Reglas ("Agotado" si stock < 80 g).
 * - Comunicación vía `EventBus`: emite `catalogo:saborSeleccionado` y escucha
 *   `mix:contextoActualizado`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `FALLBACK_STICKER_SVG`: imagen SVG embebida que aparece si todavía no
 *   subes el PNG de la calcomanía de un sabor en `public/images/productos/`.
 * - `SKELETON_COUNT`: cantidad de tarjetas skeleton mientras carga (default 8).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa `catalogoService` y funciones puras desde `../index` y
 *   `../logic/catalogo-filter`.
 * - Comunica con `mix-builder` mediante `src/shared/event-bus.ts`
 *   (`catalogo:saborSeleccionado` y `mix:contextoActualizado`).
 * ============================================================================
 */
import type {
  CatalogFilterDTO,
  ProductDTO,
  ProductType,
} from '../../../contracts/catalogo.contract';
import type { MixContextDTO } from '../../../contracts/mix-builder.contract';
import { eventBus } from '../../../shared/event-bus';
import { catalogoService } from '../index';
import {
  CATEGORY_LABELS,
  TYPE_LABELS,
  evaluateProductAvailability,
  getAvailableCategoriesForType,
  isProductCompatibleWithMix,
  sanitizeFilterForType,
} from '../logic/catalogo-filter';

/** Cantidad de tarjetas skeleton mostradas durante el estado de carga. */
const SKELETON_COUNT = 8;

/**
 * Imagen SVG liviana de respaldo si falta el archivo local de `imgCalcomania`.
 * Evita iconos rotos del navegador y mantiene la identidad visual de GoManía.
 */
const FALLBACK_STICKER_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">' +
      '<circle cx="80" cy="76" r="46" fill="#FFFFFF" fill-opacity="0.88"/>' +
      '<circle cx="80" cy="76" r="36" fill="#F44870" opacity="0.14"/>' +
      '<circle cx="80" cy="76" r="24" fill="#28AAE1" opacity="0.18"/>' +
      '<text x="80" y="84" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="22" fill="#F44870">G&amp;M</text>' +
      '<text x="80" y="138" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="11" fill="#4B5563">Foto en camino</text>' +
    '</svg>'
  );

/** Estado interno encapsulado de la vista del catálogo. */
interface CatalogoUIState {
  allProducts: ProductDTO[];
  filter: CatalogFilterDTO;
  mixContext: MixContextDTO | null;
  hideIncompatible: boolean;
  isLoading: boolean;
  errorMessage: string | null;
}

/**
 * Construye un ícono SVG inline seguro para los botones de cada card.
 */
function createActionIconSvg(
  status: ReturnType<typeof evaluateProductAvailability>['status']
): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.25');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  if (status === 'disponible') {
    // Signo "+"
    path.setAttribute('d', 'M12 5v14M5 12h14');
  } else if (status === 'seleccionado') {
    // Check "✓"
    path.setAttribute('d', 'M20 6L9 17l-5-5');
  } else {
    // Bloqueo / no disponible
    path.setAttribute('d', 'M18.364 5.636l-12.728 12.728M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z');
  }
  svg.appendChild(path);
  return svg;
}

/**
 * Inicializa todos los listeners y renderizados dentro de `#catalogo-module`.
 */
export function initCatalogoSection(): void {
  const root = document.getElementById('catalogo-module');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  // Referencias al DOM interno del módulo
  const searchInput = root.querySelector<HTMLInputElement>('[data-cat-search]');
  const clearSearchBtn = root.querySelector<HTMLButtonElement>('[data-cat-clear-search]');
  const typeChipsContainer = root.querySelector<HTMLElement>('[data-cat-type-chips]');
  const categoryChipsContainer = root.querySelector<HTMLElement>('[data-cat-category-chips]');
  const mixBannerEl = root.querySelector<HTMLElement>('[data-cat-mix-banner]');
  const mixSummaryEl = root.querySelector<HTMLElement>('[data-cat-mix-summary]');
  const hideIncompatibleInput = root.querySelector<HTMLInputElement>('[data-cat-hide-incompatible]');
  const resultsCountEl = root.querySelector<HTMLElement>('[data-cat-count]');

  // Contenedores de los estados de interfaz
  const errorBox = root.querySelector<HTMLElement>('[data-cat-error]');
  const errorTextEl = root.querySelector<HTMLElement>('[data-cat-error-text]');
  const retryBtn = root.querySelector<HTMLButtonElement>('[data-cat-retry]');
  const loadingGrid = root.querySelector<HTMLElement>('[data-cat-loading]');
  const productsGrid = root.querySelector<HTMLElement>('[data-cat-grid]');
  const emptyBox = root.querySelector<HTMLElement>('[data-cat-empty]');
  const resetFiltersBtn = root.querySelector<HTMLButtonElement>('[data-cat-reset-filters]');

  if (
    !searchInput ||
    !typeChipsContainer ||
    !categoryChipsContainer ||
    !loadingGrid ||
    !productsGrid ||
    !emptyBox
  ) {
    return;
  }

  const state: CatalogoUIState = {
    allProducts: [],
    filter: {
      query: '',
      tipo: 'todos',
      categoria: 'todas',
    },
    mixContext: null,
    hideIncompatible: false,
    isLoading: true,
    errorMessage: null,
  };

  /** Crea las 8 tarjetas skeleton del estado de carga. */
  function renderSkeletons(): void {
    if (!loadingGrid) return;
    loadingGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < SKELETON_COUNT; i++) {
      const card = document.createElement('div');
      card.className = 'gm-cat-skeleton';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML =
        '<div class="gm-cat-skeleton-img"></div>' +
        '<div class="gm-cat-skeleton-line gm-cat-skeleton-line--short"></div>' +
        '<div class="gm-cat-skeleton-line"></div>' +
        '<div class="gm-cat-skeleton-btn"></div>';
      fragment.appendChild(card);
    }
    loadingGrid.appendChild(fragment);
  }

  /** Actualiza los chips del nivel 1 (`Todos` | `Gomitas` | `Maní`). */
  function renderTypeChips(): void {
    if (!typeChipsContainer) return;
    const types: Array<ProductType | 'todos'> = ['todos', 'gomita', 'mani'];
    typeChipsContainer.innerHTML = '';

    for (const tipo of types) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = state.filter.tipo === tipo;
      btn.className = isActive ? 'gm-cat-chip gm-cat-chip--active' : 'gm-cat-chip';
      btn.setAttribute('aria-pressed', String(isActive));
      btn.textContent = TYPE_LABELS[tipo];
      btn.addEventListener('click', () => {
        state.filter = sanitizeFilterForType({
          ...state.filter,
          tipo,
        });
        renderTypeChips();
        renderCategoryChips();
        renderProducts();
      });
      typeChipsContainer.appendChild(btn);
    }
  }

  /** Actualiza los chips dinámicos del nivel 2 según el tipo seleccionado. */
  function renderCategoryChips(): void {
    if (!categoryChipsContainer) return;
    const available = getAvailableCategoriesForType(state.filter.tipo);
    categoryChipsContainer.innerHTML = '';

    for (const cat of available) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = state.filter.categoria === cat;
      btn.className = isActive
        ? 'gm-cat-subchip gm-cat-subchip--active'
        : 'gm-cat-subchip';
      btn.setAttribute('aria-pressed', String(isActive));

      // Etiquetas en plural coherentes con el tipo elegido (ej. "Dulces", "Ácidas")
      let label = CATEGORY_LABELS[cat];
      if (cat === 'todas') {
        label = state.filter.tipo === 'mani' ? 'Todos' : 'Todas';
      } else if (state.filter.tipo === 'gomita') {
        if (cat === 'dulce') label = 'Dulces';
        if (cat === 'acido') label = 'Ácidas';
      }

      btn.textContent = label;
      btn.addEventListener('click', () => {
        state.filter = {
          ...state.filter,
          categoria: cat,
        };
        renderCategoryChips();
        renderProducts();
      });
      categoryChipsContainer.appendChild(btn);
    }
  }

  /** Actualiza el banner contextual cuando `mix-builder` tiene un tramo/perfil activo. */
  function renderMixBanner(): void {
    if (!mixBannerEl || !mixSummaryEl) return;
    const ctx = state.mixContext;

    if (!ctx || (!ctx.tier && !ctx.profile)) {
      mixBannerEl.hidden = true;
      return;
    }

    const parts: string[] = [];
    if (ctx.tier) {
      parts.push(`Armando bolsa ${ctx.tier.label}`);
    }
    if (ctx.profile === 'dulce-acido') {
      parts.push('Mix Dulce / Ácido (salados bloqueados)');
    } else if (ctx.profile === 'salado') {
      parts.push('Mix Salado (dulces y ácidos bloqueados)');
    }
    if (ctx.tier) {
      parts.push(`${ctx.selectedIds.length}/${ctx.tier.maxFlavors} sabores`);
    }

    mixSummaryEl.textContent = parts.join(' · ');
    mixBannerEl.hidden = false;
  }

  /** Crea el nodo DOM completo de una card de sabor. */
  function createProductCard(product: ProductDTO): HTMLElement {
    const evalState = evaluateProductAvailability(product, state.mixContext);

    const card = document.createElement('article');
    card.className = `gm-cat-card gm-cat-card--${evalState.status}`;
    card.dataset.productId = product.id;

    // 1. Contenedor de imagen `imgCalcomania` con carga lazy y fallback local
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'gm-cat-card-media';
    mediaWrap.dataset.category = product.categoria;

    const img = document.createElement('img');
    img.className = 'gm-cat-card-img';
    img.src = product.imgCalcomania || FALLBACK_STICKER_SVG;
    img.alt = `${product.nombre} (${TYPE_LABELS[product.tipo]} ${CATEGORY_LABELS[product.categoria]})`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 160;
    img.height = 160;
    img.onerror = () => {
      // Evita bucles infinitos si falla la ruta local
      img.onerror = null;
      img.src = FALLBACK_STICKER_SVG;
    };
    mediaWrap.appendChild(img);

    // Badge flotante superior si está elegido, agotado o bloqueado
    if (evalState.reasonBadge) {
      const statusBadge = document.createElement('span');
      statusBadge.className = `gm-cat-status-pill gm-cat-status-pill--${evalState.status}`;
      statusBadge.textContent =
        evalState.status === 'seleccionado'
          ? 'En tu mix'
          : evalState.status === 'agotado'
            ? 'Agotado'
            : evalState.status === 'incompatible'
              ? 'No mezclable'
              : evalState.status === 'stock-insuficiente'
                ? 'Poco stock'
                : 'Cupo lleno';
      mediaWrap.appendChild(statusBadge);
    }

    // 2. Cuerpo de la tarjeta
    const body = document.createElement('div');
    body.className = 'gm-cat-card-body';

    const badgesRow = document.createElement('div');
    badgesRow.className = 'gm-cat-badges';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'gm-cat-badge gm-cat-badge--type';
    typeBadge.dataset.type = product.tipo;
    typeBadge.textContent = TYPE_LABELS[product.tipo];

    const catBadge = document.createElement('span');
    catBadge.className = `gm-cat-badge gm-cat-badge--${product.categoria}`;
    catBadge.textContent = CATEGORY_LABELS[product.categoria];

    badgesRow.append(typeBadge, catBadge);

    const title = document.createElement('h3');
    title.className = 'gm-cat-card-title';
    title.textContent = product.nombre;

    const stockEl = document.createElement('p');
    stockEl.className = evalState.status === 'agotado'
      ? 'gm-cat-stock gm-cat-stock--empty'
      : evalState.isLowStock
        ? 'gm-cat-stock gm-cat-stock--low'
        : 'gm-cat-stock';
    stockEl.textContent = evalState.stockText;

    body.append(badgesRow, title, stockEl);

    // Motivo explicativo cuando está bloqueado por reglas del mix
    if (
      evalState.reasonBadge &&
      (evalState.status === 'incompatible' ||
        evalState.status === 'stock-insuficiente' ||
        evalState.status === 'cupo-lleno')
    ) {
      const reasonEl = document.createElement('p');
      reasonEl.className = 'gm-cat-reason';
      reasonEl.textContent = evalState.reasonBadge;
      body.appendChild(reasonEl);
    }

    // 3. Botón de acción (objetivo táctil >= 44px)
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = `gm-cat-action gm-cat-action--${evalState.status}`;
    actionBtn.disabled = !evalState.canSelect;
    actionBtn.setAttribute(
      'aria-label',
      `${evalState.buttonLabel}: ${product.nombre}`
    );

    const iconSvg = createActionIconSvg(evalState.status);
    const btnText = document.createElement('span');
    btnText.textContent = evalState.buttonLabel;
    actionBtn.append(iconSvg, btnText);

    if (evalState.canSelect) {
      actionBtn.addEventListener('click', () => {
        // Emitimos evento desacoplado hacia `mix-builder`
        eventBus.emit('catalogo:saborSeleccionado', { productId: product.id });

        // Microinteracción inmediata de confirmación táctil
        card.classList.add('gm-cat-card--pulse');
        window.setTimeout(() => {
          card.classList.remove('gm-cat-card--pulse');
        }, 380);
      });
    }

    card.append(mediaWrap, body, actionBtn);
    return card;
  }

  /** Renderiza la grilla principal y alterna los 5 estados visuales. */
  function renderProducts(): void {
    if (!loadingGrid || !productsGrid || !emptyBox) return;

    // Estado 1: Banner de error discreto (puede convivir con caché de respaldo)
    if (errorBox && errorTextEl) {
      if (state.errorMessage) {
        errorTextEl.textContent = state.errorMessage;
        errorBox.hidden = false;
      } else {
        errorBox.hidden = true;
      }
    }

    // Estado 2: Carga (skeletons)
    if (state.isLoading) {
      loadingGrid.hidden = false;
      productsGrid.hidden = true;
      emptyBox.hidden = true;
      if (resultsCountEl) resultsCountEl.textContent = 'Cargando sabores...';
      return;
    }

    loadingGrid.hidden = true;

    // Filtrado puro por búsqueda, tipo y subcategoría
    let visibleProducts = catalogoService.filterProducts(
      state.allProducts,
      state.filter
    );

    // Opcionalmente ocultar incompatibles si el usuario marcó el switch del banner
    if (state.hideIncompatible && state.mixContext) {
      visibleProducts = visibleProducts.filter((item) =>
        isProductCompatibleWithMix(item, state.mixContext)
      );
    }

    if (resultsCountEl) {
      const total = visibleProducts.length;
      resultsCountEl.textContent =
        total === 1 ? '1 sabor encontrado' : `${total} sabores encontrados`;
    }

    // Estado 3: Vacío
    if (visibleProducts.length === 0) {
      productsGrid.hidden = true;
      productsGrid.innerHTML = '';
      emptyBox.hidden = false;
      return;
    }

    // Estado 4: Ideal (grilla de cards)
    emptyBox.hidden = true;
    productsGrid.hidden = false;
    productsGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (const product of visibleProducts) {
      fragment.appendChild(createProductCard(product));
    }
    productsGrid.appendChild(fragment);
  }

  /** Carga o recarga el inventario desde `catalogoService`. */
  async function loadInventory(): Promise<void> {
    state.isLoading = true;
    state.errorMessage = null;
    renderProducts();

    const result = await catalogoService.loadProductsWithMeta();
    state.allProducts = result.products;
    state.errorMessage = result.errorMessage;
    state.isLoading = false;

    renderProducts();
  }

  /** Limpia búsqueda y filtros activos. */
  function resetAllFilters(): void {
    state.filter = {
      query: '',
      tipo: 'todos',
      categoria: 'todas',
    };
    state.hideIncompatible = false;
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.hidden = true;
    if (hideIncompatibleInput) hideIncompatibleInput.checked = false;

    renderTypeChips();
    renderCategoryChips();
    renderProducts();
  }

  // ==========================================================================
  // EVENTOS DEL USUARIO (BUSCADOR, SWITCHES Y BOTONES DE ESTADO)
  // ==========================================================================
  searchInput.addEventListener('input', () => {
    const value = searchInput.value;
    state.filter = {
      ...state.filter,
      query: value,
    };
    if (clearSearchBtn) {
      clearSearchBtn.hidden = value.trim().length === 0;
    }
    renderProducts();
  });

  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    state.filter = { ...state.filter, query: '' };
    clearSearchBtn.hidden = true;
    searchInput.focus();
    renderProducts();
  });

  hideIncompatibleInput?.addEventListener('change', () => {
    state.hideIncompatible = hideIncompatibleInput.checked;
    renderProducts();
  });

  resetFiltersBtn?.addEventListener('click', resetAllFilters);

  retryBtn?.addEventListener('click', () => {
    void loadInventory();
  });

  // ==========================================================================
  // SUSCRIPCIÓN AL EVENTBUS DESACOPLADO (ESCUCHA A `mix-builder`)
  // ==========================================================================
  eventBus.on('mix:contextoActualizado', (mixContext) => {
    state.mixContext = mixContext;
    renderMixBanner();
    renderProducts();
  });

  // Arranque inicial
  renderSkeletons();
  renderTypeChips();
  renderCategoryChips();
  renderMixBanner();
  void loadInventory();
}
