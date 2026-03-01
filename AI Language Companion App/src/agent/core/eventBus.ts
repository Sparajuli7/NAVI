/**
 * NAVI Agent Framework — Event Bus
 *
 * Lightweight pub/sub for decoupled communication between agent modules.
 * No external dependencies. All modules emit and listen through this single bus.
 */

import type { AgentEvent, AgentEventType, AgentEventListener } from './types';

class EventBus {
  private listeners = new Map<AgentEventType, Set<AgentEventListener>>();
  private allListeners = new Set<AgentEventListener>();

  on(type: AgentEventType, listener: AgentEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /** Listen to all events (useful for logging/debugging) */
  onAll(listener: AgentEventListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  emit(type: AgentEventType, data: unknown): void {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[EventBus] Listener error for ${type}:`, err);
        }
      }
    }

    // Notify all-listeners
    for (const listener of this.allListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[EventBus] Global listener error:`, err);
      }
    }
  }

  /** Remove all listeners (for cleanup/testing) */
  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }
}

/** Singleton event bus for the agent framework */
export const agentBus = new EventBus();
