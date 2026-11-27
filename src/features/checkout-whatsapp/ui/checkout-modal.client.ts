/**
 * ============================================================================
 * QUÉ HACE:
 * Controlador de cliente para la ventana flotante de checkout por WhatsApp
 * (`CheckoutModal.astro`).
 * - Se abre al recibir el evento `gomania:irACheckout` desde el carrito.
 * - Valida los 3 campos (nombre y apellido, correo electrónico, dirección).
 * - Genera el pedido y abre WhatsApp con todos los datos y detalle de bolsas.
 * - Muestra un paso de confirmación modal antes de vaciar el carrito.
 * ============================================================================
 */
import type { CartStateDTO } from '../../../contracts/carrito.contract';
import type { OrderResultDTO } from '../../../contracts/checkout.contract';
import { eventBus } from '../../../shared/event-bus';
import { showCandyToast } from '../../../shared/motion-fx';
import { formatClp } from '../../../shared/config';
import { carritoStore } from '../../carrito';
import {
  submitWhatsAppOrder,
  validateCheckoutForm,
  type CheckoutFormErrors,
} from '../index';

interface CheckoutModalDom {
  root: HTMLElement;
  overlay: HTMLElement;
  closeBtn: HTMLButtonElement;
  stepForm: HTMLElement;
  stepConfirm: HTMLElement;
  summaryText: HTMLElement;
  form: HTMLFormElement;
  nombreInput: HTMLInputElement;
  correoInput: HTMLInputElement;
  direccionInput: HTMLInputElement;
  honeypotInput: HTMLInputElement;
  errorNombre: HTMLElement;
  errorCorreo: HTMLElement;
  errorDireccion: HTMLElement;
  cancelBtn: HTMLButtonElement;
  submitBtn: HTMLButtonElement;
  submitLabel: HTMLElement;
  folioBadge: HTMLElement;
  confirmDesc: HTMLElement;
  reopenWaLink: HTMLAnchorElement;
  copyMsgBtn: HTMLButtonElement;
  backToFormBtn: HTMLButtonElement;
  confirmFinishBtn: HTMLButtonElement;
}

function queryCheckoutDom(): CheckoutModalDom | null {
  const root = document.getElementById('gm-checkout-modal');
  if (!root) return null;

  const overlay = root.querySelector<HTMLElement>('[data-checkout-overlay]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-checkout-close]');
  const stepForm = root.querySelector<HTMLElement>('[data-checkout-step="form"]');
  const stepConfirm = root.querySelector<HTMLElement>('[data-checkout-step="confirm"]');
  const summaryText = root.querySelector<HTMLElement>('[data-checkout-summary]');
  const form = root.querySelector<HTMLFormElement>('[data-checkout-form]');
  const nombreInput = root.querySelector<HTMLInputElement>('[data-checkout-nombre]');
  const correoInput = root.querySelector<HTMLInputElement>('[data-checkout-correo]');
  const direccionInput = root.querySelector<HTMLInputElement>('[data-checkout-direccion]');
  const honeypotInput = root.querySelector<HTMLInputElement>('[data-checkout-honeypot]');
  const errorNombre = root.querySelector<HTMLElement>('[data-checkout-error="nombre"]');
  const errorCorreo = root.querySelector<HTMLElement>('[data-checkout-error="correo"]');
  const errorDireccion = root.querySelector<HTMLElement>('[data-checkout-error="direccion"]');
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-checkout-cancel]');
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-checkout-submit]');
  const submitLabel = root.querySelector<HTMLElement>('[data-checkout-submit-label]');
  const folioBadge = root.querySelector<HTMLElement>('[data-checkout-folio]');
  const confirmDesc = root.querySelector<HTMLElement>('[data-checkout-confirm-desc]');
  const reopenWaLink = root.querySelector<HTMLAnchorElement>('[data-checkout-reopen-wa]');
  const copyMsgBtn = root.querySelector<HTMLButtonElement>('[data-checkout-copy]');
  const backToFormBtn = root.querySelector<HTMLButtonElement>('[data-checkout-back]');
  const confirmFinishBtn = root.querySelector<HTMLButtonElement>('[data-checkout-finish]');

  if (
    !overlay ||
    !closeBtn ||
    !stepForm ||
    !stepConfirm ||
    !summaryText ||
    !form ||
    !nombreInput ||
    !correoInput ||
    !direccionInput ||
    !honeypotInput ||
    !errorNombre ||
    !errorCorreo ||
    !errorDireccion ||
    !cancelBtn ||
    !submitBtn ||
    !submitLabel ||
    !folioBadge ||
    !confirmDesc ||
    !reopenWaLink ||
    !copyMsgBtn ||
    !backToFormBtn ||
    !confirmFinishBtn
  ) {
    return null;
  }

  return {
    root,
    overlay,
    closeBtn,
    stepForm,
    stepConfirm,
    summaryText,
    form,
    nombreInput,
    correoInput,
    direccionInput,
    honeypotInput,
    errorNombre,
    errorCorreo,
    errorDireccion,
    cancelBtn,
    submitBtn,
    submitLabel,
    folioBadge,
    confirmDesc,
    reopenWaLink,
    copyMsgBtn,
    backToFormBtn,
    confirmFinishBtn,
  };
}

