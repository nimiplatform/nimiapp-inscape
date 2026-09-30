import type { InscapeLoadReply } from '../../../src-electron/persistence.ts';
import { invoke, toShellBridgeNimiError } from '@nimiplatform/kit/shell/renderer/bridge';
import { validateInscapeSpace } from '../../contracts/inscape-space-validator.ts';
import type { InscapeSpace } from '../../domain/inscape-space.ts';
import type { ClearResult, LoadResult, PersistenceClient, SaveResult } from '../../product/persistence/persistence-client.ts';

export class SqlitePersistenceAdapter implements PersistenceClient {
  readonly adapter_kind = 'local_sqlite' as const;

  async load(): Promise<LoadResult> {
    let raw: string | null;
    try {
      const reply = await invokeCommand<InscapeLoadReply>('inscape_space_load');
      if (reply.kind === 'schema_incompatible') return { ok: false, error: {
        kind: 'load_incompatible_version', adapter: this.adapter_kind,
        storedVersion: reply.storedVersion, expectedVersion: reply.expectedVersion,
      } };
      if (reply.kind !== 'loaded' && reply.kind !== 'quarantine_pending') throw new Error('Invalid Inscape load response');
      raw = reply.snapshotJson;
      if (reply.kind === 'quarantine_pending') {
        const pending: InscapeSpace = JSON.parse(raw!);
        const checked = validateInscapeSpace(pending);
        if (!checked.ok) return { ok: false, error: { kind: 'load_invalid_snapshot', adapter: this.adapter_kind, validation_error: checked.error } };
        return { ok: true, snapshot: null, pendingQuarantine: pending };
      }
    } catch (cause) {
      return { ok: false, error: { kind: 'load_read_failed', adapter: this.adapter_kind, cause: errorMessage(cause) } };
    }
    if (raw === null) return { ok: true, snapshot: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return { ok: false, error: { kind: 'load_read_failed', adapter: this.adapter_kind, cause: `stored JSON parse failed: ${errorMessage(cause)}` } };
    }
    const validation = validateInscapeSpace(parsed as InscapeSpace);
    if (!validation.ok) return { ok: false, error: { kind: 'load_invalid_snapshot', adapter: this.adapter_kind, validation_error: validation.error } };
    return { ok: true, snapshot: parsed as InscapeSpace };
  }

  async save(snapshot: InscapeSpace, options: { confirmedQuarantine?: boolean } = {}): Promise<SaveResult> {
    const validation = validateInscapeSpace(snapshot);
    if (!validation.ok) return { ok: false, error: { kind: 'save_validation_failed', adapter: this.adapter_kind, validation_error: validation.error } };
    try {
      await invokeCommand('inscape_space_save', {
        snapshotJson: JSON.stringify(snapshot),
          attestedAdult: snapshot.attested_adult,
          confirmedQuarantine: options.confirmedQuarantine === true,
      });
      return { ok: true };
    } catch (cause) {
      return { ok: false, error: { kind: 'save_write_failed', adapter: this.adapter_kind, cause: errorMessage(cause) } };
    }
  }

  async clear(): Promise<ClearResult> {
    try {
      await invokeCommand('inscape_space_clear');
      return { ok: true };
    } catch (cause) {
      return { ok: false, error: { kind: 'clear_failed', adapter: this.adapter_kind, cause: errorMessage(cause) } };
    }
  }
}

async function invokeCommand<T = void>(command: string, payload: Record<string, string | boolean> = {}): Promise<T> {
  try {
    return await invoke(command, payload) as T;
  } catch (error) {
    throw toShellBridgeNimiError(error);
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause || 'unknown error');
}
