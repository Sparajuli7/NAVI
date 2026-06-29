/**
 * Database factory — returns the active IDatabase implementation.
 *
 * Default: LocalDatabase (IndexedDB, no account needed).
 * After login: CloudDatabase (dual-write: IndexedDB + Supabase).
 *
 * To swap to a different cloud backend (Neon, PlanetScale, etc.):
 * - Implement IDatabase in src/db/cloud/myNewBackend.ts
 * - Call setDatabase(new MyNewDatabase(userId)) in src/auth/useAuth.ts
 * - No other code changes required.
 */

import type { IDatabase } from './types';
import { LocalDatabase } from './local';

let _db: IDatabase = new LocalDatabase();

/** Returns the currently active database implementation. */
export function getDatabase(): IDatabase {
  return _db;
}

/** Swap the active database implementation (called on login/logout). */
export function setDatabase(db: IDatabase): void {
  _db = db;
}

/** Reset to local-only mode (called on logout). */
export function resetToLocal(): void {
  _db = new LocalDatabase();
}

export type { IDatabase } from './types';
