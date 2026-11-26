/**
 * ============================================================================
 * QUÉ HACE:
 * Implementa el bus de eventos tipado (`IEventBus`) que comunica los módulos
 * desacoplados en el navegador sin que se importen entre sí (principios OCP/DIP).
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Normalmente NO necesitas editar este archivo.
 * - Si algún día agregas un evento nuevo, decláralo primero en
 *   `src/contracts/events.contract.ts`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa `IEventBus` y `AppEvents` desde `src/contracts/events.contract.ts`.
 * - Usado por `landing-shell`, `catalogo`, `mix-builder`, `carrito` y
 *   `checkout-whatsapp`.
 * ============================================================================
 */
import type { AppEvents, IEventBus } from '../contracts/events.contract';

type EventHandler<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

/**
 * Crea una instancia independiente del EventBus en memoria.
 * Útil tanto para el singleton global del navegador como para pruebas aisladas.
 */
export function createEventBus(): IEventBus {
  const listeners = new Map<keyof AppEvents, Set<EventHandler<keyof AppEvents>>>();

  return {
    /**
     * Emite un evento tipado a todos los módulos suscritos.
     * Cada listener corre protegido en try/catch para que un error aislado
     * no bloquee al resto de módulos escuchando el mismo evento.
     */
    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
      const handlers = listeners.get(event);
      if (!handlers || handlers.size === 0) return;

      handlers.forEach((handler) => {
        try {
          (handler as EventHandler<K>)(payload);
        } catch (error) {
          console.error(`[EventBus] Error en listener de "${String(event)}":`, error);
        }
      });
    },

    /**
     * Suscribe una función a un evento específico.
     * Retorna una función `unsubscribe()` para limpiar la suscripción.
     */
    on<K extends keyof AppEvents>(event: K, fn: EventHandler<K>): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      const handlers = listeners.get(event)!;
      handlers.add(fn as EventHandler<keyof AppEvents>);

      return () => {
        handlers.delete(fn as EventHandler<keyof AppEvents>);
      };
    },
  };
}

/**
 * Instancia única (singleton) compartida por todos los scripts cliente en la página.
 * Se guarda en `globalThis` para garantizar que distintas islas de Astro
 * compartan exactamente el mismo bus de eventos.
 */
const GLOBAL_BUS_KEY = '__GOMANIA_EVENT_BUS__';

function getSharedEventBus(): IEventBus {
  const scope = globalThis as Record<string, unknown>;
  if (!scope[GLOBAL_BUS_KEY]) {
    scope[GLOBAL_BUS_KEY] = createEventBus();
  }
  return scope[GLOBAL_BUS_KEY] as IEventBus;
}

export const eventBus: IEventBus = getSharedEventBus();
