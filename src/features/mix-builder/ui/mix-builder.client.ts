/**
 * ============================================================================
 * QUÉ HACE:
 * Controlador de cliente (TypeScript nativo, cero frameworks) del módulo
 * `mix-builder`. Gestiona de principio a fin:
 * - Selección de formato fijo (`80g`, `500g`, `1kg`, `2kg`, `3kg`).
 * - Selección obligatoria de perfil (`Mix Dulce / Ácido` o `Mix Salado`) al
 *   elegir `500g` o más.
 * - Actualización dinámica del preview Doypack (80 g) o Bolsa Kraft (500 g+).
 * - Chips removibles con reparto equitativo exacto en gramos por sabor.
 * - Barra fija inferior en móvil mostrando progreso (`ej. 2/5 sabores · 250g c/u`)
 *   y botón "Añadir al carrito".
 * - Modo edición al recibir `carrito:editarItem` sin duplicar la bolsa.
 * - Comunicación desacoplada vía `EventBus`:
 *     Escucha: `catalogo:saborSeleccionado`, `carrito:editarItem`
 *     Emite:   `mix:contextoActualizado`, `mix:agregadoAlCarrito`
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `FALLBACK_IMAGE_SVG`: placeholder SVG si aún no cargas la foto local de
 *   algún sabor.
 * - `FEEDBACK_TIMEOUT_MS`: duración del estado visual breve al añadir al carrito.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa funciones puras desde `../logic/mix-rules`.
 * - Usa `productLookup` desde `../data/product-lookup.adapter` (sin importar
 *   archivos internos del catálogo).
 * - Usa `eventBus` (`src/shared/event-bus.ts`) y `formatClp` (`src/shared/config.ts`).
 * ============================================================================
 */
import type { ProductDTO } from '../../../contracts/catalogo.contract';
import type {
  BagSizeId,
  BagTierDTO,
  MixItemDTO,
  MixProfile,
} from '../../../contracts/mix-builder.contract';
import { BAG_TIERS, formatClp } from '../../../shared/config';
import { eventBus } from '../../../shared/event-bus';
import { showCandyToast, triggerSpringClass } from '../../../shared/motion-fx';
import {
  createFallbackProductFromMixFlavor,
  productLookup,
} from '../data/product-lookup.adapter';
import {
  MIX_PROFILE_LABELS,
  buildMixContextDTO,
  buildMixItemDTO,
  calculateEquitableGramsPerFlavor,
  distributeGramsEquitably,
  findMixStockIssues,
  getBagTierById,
  isDoypackTier,
  reconcileFlavorsForChange,
  requiresProfileSelection,
  validateFlavorAddition,
  validateMixForCart,
} from '../logic/mix-rules';

/** Duración del estado visual breve al confirmar adición al carrito (ms). */
const FEEDBACK_TIMEOUT_MS = 2200;

/** Imagen SVG liviana de respaldo si falta `imgCalcomania` o `imgProducto`. */
const FALLBACK_IMAGE_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">' +
      '<rect width="120" height="120" rx="24" fill="#FFF2F5"/>' +
      '<circle cx="60" cy="58" r="32" fill="#F44870" fill-opacity="0.16"/>' +
      '<text x="60" y="64" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="18" fill="#F44870">G&amp;M</text>' +
    '</svg>'
  );

/** Tipo de alerta visual mostrada en la sección del armador. */
type AlertKind = 'error' | 'warn' | 'success' | 'info';

/** Estado interno completo del armador de bolsas. */
interface MixBuilderState {
  tier: BagTierDTO;
  profile: MixProfile | null;
  selectedFlavors: ProductDTO[];
  editingUid: string | null;
  alert: { kind: AlertKind; message: string } | null;
  justSubmitted: boolean;
}

/**
 * Crea un ícono SVG inline "×" para los botones de quitar chip.
 */
function createCloseIconSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  svg.appendChild(path);
  return svg;
}

/**
 * Inicializa toda la interactividad del módulo `#mix-builder-module`.
 */
