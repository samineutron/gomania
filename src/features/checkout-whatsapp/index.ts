/**
 * ============================================================================
 * QUÉ HACE:
 * Fachada pública del módulo `checkout-whatsapp`.
 * ============================================================================
 */
export {
  WhatsAppPaymentAdapter,
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  submitWhatsAppOrder,
  validateCheckoutForm,
  type CheckoutFormErrors,
  type SimpleCheckoutFormInput,
} from './logic/whatsapp-checkout';
