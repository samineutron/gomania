// Contrato público de gestion-datos (LSP: Google Sheets hoy, MySQL mañana).
import type { ProductDTO } from './catalogo.contract';
import type { CartStateDTO } from './carrito.contract';
import type { CustomerOrderDTO } from './checkout.contract';

export interface CreateOrderResponseDTO {
  ok: boolean;
  folio: string;
  error?: string;
}

export interface IInventoryRepository {
  fetchProducts(): Promise<ProductDTO[]>;
}

export interface IOrderRepository {
  createOrder(customer: CustomerOrderDTO, cart: CartStateDTO): Promise<CreateOrderResponseDTO>;
}
