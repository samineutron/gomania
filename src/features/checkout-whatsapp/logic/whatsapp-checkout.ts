/**
 * ============================================================================
 * QUÉ HACE:
 * Lógica pura de validación, armado de mensaje WhatsApp e implementación de
 * `IPaymentProvider` para el módulo `checkout-whatsapp`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa contratos de `src/contracts/checkout.contract.ts`.
 * - Usa `SOCIAL_LINKS`, `BUSINESS_RULES` y `formatClp` desde `src/shared/config.ts`.
 * - Registra pedidos opcionalmente vía `orderRepository` (`src/features/gestion-datos`).
 * ============================================================================
 */
import type { CartStateDTO } from '../../../contracts/carrito.contract';
import type {
  CustomerOrderDTO,
  IPaymentProvider,
  OrderResultDTO,
} from '../../../contracts/checkout.contract';
import type { BagSizeId, MixProfile } from '../../../contracts/mix-builder.contract';
import { BUSINESS_RULES, SOCIAL_LINKS, formatClp } from '../../../shared/config';
import { orderRepository } from '../../gestion-datos';

export interface SimpleCheckoutFormInput {
  nombre: string;
  correo: string;
  direccion: string;
  honeypot?: string;
}

export interface CheckoutFormErrors {
  nombre?: string;
  correo?: string;
  direccion?: string;
}

const PROFILE_LABELS: Record<MixProfile, string> = {
  'dulce-acido': 'Dulce / Ácido',
  salado: 'Salado',
  libre: 'Individual 80 g',
};

const TIER_LABELS: Record<BagSizeId, string> = {
  '80g': '80 g',
  '500g': '500 g',
  '1kg': '1 kg',
  '2kg': '2 kg',
  '3kg': '3 kg',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida los 3 campos obligatorios del formulario flotante de checkout.
 */
export function validateCheckoutForm(input: SimpleCheckoutFormInput): {
  valid: boolean;
  errors: CheckoutFormErrors;
  cleaned: SimpleCheckoutFormInput;
} {
  const nombre = input.nombre.trim().replace(/\s+/g, ' ');
  const correo = input.correo.trim();
  const direccion = input.direccion.trim().replace(/\s+/g, ' ');
  const honeypot = (input.honeypot ?? '').trim();

  const errors: CheckoutFormErrors = {};

  if (nombre.length < 3) {
    errors.nombre = 'Ingresa tu nombre y apellido.';
  }

  if (!EMAIL_REGEX.test(correo)) {
    errors.correo = 'Ingresa un correo electrónico válido.';
  }

  if (direccion.length < 6) {
    errors.direccion = 'Ingresa la dirección completa de tu domicilio.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    cleaned: { nombre, correo, direccion, honeypot },
  };
}

/**
 * Construye el mensaje completo para enviar el pedido por WhatsApp,
 * incluyendo los datos del cliente, el detalle de bolsas/sabores y la
 * nota de seguimiento por correo y WhatsApp.
 */
export function buildWhatsAppOrderMessage(
  customer: CustomerOrderDTO,
  cart: CartStateDTO,
  folio?: string
): string {
  const lines: string[] = [
    '¡Hola GoManía! Quiero finalizar mi compra:',
  ];

  if (folio && folio.trim() !== '') {
    lines.push(`N° de pedido: ${folio.trim()}`);
  }

  lines.push(
    '',
    '*Datos del cliente*',
    `• Nombre y apellido: ${customer.nombre}`,
    `• Correo electrónico: ${customer.correo}`,
    `• Dirección de domicilio: ${customer.direccion || 'Por confirmar'}`,
    '',
    '*Detalle del pedido*'
  );

  cart.entries.forEach((entry, index) => {
    const { item, quantity } = entry;
    const bagType = item.tierId === '80g' ? 'Bolsita' : 'Mix';
    const tierLabel = TIER_LABELS[item.tierId] ?? item.tierId;
    const profileLabel = PROFILE_LABELS[item.profile] ?? item.profile;
    const lineTotal = formatClp(item.priceClp * quantity);

    lines.push(
      `${index + 1}. ${quantity}× ${bagType} ${tierLabel} (${profileLabel}) — ${lineTotal}`
    );

    item.flavors.forEach((flavor) => {
      lines.push(`   - ${flavor.nombre} (${flavor.grams} g)`);
    });
  });

  lines.push(
    '',
    `*Total productos:* ${formatClp(cart.totalClp)} (${cart.totalItems} ${cart.totalItems === 1 ? 'bolsa' : 'bolsas'})`,
    `*Envío:* ${BUSINESS_RULES.shippingNote}`,
    '',
    `Al finalizar la compra por aquí, por favor enviar el código de seguimiento a mi correo (${customer.correo}) y a este WhatsApp para revisar el estado de mi pedido.`
  );

  return lines.join('\n');
}

/**
 * Genera el enlace `https://wa.me/...` sanitizando el número de destino.
 */
export function buildWhatsAppUrl(
  messageText: string,
  whatsappNumber: string = SOCIAL_LINKS.whatsappNumber
): string {
  const digits = whatsappNumber.replace(/\D/g, '');
  const encodedText = encodeURIComponent(messageText);
  return digits
    ? `https://wa.me/${digits}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Adaptador concreto de `IPaymentProvider` para el flujo por WhatsApp.
 */
export class WhatsAppPaymentAdapter implements IPaymentProvider {
  readonly providerName = 'whatsapp';

  async initiatePayment(
    order: CustomerOrderDTO,
    cart: CartStateDTO,
    folio: string
  ): Promise<string> {
    const messageText = buildWhatsAppOrderMessage(order, cart, folio);
    return buildWhatsAppUrl(messageText);
  }
}

const defaultPaymentProvider = new WhatsAppPaymentAdapter();

/**
 * Registra el pedido en el backend si está disponible (sin bloquear la venta si
 * falla) y retorna el resultado con el enlace y texto de WhatsApp listos.
 */
export async function submitWhatsAppOrder(
  input: SimpleCheckoutFormInput,
  cart: CartStateDTO
): Promise<OrderResultDTO> {
  const customer: CustomerOrderDTO = {
    nombre: input.nombre,
    correo: input.correo,
    entrega: 'blue-express',
    direccion: input.direccion,
    honeypot: input.honeypot,
  };

  let folio = '';
  let savedOnline = false;

  try {
    const response = await orderRepository.createOrder(customer, cart);
    if (response.ok) {
      folio = response.folio;
      savedOnline = true;
    }
  } catch {
    // Respaldo directo por WhatsApp si el proxy no responde
  }

  const messageText = buildWhatsAppOrderMessage(customer, cart, folio);
  const whatsappUrl = await defaultPaymentProvider.initiatePayment(
    customer,
    cart,
    folio
  );

  return {
    folio,
    savedOnline,
    whatsappUrl,
    messageText,
  };
}
