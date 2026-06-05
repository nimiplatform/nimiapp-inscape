// Wave-2 — in-memory PersistenceClient used by tests and as the non-browser
// fallback. Every load / save still runs validateInscapeSpace.

import type { InscapeSpace } from '../../domain/inscape-space.ts';
import { validateInscapeSpace } from '../../contracts/inscape-space-validator.ts';
import type {
  ClearResult,
  LoadResult,
  PersistenceClient,
  SaveResult,
} from './persistence-client.ts';

export class InMemoryPersistenceAdapter implements PersistenceClient {
  readonly adapter_kind = 'in_memory' as const;
  private stored: InscapeSpace | null;

  constructor(initial: InscapeSpace | null = null) {
    this.stored = initial;
  }

  async load(): Promise<LoadResult> {
    if (this.stored === null) return { ok: true, snapshot: null };
    const validation = validateInscapeSpace(this.stored);
    if (!validation.ok) {
      return {
        ok: false,
        error: { kind: 'load_invalid_snapshot', adapter: 'in_memory', validation_error: validation.error },
      };
    }
    return { ok: true, snapshot: this.stored };
  }

  async save(snapshot: InscapeSpace): Promise<SaveResult> {
    const validation = validateInscapeSpace(snapshot);
    if (!validation.ok) {
      return {
        ok: false,
        error: { kind: 'save_validation_failed', adapter: 'in_memory', validation_error: validation.error },
      };
    }
    this.stored = snapshot;
    return { ok: true };
  }

  async clear(): Promise<ClearResult> {
    this.stored = null;
    return { ok: true };
  }

  /** Test affordance: read raw stored snapshot bypass-free. */
  peek(): InscapeSpace | null {
    return this.stored;
  }
}
