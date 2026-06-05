// Wave-2 — typed persistence boundary for InscapeSpace. Every implementation
// MUST run validateInscapeSpace on read and write; failure surfaces as a
// typed PersistenceError, never silently swallowed.

import type { InscapeSpace } from '../../domain/inscape-space.ts';
import type { InscapeSpaceValidationError } from '../../contracts/inscape-space-validator.ts';

export type PersistenceAdapterKind = 'in_memory' | 'indexeddb' | 'runtime_app_storage';

export type PersistenceError =
  | { kind: 'load_unsupported_environment'; adapter: PersistenceAdapterKind; reason: string }
  | { kind: 'load_open_failed'; adapter: PersistenceAdapterKind; cause: string }
  | { kind: 'load_read_failed'; adapter: PersistenceAdapterKind; cause: string }
  | { kind: 'load_invalid_snapshot'; adapter: PersistenceAdapterKind; validation_error: InscapeSpaceValidationError }
  | { kind: 'save_validation_failed'; adapter: PersistenceAdapterKind; validation_error: InscapeSpaceValidationError }
  | { kind: 'save_write_failed'; adapter: PersistenceAdapterKind; cause: string }
  | { kind: 'clear_failed'; adapter: PersistenceAdapterKind; cause: string };

export type LoadResult =
  | { ok: true; snapshot: InscapeSpace | null }
  | { ok: false; error: PersistenceError };

export type SaveResult =
  | { ok: true }
  | { ok: false; error: PersistenceError };

export type ClearResult =
  | { ok: true }
  | { ok: false; error: PersistenceError };

export interface PersistenceClient {
  readonly adapter_kind: PersistenceAdapterKind;
  load(): Promise<LoadResult>;
  save(snapshot: InscapeSpace): Promise<SaveResult>;
  clear(): Promise<ClearResult>;
}
