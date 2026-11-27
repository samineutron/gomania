/**
 * ============================================================================
 * QUÉ HACE:
 * Módulo compartido de micro-interacciones y animaciones modernas para GoManía:
 * - `burstButtonConfetti`: dispara confeti multicolor desde un botón o
 *   coordenadas DOMRect exactas (ideal al completar una bolsa de 80 g o mix).
 * - `showCandyToast`: notificación flotante moderna tipo píldora con botón
 *   opcional de acción rápida.
 * - `triggerSpringClass`: dispara y reinicia clases CSS de animación elástica.
 * - `initScrollReveal`: activa apariciones suaves al hacer scroll con
 *   `IntersectionObserver` (degradación segura si está desactivado).
 * ============================================================================
 */

export type CandyToastTone = 'pink' | 'sky' | 'mint' | 'lemon';
export type ConfettiTone = 'sweet' | 'acid' | 'salty' | 'party';

export interface CandyToastOptions {
  message: string;
  tone?: CandyToastTone;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

const CONFETTI_PALETTES: Record<ConfettiTone, readonly string[]> = {
  sweet: ['#F64B73', '#28AAE1', '#FF85A2', '#A78BFA', '#FDE047', '#FFFFFF'],
  acid: ['#FACC15', '#34D399', '#28AAE1', '#F64B73', '#A7F3D0'],
  salty: ['#F59E0B', '#C89D70', '#FDE68A', '#28AAE1', '#F64B73'],
  party: ['#F64B73', '#28AAE1', '#FACC15', '#34D399', '#C084FC', '#FB923C'],
};

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Dispara confeti moderno desde un elemento o `DOMRect` específico.
 */
export function burstButtonConfetti(
  origin: HTMLElement | DOMRect | null | undefined,
  tone: ConfettiTone = 'party'
): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  const rect =
    origin instanceof DOMRect
      ? origin
      : origin instanceof HTMLElement
        ? origin.getBoundingClientRect()
        : null;

  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.5;
  const colors = CONFETTI_PALETTES[tone];

  const layer = document.createElement('div');
  layer.className = 'gm-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const count = 24;
  let completed = 0;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const shapeKind = i % 3; // 0: cinta, 1: círculo, 2: rombo/estrella
    const width = shapeKind === 0 ? 7 + (i % 3) * 2 : 8 + (i % 3) * 2;
    const height = shapeKind === 0 ? 12 + (i % 4) * 2 : width;
    const color = colors[i % colors.length];

    piece.className = 'gm-confetti-piece';
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.width = `${width}px`;
    piece.style.height = `${height}px`;
    piece.style.backgroundColor = color;
    piece.style.borderRadius =
      shapeKind === 1 ? '9999px' : shapeKind === 2 ? '2px' : '3px';

    // Abanico ascendente natural con dispersión lateral
    const spreadAngle = -Math.PI / 2 + ((i / (count - 1)) - 0.5) * Math.PI * 1.45;
    const angle = spreadAngle + (Math.random() - 0.5) * 0.25;
    const velocity = 65 + Math.random() * 95;
    const peakX = Math.cos(angle) * velocity * 0.65;
    const peakY = Math.sin(angle) * velocity - 24;
    const endX = Math.cos(angle) * velocity * 1.25;
    const endY = peakY + 75 + Math.random() * 45;
    const rot = Math.round((Math.random() - 0.5) * 520);

    layer.appendChild(piece);

    const anim = piece.animate(
      [
        {
          transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)',
          opacity: 1,
        },
        {
          transform: `translate(calc(-50% + ${peakX}px), calc(-50% + ${peakY}px)) scale(1.05) rotate(${rot * 0.5}deg)`,
          opacity: 1,
          offset: 0.42,
        },
        {
          transform: `translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) scale(0.65) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 720 + (i % 4) * 90,
        easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.15)',
        fill: 'forwards',
      }
    );

    anim.onfinish = () => {
      completed++;
      if (completed >= count) layer.remove();
    };
  }

  window.setTimeout(() => {
    if (layer.isConnected) layer.remove();
  }, 1300);
}

function getToastStack(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('[data-gm-candy-toasts]');
  if (existing) return existing;

  const stack = document.createElement('div');
  stack.className = 'gm-candy-toast-stack';
  stack.dataset.gmCandyToasts = 'true';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-atomic', 'false');
  document.body.appendChild(stack);
  return stack;
}

/**
 * Muestra una notificación flotante moderna con botón opcional de acción rápida.
 */
export function showCandyToast(options: CandyToastOptions): void {
  if (typeof document === 'undefined') return;
  const {
    message,
    tone = 'pink',
    actionLabel,
    onAction,
    durationMs = 3400,
  } = options;

  const stack = getToastStack();
  while (stack.children.length >= 2) {
    stack.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `gm-candy-toast gm-candy-toast--${tone}`;
  toast.setAttribute('role', 'status');

  const dot = document.createElement('span');
  dot.className = 'gm-candy-toast__dot';
  dot.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'gm-candy-toast__msg';
  text.textContent = message;

  toast.append(dot, text);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 240);
  };

  if (actionLabel && onAction) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'gm-candy-toast__btn';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    toast.appendChild(actionBtn);
  }

  stack.appendChild(toast);
  window.setTimeout(dismiss, durationMs);
}

/**
 * Aplica temporalmente una clase CSS de animación permitiendo re-dispararla.
 */
export function triggerSpringClass(
  el: HTMLElement | SVGElement | null | undefined,
  className = 'gm-spring-pop',
  durationMs = 480
): void {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove(className);
  // Forzar reflow para reiniciar la animación limpiamente
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
  window.setTimeout(() => {
    el.classList.remove(className);
  }, durationMs);
}

/**
 * Inicializa el observador de aparición suave al hacer scroll (`[data-reveal]`).
 */
export function initScrollReveal(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (targets.length === 0) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  document.documentElement.classList.add('gm-anim-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -28px 0px' }
  );

  for (const el of targets) {
    observer.observe(el);
  }
}
