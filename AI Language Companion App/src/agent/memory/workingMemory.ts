/**
 * NAVI Agent Framework — Working Memory (Ring Buffer)
 *
 * Short-term memory that holds the current conversation context.
 * Implemented as a fixed-size ring buffer that automatically evicts
 * the oldest entries when full. Slots can have TTLs for auto-expiry.
 *
 * Design decision: Ring buffer instead of growing array.
 * On a phone, memory pressure is real. A ring buffer guarantees
 * a fixed memory footprint regardless of conversation length.
 * The size is tunable per energy mode.
 */

import type { WorkingMemorySlot } from '../core/types';

const DEFAULT_CAPACITY = 32;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class WorkingMemory {
  private buffer: (WorkingMemorySlot | null)[];
  private head = 0;
  private _size = 0;
  private capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /** Add or update a slot in working memory */
  set(key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
    // Check if key already exists — update in place
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head - this._size + i + this.capacity) % this.capacity;
      const slot = this.buffer[idx];
      if (slot && slot.key === key) {
        this.buffer[idx] = { key, value, updatedAt: Date.now(), ttlMs };
        return;
      }
    }

    // New entry — add to ring buffer
    this.buffer[this.head] = {
      key,
      value,
      updatedAt: Date.now(),
      ttlMs,
    };
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) this._size++;
  }

  /** Get a slot by key, returns undefined if not found or expired */
  get(key: string): unknown | undefined {
    this.evictExpired();
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head - this._size + i + this.capacity) % this.capacity;
      const slot = this.buffer[idx];
      if (slot && slot.key === key) {
        return slot.value;
      }
    }
    return undefined;
  }

  /** Get all active (non-expired) slots */
  getAll(): WorkingMemorySlot[] {
    this.evictExpired();
    const slots: WorkingMemorySlot[] = [];
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head - this._size + i + this.capacity) % this.capacity;
      const slot = this.buffer[idx];
      if (slot) slots.push(slot);
    }
    return slots;
  }

  /** Remove a specific key */
  remove(key: string): boolean {
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head - this._size + i + this.capacity) % this.capacity;
      const slot = this.buffer[idx];
      if (slot && slot.key === key) {
        this.buffer[idx] = null;
        return true;
      }
    }
    return false;
  }

  /** Check if a key exists and is not expired */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Get current number of active slots */
  get size(): number {
    this.evictExpired();
    return this.buffer.filter((s) => s !== null).length;
  }

  /** Serialize for persistence (on app background/close) */
  serialize(): WorkingMemorySlot[] {
    return this.getAll();
  }

  /** Restore from serialized data */
  restore(slots: WorkingMemorySlot[]): void {
    this.clear();
    for (const slot of slots) {
      this.set(slot.key, slot.value, slot.ttlMs);
    }
  }

  /** Clear all slots */
  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this._size = 0;
  }

  /** Resize the buffer (for energy mode changes) */
  resize(newCapacity: number): void {
    const current = this.getAll();
    this.capacity = newCapacity;
    this.buffer = new Array(newCapacity).fill(null);
    this.head = 0;
    this._size = 0;
    // Re-add items, newest first up to new capacity
    const toRestore = current.slice(-newCapacity);
    for (const slot of toRestore) {
      this.set(slot.key, slot.value, slot.ttlMs);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (let i = 0; i < this.buffer.length; i++) {
      const slot = this.buffer[i];
      if (slot && now - slot.updatedAt > slot.ttlMs) {
        this.buffer[i] = null;
      }
    }
  }
}
