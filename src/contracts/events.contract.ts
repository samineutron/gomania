// Contrato global del EventBus desacoplado (OCP / DIP).
import type { MixContextDTO, MixItemDTO } from './mix-builder.contract';

export interface AppEvents {
  'catalogo:saborSeleccionado': { productId: string };
  'mix:contextoActualizado': MixContextDTO;
  'mix:agregadoAlCarrito': { item: MixItemDTO; isEdit: boolean };
  'carrito:editarItem': { item: MixItemDTO };
  'carrito:actualizado': { totalItems: number; totalClp: number };
  'carrito:abrirDrawer': { open: boolean };
  'checkout:pedidoCompletado': { folio: string };
}

export interface IEventBus {
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void;
  on<K extends keyof AppEvents>(event: K, fn: (payload: AppEvents[K]) => void): () => void;
}
