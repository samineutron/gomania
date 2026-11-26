// Contrato público del módulo carrito (gestión y validación de stock).
import type { MixItemDTO } from './mix-builder.contract';

export interface CartEntryDTO {
  item: MixItemDTO;
  quantity: number;
}

export interface CartStateDTO {
  entries: CartEntryDTO[];
  totalItems: number;
  totalClp: number;
}

export interface ICarritoService {
  getState(): CartStateDTO;
  upsertItem(item: MixItemDTO, isEdit?: boolean): CartStateDTO;
  removeItem(uid: string): CartStateDTO;
  getUsedGramsByProduct(): Record<string, number>;
  clear(): void;
}
