/**
 * In-process event bus for bridging core engine events to SSE clients.
 * Singleton pattern — all API routes and engine hooks share one bus.
 */

export type EventListener = (event: BusEvent) => void;

export interface BusEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

class EventBus {
  private listeners = new Set<EventListener>();

  /** Subscribe to all events. Returns an unsubscribe function. */
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Publish an event to all subscribers */
  emit(type: string, payload: Record<string, unknown> = {}): void {
    const event: BusEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    }
  }

  /** Current subscriber count (useful for monitoring) */
  get subscriberCount(): number {
    return this.listeners.size;
  }
}

/** Global singleton event bus */
export const eventBus = new EventBus();
