// Contrato público de checkout-whatsapp e interfaz extensible IPaymentProvider.
import type { CartStateDTO } from './carrito.contract';

export type DeliveryMode = 'blue-express' | 'retiro';

export interface CustomerOrderDTO {
  nombre: string; correo: string; telefono?: string;
  entrega: DeliveryMode; direccion?: string; comuna?: string;
  region?: string; notas?: string; honeypot?: string;
}

export interface OrderResultDTO {
  folio: string; savedOnline: boolean;
  whatsappUrl: string; messageText: string;
}

export interface IPaymentProvider {
  readonly providerName: string;
  initiatePayment(order: CustomerOrderDTO, cart: CartStateDTO, folio: string): Promise<string>;
}