export function initCheckoutModal(): void {
  const dom = queryCheckoutDom();
  if (!dom || dom.root.dataset.initialized === 'true') return;
  dom.root.dataset.initialized = 'true';

  let isOpen = false;
  let isSubmitting = false;
  let activeCart: CartStateDTO | null = null;
  let lastOrderResult: OrderResultDTO | null = null;
  let lastFocusedElement: HTMLElement | null = null;

  function renderErrors(errors: CheckoutFormErrors): void {
    const fields: Array<{
      input: HTMLInputElement;
      errorEl: HTMLElement;
      message?: string;
    }> = [
      { input: dom!.nombreInput, errorEl: dom!.errorNombre, message: errors.nombre },
      { input: dom!.correoInput, errorEl: dom!.errorCorreo, message: errors.correo },
      { input: dom!.direccionInput, errorEl: dom!.errorDireccion, message: errors.direccion },
    ];

    fields.forEach(({ input, errorEl, message }) => {
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        errorEl.textContent = message;
        errorEl.hidden = false;
      } else {
        input.removeAttribute('aria-invalid');
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    });
  }

  function showStep(step: 'form' | 'confirm'): void {
    if (step === 'form') {
      dom!.stepForm.hidden = false;
      dom!.stepConfirm.hidden = true;
    } else {
      dom!.stepForm.hidden = true;
      dom!.stepConfirm.hidden = false;
    }
  }

  function setSubmitting(next: boolean): void {
    isSubmitting = next;
    dom!.submitBtn.disabled = next;
    dom!.submitBtn.setAttribute('aria-busy', String(next));
    dom!.submitLabel.textContent = next
      ? 'Preparando pedido...'
      : 'Enviar pedido por WhatsApp';
  }

  function openModal(cart: CartStateDTO): void {
    activeCart = cart;
    lastOrderResult = null;
    isOpen = true;

    const bagsLabel = cart.totalItems === 1 ? '1 bolsa' : `${cart.totalItems} bolsas`;
    dom!.summaryText.textContent = `${bagsLabel} · ${formatClp(cart.totalClp)}`;

    renderErrors({});
    setSubmitting(false);
    showStep('form');

    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dom!.root.classList.add('is-open');
    dom!.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gm-checkout-scroll-lock');

    window.requestAnimationFrame(() => {
      dom!.nombreInput.focus();
    });
  }

  function closeModal(): void {
    if (!isOpen) return;
    isOpen = false;
    dom!.root.classList.remove('is-open');
    dom!.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gm-checkout-scroll-lock');

    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  function showConfirmationStep(result: OrderResultDTO): void {
    lastOrderResult = result;

    if (result.folio) {
      dom!.folioBadge.textContent = `Pedido ${result.folio}`;
      dom!.folioBadge.hidden = false;
    } else {
      dom!.folioBadge.textContent = '';
      dom!.folioBadge.hidden = true;
    }

    const emailValue = dom!.correoInput.value.trim();
    dom!.confirmDesc.textContent =
      `Abrimos WhatsApp con tus datos y el detalle de tu pedido. ` +
      `Al terminar la compra por WhatsApp, el código de seguimiento que entreguen a GoManía ` +
      `será enviado a ${emailValue} y a tu WhatsApp para que revises el estado de tu envío.`;

    dom!.reopenWaLink.href = result.whatsappUrl;
    dom!.copyMsgBtn.textContent = 'Copiar mensaje del pedido';
    showStep('confirm');

    window.requestAnimationFrame(() => {
      dom!.confirmFinishBtn.focus();
    });
  }

  // Escucha el evento emitido por `CarritoDrawer` al apretar "Finalizar compra"
  window.addEventListener('gomania:irACheckout', (event: Event) => {
    const customEvent = event as CustomEvent<CartStateDTO | undefined>;
    const cart = customEvent.detail ?? carritoStore.getState();
    if (!cart || cart.totalItems === 0) return;
    openModal(cart);
  });

  // Limpia errores individuales mientras el cliente escribe
  [
    { input: dom.nombreInput, key: 'nombre' as const, errorEl: dom.errorNombre },
    { input: dom.correoInput, key: 'correo' as const, errorEl: dom.errorCorreo },
    { input: dom.direccionInput, key: 'direccion' as const, errorEl: dom.errorDireccion },
  ].forEach(({ input, errorEl }) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        input.removeAttribute('aria-invalid');
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    });
  });

  dom.form.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const cart = activeCart ?? carritoStore.getState();
    if (!cart || cart.totalItems === 0) {
      closeModal();
      return;
    }

    const validation = validateCheckoutForm({
      nombre: dom.nombreInput.value,
      correo: dom.correoInput.value,
      direccion: dom.direccionInput.value,
      honeypot: dom.honeypotInput.value,
    });

    if (!validation.valid) {
      renderErrors(validation.errors);
      if (validation.errors.nombre) dom.nombreInput.focus();
      else if (validation.errors.correo) dom.correoInput.focus();
      else if (validation.errors.direccion) dom.direccionInput.focus();
      return;
    }

    renderErrors({});
    setSubmitting(true);

    try {
      const result = await submitWhatsAppOrder(validation.cleaned, cart);
      window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');
      showConfirmationStep(result);
    } finally {
      setSubmitting(false);
    }
  });

  dom.copyMsgBtn.addEventListener('click', async () => {
    if (!lastOrderResult) return;
    try {
      await navigator.clipboard.writeText(lastOrderResult.messageText);
      dom.copyMsgBtn.textContent = '¡Mensaje copiado!';
      window.setTimeout(() => {
        dom.copyMsgBtn.textContent = 'Copiar mensaje del pedido';
      }, 2400);
    } catch {
      dom.copyMsgBtn.textContent = 'No se pudo copiar automáticamente';
    }
  });

  dom.backToFormBtn.addEventListener('click', () => {
    showStep('form');
    window.requestAnimationFrame(() => {
      dom.nombreInput.focus();
    });
  });

  dom.confirmFinishBtn.addEventListener('click', () => {
    const folio = lastOrderResult?.folio ?? '';
    eventBus.emit('checkout:pedidoCompletado', { folio });
    dom.form.reset();
    closeModal();
    showCandyToast({
      message: folio
        ? `¡Pedido ${folio} enviado! Revisa tu correo y WhatsApp para tu seguimiento.`
        : '¡Pedido enviado por WhatsApp! Revisa tu correo y WhatsApp para tu seguimiento.',
      tone: 'mint',
    });
  });

  dom.closeBtn.addEventListener('click', closeModal);
  dom.cancelBtn.addEventListener('click', closeModal);
  dom.overlay.addEventListener('click', closeModal);

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeModal();
    }
  });
}