export function initMixBuilderSection(): void {
  const root = document.getElementById('mix-builder-module');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  // Referencias principales del DOM
  const tierButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-mb-tier]')
  );
  const profileStep = root.querySelector<HTMLElement>('[data-mb-profile-step]');
  const profileButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-mb-profile]')
  );
  const profileHint = root.querySelector<HTMLElement>('[data-mb-profile-hint]');

  // Modo edición y alertas
  const editBanner = root.querySelector<HTMLElement>('[data-mb-edit-banner]');
  const cancelEditBtn = root.querySelector<HTMLButtonElement>('[data-mb-cancel-edit]');
  const alertBox = root.querySelector<HTMLElement>('[data-mb-alert]');
  const alertText = root.querySelector<HTMLElement>('[data-mb-alert-text]');
  const alertCloseBtn = root.querySelector<HTMLButtonElement>('[data-mb-alert-close]');

  // Vistas de empaque: Doypack (80g) y Kraft (500g+)
  const doypackView = root.querySelector<HTMLElement>('[data-mb-doypack-view]');
  const doypackPouch = root.querySelector<HTMLElement>('[data-mb-doypack-pouch]');
  const doypackStickerSlot = root.querySelector<HTMLElement>('[data-mb-doypack-sticker-slot]');
  const doypackProductImg = root.querySelector<HTMLImageElement>('[data-mb-doypack-product]');
  const doypackEmpty = root.querySelector<HTMLElement>('[data-mb-doypack-empty]');
  const doypackStickerImg = root.querySelector<HTMLImageElement>('[data-mb-doypack-sticker]');
  const doypackStickerEmpty = root.querySelector<HTMLElement>('[data-mb-doypack-sticker-empty]');
  const doypackName = root.querySelector<HTMLElement>('[data-mb-doypack-name]');
  const doypackHint = root.querySelector<HTMLElement>('[data-mb-doypack-hint]');
  const doypackClearBtn = root.querySelector<HTMLButtonElement>('[data-mb-doypack-clear]');

  const kraftView = root.querySelector<HTMLElement>('[data-mb-kraft-view]');
  const kraftSvg = root.querySelector<SVGElement>('[data-mb-kraft-svg]');
  const kraftWeightText = root.querySelector<SVGTextElement>('[data-mb-kraft-weight]');
  const kraftTierBadge = root.querySelector<HTMLElement>('[data-mb-kraft-tier-badge]');
  const kraftProfileBadge = root.querySelector<HTMLElement>('[data-mb-kraft-profile-badge]');
  const kraftPrice = root.querySelector<HTMLElement>('[data-mb-kraft-price]');
  const kraftProgressText = root.querySelector<HTMLElement>('[data-mb-kraft-progress-text]');
  const kraftGramsText = root.querySelector<HTMLElement>('[data-mb-kraft-grams-text]');
  const kraftProgressFill = root.querySelector<HTMLElement>('[data-mb-kraft-progress-fill]');
  const chipsEmpty = root.querySelector<HTMLElement>('[data-mb-chips-empty]');
  const chipsList = root.querySelector<HTMLUListElement>('[data-mb-chips-list]');
  const clearAllBtn = root.querySelector<HTMLButtonElement>('[data-mb-clear-all]');

  // CTA principal y barra fija móvil
  const mainCtaBtn = root.querySelector<HTMLButtonElement>('[data-mb-submit]');
  const mainCtaText = root.querySelector<HTMLElement>('[data-mb-submit-text]');
  const mainCtaHint = root.querySelector<HTMLElement>('[data-mb-submit-hint]');
  const jumpCatalogBtn = root.querySelector<HTMLAnchorElement>('[data-mb-jump-catalog]');

  const mobileBar = root.querySelector<HTMLElement>('[data-mb-mobile-bar]');
  const mobileTitle = root.querySelector<HTMLElement>('[data-mb-mobile-title]');
  const mobileProgress = root.querySelector<HTMLElement>('[data-mb-mobile-progress]');
  const mobileSubmitBtn = root.querySelector<HTMLButtonElement>('[data-mb-mobile-submit]');
  const mobileSubmitText = root.querySelector<HTMLElement>('[data-mb-mobile-submit-text]');

  let submitFeedbackTimer: number | null = null;

  // Estado inicial: formato rápido `80g` activo y vacío, guiando a tocar un sabor
  const state: MixBuilderState = {
    tier: getBagTierById('80g'),
    profile: 'libre',
    selectedFlavors: [],
    editingUid: null,
    alert: null,
    justSubmitted: false,
  };

  /** Emite el contexto actual hacia `catalogo` mediante el `EventBus`. */
  function emitMixContext(): void {
    const context = buildMixContextDTO(
      state.tier,
      state.profile,
      state.selectedFlavors
    );
    eventBus.emit('mix:contextoActualizado', context);
  }

  /** Establece o limpia el mensaje de alerta visible para el usuario. */
  function setAlert(kind: AlertKind, message: string): void {
    state.alert = { kind, message };
    renderAlert();
  }

  function clearAlert(): void {
    state.alert = null;
    renderAlert();
  }

  /** Renderiza la caja de alertas (Error / Aviso / Confirmación). */
  function renderAlert(): void {
    if (!alertBox || !alertText) return;
    if (!state.alert) {
      alertBox.hidden = true;
      alertBox.className = 'gm-mb-alert';
      return;
    }
    alertBox.hidden = false;
    alertBox.className = `gm-mb-alert gm-mb-alert--${state.alert.kind}`;
    alertText.textContent = state.alert.message;
  }

  /** Renderiza el banner de modo edición cuando se edita una bolsa del carrito. */
  function renderEditBanner(): void {
    if (!editBanner) return;
    editBanner.hidden = state.editingUid === null;
  }

  /** Actualiza los botones del selector de formato (`80g` a `3kg`). */
  function renderTierSelector(): void {
    for (const btn of tierButtons) {
      const tierId = btn.dataset.mbTier as BagSizeId | undefined;
      const isActive = tierId === state.tier.id;
      btn.classList.toggle('gm-mb-tier-btn--active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    }
  }

  /** Muestra u oculta el paso obligatorio de perfil (`500g` o más). */
  function renderProfileSelector(): void {
    if (!profileStep) return;
    const needsProfile = requiresProfileSelection(state.tier);
    profileStep.hidden = !needsProfile;

    if (!needsProfile) return;

    const missingProfile = state.profile !== 'dulce-acido' && state.profile !== 'salado';
    profileStep.classList.toggle('gm-mb-profile-step--pending', missingProfile);

    for (const btn of profileButtons) {
      const profileVal = btn.dataset.mbProfile as MixProfile | undefined;
      const isActive = state.profile === profileVal;
      btn.classList.toggle('gm-mb-profile-btn--active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    }

    if (profileHint) {
      if (missingProfile) {
        profileHint.textContent =
          'Paso obligatorio: elige primero si tu bolsa será Dulce / Ácido o Salado. No se pueden mezclar.';
      } else if (state.profile === 'dulce-acido') {
        profileHint.textContent =
          'Activo: Mix Dulce / Ácido. Puedes combinar gomitas dulces, gomitas ácidas y maní dulce.';
      } else {
        profileHint.textContent =
          'Activo: Mix Salado. Solo sabores salados disponibles en el catálogo.';
      }
    }
  }

  /** Actualiza la vista Doypack exclusiva para `80g`. */
  function renderDoypackView(): void {
    if (!doypackView) return;
    const is80g = isDoypackTier(state.tier);
    doypackView.hidden = !is80g;
    if (!is80g) return;

    const chosen = state.selectedFlavors[0] ?? null;

    if (!chosen) {
      if (doypackProductImg) {
        doypackProductImg.hidden = true;
        doypackProductImg.removeAttribute('src');
      }
      if (doypackEmpty) doypackEmpty.hidden = false;
      if (doypackStickerImg) {
        doypackStickerImg.hidden = true;
        doypackStickerImg.removeAttribute('src');
      }
      if (doypackStickerEmpty) doypackStickerEmpty.hidden = false;
      if (doypackName) doypackName.textContent = 'Tu bolsita individual está vacía';
      if (doypackHint) {
        doypackHint.textContent =
          'Elige tu formato y toca 1 sabor en el catálogo (gomita dulce/ácida o maní dulce/salado).';
      }
      if (doypackClearBtn) doypackClearBtn.hidden = true;
      return;
    }

    // Ventana central transparente con `imgProducto`
    if (doypackProductImg) {
      doypackProductImg.hidden = false;
      doypackProductImg.alt = `Foto del producto ${chosen.nombre} dentro de bolsita 80 g`;
      doypackProductImg.onerror = () => {
        doypackProductImg.onerror = null;
        doypackProductImg.src = FALLBACK_IMAGE_SVG;
      };
      doypackProductImg.src = chosen.imgProducto || chosen.imgCalcomania || FALLBACK_IMAGE_SVG;
    }
    if (doypackEmpty) doypackEmpty.hidden = true;

    // Esquina superior izquierda con `imgCalcomania`
    if (doypackStickerImg) {
      doypackStickerImg.hidden = false;
      doypackStickerImg.alt = `Calcomanía ${chosen.nombre}`;
      doypackStickerImg.onerror = () => {
        doypackStickerImg.onerror = null;
        doypackStickerImg.src = FALLBACK_IMAGE_SVG;
      };
      doypackStickerImg.src = chosen.imgCalcomania || FALLBACK_IMAGE_SVG;
    }
    if (doypackStickerEmpty) doypackStickerEmpty.hidden = true;

    if (doypackName) doypackName.textContent = chosen.nombre;
    if (doypackHint) {
      doypackHint.textContent = `80 g exactos de ${chosen.nombre} · Stock disponible: ${chosen.stockGramos.toLocaleString('es-CL')} g.`;
    }
    if (doypackClearBtn) doypackClearBtn.hidden = false;
  }

  /** Actualiza la vista Bolsa Papel Kraft para `500g`, `1kg`, `2kg` y `3kg`. */
  function renderKraftView(): void {
    if (!kraftView) return;
    const isKraft = !isDoypackTier(state.tier);
    kraftView.hidden = !isKraft;
    if (!isKraft) return;

    const count = state.selectedFlavors.length;
    const max = state.tier.maxFlavors;
    const equitableBase = calculateEquitableGramsPerFlavor(state.tier.grams, count);
    const distribution = distributeGramsEquitably(state.tier.grams, count);
    const stockIssues = findMixStockIssues(state.tier, state.selectedFlavors);
    const stockIssueIds = new Set(stockIssues.map((issue) => issue.productId));

    // Etiqueta impresa en el SVG de la bolsa kraft
    if (kraftWeightText) kraftWeightText.textContent = state.tier.label;
    if (kraftTierBadge) kraftTierBadge.textContent = `Bolsa Kraft ${state.tier.label}`;
    if (kraftPrice) kraftPrice.textContent = formatClp(state.tier.priceClp);

    if (kraftProfileBadge) {
      if (state.profile === 'dulce-acido' || state.profile === 'salado') {
        kraftProfileBadge.textContent = MIX_PROFILE_LABELS[state.profile];
        kraftProfileBadge.dataset.profile = state.profile;
      } else {
        kraftProfileBadge.textContent = 'Perfil pendiente';
        kraftProfileBadge.dataset.profile = 'pending';
      }
    }

    // Progreso textual y barra visual
    if (kraftProgressText) {
      kraftProgressText.textContent = `${count}/${max} sabores elegidos`;
    }
    if (kraftGramsText) {
      if (count === 0) {
        kraftGramsText.textContent = `Elige entre 1 y ${max} sabores`;
      } else {
        const hasRemainder = state.tier.grams % count !== 0;
        kraftGramsText.textContent = hasRemainder
          ? `~${equitableBase} g c/u (reparto equitativo)`
          : `${equitableBase} g c/u`;
      }
    }
    if (kraftProgressFill) {
      const pct = Math.min(100, Math.round((count / Math.max(1, max)) * 100));
      kraftProgressFill.style.width = `${pct}%`;
      kraftProgressFill.classList.toggle('is-complete', count >= max && count > 0);
    }

    // Estado vacío vs. chips removibles
    if (chipsEmpty && chipsList) {
      if (count === 0) {
        chipsEmpty.hidden = false;
        chipsList.hidden = true;
        chipsList.innerHTML = '';
      } else {
        chipsEmpty.hidden = true;
        chipsList.hidden = false;
        chipsList.innerHTML = '';

        const fragment = document.createDocumentFragment();
        state.selectedFlavors.forEach((flavor, idx) => {
          const grams = distribution[idx] ?? equitableBase;
          const hasStockIssue = stockIssueIds.has(flavor.id);

          const li = document.createElement('li');
          li.className = hasStockIssue
            ? 'gm-kraft-chip gm-kraft-chip--warn'
            : 'gm-kraft-chip';

          const thumb = document.createElement('img');
          thumb.className = 'gm-kraft-chip-img';
          thumb.src = flavor.imgCalcomania || FALLBACK_IMAGE_SVG;
          thumb.alt = '';
          thumb.width = 28;
          thumb.height = 28;
          thumb.onerror = () => {
            thumb.onerror = null;
            thumb.src = FALLBACK_IMAGE_SVG;
          };

          const textWrap = document.createElement('div');
          textWrap.className = 'gm-kraft-chip-text';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'gm-kraft-chip-name';
          nameSpan.textContent = flavor.nombre;

          const gramsSpan = document.createElement('span');
          gramsSpan.className = 'gm-kraft-chip-grams';
          gramsSpan.textContent = hasStockIssue
            ? `${grams} g (stock: ${flavor.stockGramos} g)`
            : `${grams} g`;

          textWrap.append(nameSpan, gramsSpan);

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'gm-kraft-chip-remove';
          removeBtn.setAttribute('aria-label', `Quitar ${flavor.nombre} de la bolsa`);
          removeBtn.appendChild(createCloseIconSvg());
          removeBtn.addEventListener('click', () => {
            removeFlavorById(flavor.id);
          });

          li.append(thumb, textWrap, removeBtn);
          fragment.appendChild(li);
        });

        chipsList.appendChild(fragment);
      }
    }

    if (clearAllBtn) {
      clearAllBtn.hidden = count === 0;
    }
  }

  /** Actualiza tanto el botón CTA principal como la barra fija inferior en móvil. */
  function renderActionBars(): void {
    const validation = validateMixForCart({
      tier: state.tier,
      profile: state.profile,
      selectedFlavors: state.selectedFlavors,
    });

    const priceLabel = formatClp(state.tier.priceClp);
    const is80g = isDoypackTier(state.tier);
    const count = state.selectedFlavors.length;
    const max = state.tier.maxFlavors;
    const equitableGrams = calculateEquitableGramsPerFlavor(state.tier.grams, count);

    let ctaLabel = '';
    if (state.justSubmitted) {
      ctaLabel = state.editingUid ? '¡Cambios guardados!' : '¡Agregado al carrito!';
    } else if (state.editingUid) {
      ctaLabel = `Guardar cambios (${priceLabel})`;
    } else if (is80g) {
      ctaLabel = `Añadir bolsita de 80 g (${priceLabel})`;
    } else {
      ctaLabel = `Añadir al carrito (${priceLabel})`;
    }

    if (mainCtaBtn && mainCtaText) {
      mainCtaBtn.disabled = !validation.canSubmit;
      mainCtaBtn.setAttribute('aria-disabled', String(!validation.canSubmit));
      mainCtaBtn.classList.toggle('gm-mb-submit--confirmed', state.justSubmitted);
      mainCtaText.textContent = ctaLabel;
    }

    if (mainCtaHint) {
      if (state.justSubmitted) {
        mainCtaHint.textContent = 'Puedes seguir armando otra bolsa o abrir tu carrito arriba.';
        mainCtaHint.dataset.state = 'success';
      } else if (!validation.canSubmit && validation.reason) {
        mainCtaHint.textContent = validation.reason;
        mainCtaHint.dataset.state = validation.stockIssues.length > 0 ? 'error' : 'muted';
      } else if (is80g) {
        mainCtaHint.textContent = 'Listo para ir directo al carrito.';
        mainCtaHint.dataset.state = 'ready';
      } else {
        mainCtaHint.textContent = `Puedes añadir tu bolsa ahora (${count}/${max} sabores · ${equitableGrams} g c/u) o sumar más sabores.`;
        mainCtaHint.dataset.state = 'ready';
      }
    }

    if (jumpCatalogBtn) {
      jumpCatalogBtn.hidden = count >= max;
    }

    // Barra fija inferior en móvil
    if (mobileBar && mobileTitle && mobileProgress && mobileSubmitBtn && mobileSubmitText) {
      mobileBar.classList.toggle('is-ready', validation.canSubmit);
      mobileTitle.textContent = `${state.tier.label} · ${priceLabel}`;

      if (requiresProfileSelection(state.tier) && (!state.profile || state.profile === 'libre')) {
        mobileProgress.textContent = 'Paso 1: elige Mix Dulce/Ácido o Salado';
      } else if (count === 0) {
        mobileProgress.textContent = is80g
          ? '0/1 sabor · Toca un sabor abajo'
          : `0/${max} sabores · Toca sabores en el catálogo`;
      } else {
        mobileProgress.textContent = is80g
          ? '1/1 sabor · 80 g'
          : `${count}/${max} sabores · ${equitableGrams} g c/u`;
      }

      mobileSubmitBtn.disabled = !validation.canSubmit;
      mobileSubmitBtn.setAttribute('aria-disabled', String(!validation.canSubmit));
      mobileSubmitBtn.classList.toggle('gm-mb-submit--confirmed', state.justSubmitted);
      mobileSubmitText.textContent = state.justSubmitted
        ? '¡Listo!'
        : state.editingUid
          ? 'Guardar'
          : 'Añadir al carrito';
    }
  }

  /** Re-renderiza toda la vista y notifica el contexto actualizado al catálogo. */
  function renderAll(shouldEmitContext = true): void {
    renderEditBanner();
    renderTierSelector();
    renderProfileSelector();
    renderDoypackView();
    renderKraftView();
    renderActionBars();
    renderAlert();

    if (shouldEmitContext) {
      emitMixContext();
    }
  }

  /** Cambia el tramo activo (`80g` a `3kg`) aplicando reglas de transición limpias. */
  function selectTier(tierId: BagSizeId): void {
    const nextTier = getBagTierById(tierId);
    if (nextTier.id === state.tier.id) return;

    const was80g = isDoypackTier(state.tier);
    const willBe80g = isDoypackTier(nextTier);

    state.tier = nextTier;
    state.justSubmitted = false;
    clearAlert();

    if (willBe80g) {
      // Al pasar a 80 g (Doypack), el perfil vuelve a ser libre y conservamos máximo 1 sabor
      state.profile = 'libre';
      const reconciled = reconcileFlavorsForChange({
        selectedFlavors: state.selectedFlavors,
        targetTier: nextTier,
        targetProfile: 'libre',
      });
      state.selectedFlavors = reconciled.kept;
      if (reconciled.trimmedByLimitCount > 0) {
        setAlert(
          'info',
          'En 80 g solo entra 1 sabor: mantuvimos el primer sabor de tu selección.'
        );
      }
    } else if (was80g) {
      // Al subir de 80 g a 500 g+, exigimos elegir explícitamente el perfil obligatorio
      state.profile = null;
      if (state.selectedFlavors.length > 0) {
        state.selectedFlavors = [];
        setAlert(
          'info',
          `Elegiste ${nextTier.label}. Selecciona ahora si quieres Mix Dulce / Ácido o Mix Salado.`
        );
      }
    } else {
      // Cambio entre dos bolsas Kraft (ej. 1kg -> 500g): conservamos perfil y ajustamos cupo
      const reconciled = reconcileFlavorsForChange({
        selectedFlavors: state.selectedFlavors,
        targetTier: nextTier,
        targetProfile: state.profile,
      });
      state.selectedFlavors = reconciled.kept;
      if (reconciled.trimmedByLimitCount > 0) {
        setAlert(
          'warn',
          `Ajustamos tu selección a los primeros ${nextTier.maxFlavors} sabores permitidos en ${nextTier.label}.`
        );
      }
    }

    renderAll(true);
  }

  /** Selecciona el perfil obligatorio (`dulce-acido` o `salado`) para tramos >= 500 g. */
  function selectProfile(profile: MixProfile): void {
    if (!requiresProfileSelection(state.tier)) return;
    if (state.profile === profile) return;

    state.profile = profile;
    state.justSubmitted = false;
    clearAlert();

    const reconciled = reconcileFlavorsForChange({
      selectedFlavors: state.selectedFlavors,
      targetTier: state.tier,
      targetProfile: profile,
    });
    state.selectedFlavors = reconciled.kept;

    if (reconciled.removedIncompatibleCount > 0) {
      setAlert(
        'info',
        `Cambiaste a ${MIX_PROFILE_LABELS[profile]} y quitamos ${reconciled.removedIncompatibleCount} sabor(es) incompatible(s).`
      );
    }

    renderAll(true);
  }

  /** Quita un sabor elegido (desde el chip o desde Doypack 80 g). */
  function removeFlavorById(productId: string): void {
    state.selectedFlavors = state.selectedFlavors.filter((item) => item.id !== productId);
    state.justSubmitted = false;
    clearAlert();
    renderAll(true);
  }

  /** Vacía todos los sabores elegidos manteniendo el formato y perfil actuales. */
  function clearSelectedFlavors(): void {
    state.selectedFlavors = [];
    state.justSubmitted = false;
    clearAlert();
    renderAll(true);
  }

  /** Cancela el modo edición y deja el armador limpio. */
  function cancelEditMode(): void {
    state.editingUid = null;
    state.selectedFlavors = [];
    state.tier = getBagTierById('80g');
    state.profile = 'libre';
    state.justSubmitted = false;
    clearAlert();
    renderAll(true);
  }

  /** Procesa la adición de un sabor al recibir `catalogo:saborSeleccionado`. */
  async function handleCatalogFlavorSelected(productId: string): Promise<void> {
    state.justSubmitted = false;
    const candidate = await productLookup.getById(productId);

    if (!candidate) {
      setAlert('error', 'No pudimos encontrar ese sabor en el inventario. Recarga e intenta de nuevo.');
      return;
    }

    const check = validateFlavorAddition({
      tier: state.tier,
      profile: state.profile,
      selectedFlavors: state.selectedFlavors,
      candidate,
    });

    if (!check.ok) {
      setAlert('error', check.message ?? 'No se pudo agregar este sabor a tu bolsa.');
      // Si faltaba elegir perfil en 500 g+, llevamos al cliente al paso de perfil
      if (check.code === 'PROFILE_REQUIRED' && profileStep) {
        profileStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    state.selectedFlavors = [...state.selectedFlavors, candidate];

    // Verificamos si con el reparto actual algún sabor necesita más sabores para cubrir stock
    const stockIssues = findMixStockIssues(state.tier, state.selectedFlavors);
    if (stockIssues.length > 0) {
      const issue = stockIssues[0];
      setAlert(
        'warn',
        `Agregamos ${candidate.nombre}. Como ${issue.nombre} tiene ${issue.availableGrams} g de stock y ahora le tocan ${issue.requiredGrams} g, suma otro sabor para repartir el peso.`
      );
    } else {
      clearAlert();
    }

    renderAll(true);

    if (isDoypackTier(state.tier)) {
      triggerSpringClass(doypackPouch, 'gm-spring-pop');
      triggerSpringClass(doypackStickerSlot, 'gm-spring-pop');
    } else {
      triggerSpringClass(kraftSvg, 'gm-spring-pop');
    }

    if (state.selectedFlavors.length >= state.tier.maxFlavors) {
      triggerSpringClass(mainCtaBtn, 'is-ready-pulse', 1000);
      triggerSpringClass(mobileSubmitBtn, 'is-ready-pulse', 1000);
    }
  }

  /** Precarga una bolsa existente al recibir `carrito:editarItem`. */
  async function handleEditItemFromCart(item: MixItemDTO): Promise<void> {
    await productLookup.preload();

    const tier = getBagTierById(item.tierId);
    const hydratedFlavors: ProductDTO[] = [];

    for (const flavor of item.flavors) {
      const product = await productLookup.getById(flavor.productId);
      hydratedFlavors.push(
        product ?? createFallbackProductFromMixFlavor(flavor, item.profile)
      );
    }

    state.editingUid = item.uid;
    state.tier = tier;
    state.profile = requiresProfileSelection(tier)
      ? (item.profile === 'salado' ? 'salado' : 'dulce-acido')
      : 'libre';
    state.selectedFlavors = hydratedFlavors;
    state.justSubmitted = false;

    setAlert(
      'info',
      `Editando tu bolsa de ${tier.label}. Modifica los sabores que quieras y presiona "Guardar cambios".`
    );

    renderAll(true);

    // Desplazamiento suave hasta el armador para que el cliente edite de inmediato
    root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Emite `mix:agregadoAlCarrito` tras validar todas las reglas de negocio. */
  function submitMixToCart(): void {
    const validation = validateMixForCart({
      tier: state.tier,
      profile: state.profile,
      selectedFlavors: state.selectedFlavors,
    });

    if (!validation.canSubmit) {
      setAlert('error', validation.reason ?? 'Revisa tu selección antes de añadir al carrito.');
      return;
    }

    const effectiveProfile: MixProfile = requiresProfileSelection(state.tier)
      ? (state.profile ?? 'dulce-acido')
      : 'libre';

    const wasEdit = state.editingUid !== null;
    const item = buildMixItemDTO({
      uid: state.editingUid,
      tier: state.tier,
      profile: effectiveProfile,
      selectedFlavors: state.selectedFlavors,
    });

    // Emitimos la bolsa terminada hacia el módulo `carrito`
    eventBus.emit('mix:agregadoAlCarrito', {
      item,
      isEdit: wasEdit,
    });

    // Reiniciamos selección para permitir armar la siguiente bolsa y mostramos confirmación breve
    state.editingUid = null;
    state.selectedFlavors = [];
    state.justSubmitted = true;

    setAlert(
      'success',
      wasEdit
        ? `¡Listo! Actualizamos tu bolsa de ${item.tierId} en el carrito.`
        : `¡Agregamos tu bolsa de ${item.tierId} (${formatClp(item.priceClp)}) al carrito!`
    );

    renderAll(true);

    showCandyToast({
      message: wasEdit
        ? `¡Bolsa ${item.tierId} actualizada en tu carrito!`
        : `¡Bolsa ${item.tierId} agregada al carrito!`,
      tone: 'mint',
      actionLabel: 'Abrir carrito',
      onAction: () => {
        eventBus.emit('carrito:abrirDrawer', { open: true });
      },
    });

    if (submitFeedbackTimer !== null) {
      window.clearTimeout(submitFeedbackTimer);
    }
    submitFeedbackTimer = window.setTimeout(() => {
      state.justSubmitted = false;
      renderActionBars();
    }, FEEDBACK_TIMEOUT_MS);
  }

  // ==========================================================================
  // LISTENERS DE INTERFAZ (CLICS DEL USUARIO)
  // ==========================================================================
  for (const btn of tierButtons) {
    btn.addEventListener('click', () => {
      const tierId = btn.dataset.mbTier as BagSizeId | undefined;
      if (tierId && BAG_TIERS.some((t) => t.id === tierId)) {
        selectTier(tierId);
      }
    });
  }

  for (const btn of profileButtons) {
    btn.addEventListener('click', () => {
      const profileVal = btn.dataset.mbProfile as MixProfile | undefined;
      if (profileVal === 'dulce-acido' || profileVal === 'salado') {
        selectProfile(profileVal);
      }
    });
  }

  doypackClearBtn?.addEventListener('click', clearSelectedFlavors);
  clearAllBtn?.addEventListener('click', clearSelectedFlavors);
  cancelEditBtn?.addEventListener('click', cancelEditMode);
  alertCloseBtn?.addEventListener('click', clearAlert);

  mainCtaBtn?.addEventListener('click', submitMixToCart);
  mobileSubmitBtn?.addEventListener('click', submitMixToCart);

  // ==========================================================================
  // SUSCRIPCIONES AL EVENTBUS DESACOPLADO
  // ==========================================================================
  eventBus.on('catalogo:saborSeleccionado', ({ productId }) => {
    void handleCatalogFlavorSelected(productId);
  });

  eventBus.on('carrito:editarItem', ({ item }) => {
    void handleEditItemFromCart(item);
  });

  // Arranque inicial: precarga inventario en segundo plano, dibuja UI y sincroniza catálogo
  void productLookup.preload();
  renderAll(true);

  // Garantiza sincronización inicial aunque `catalogo` monte su script justo después en la página
  window.setTimeout(() => {
    emitMixContext();
  }, 0);
}
