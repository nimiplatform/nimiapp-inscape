// Runtime-owned app storage persistence adapter for InscapeSpace, backed by
// the app's own SQLite seam (G1 = keep locked SQLite). The Tauri commands
// (inscape_space_load/save/clear) open <data_root>/inscape.db with 0o600 and a
// CHECK (attested_adult = 1) gate; this adapter resolves the runtime data root
// and runs validateInscapeSpace on every read and write.

import { getPlatformClient, type PlatformClient } from '@nimiplatform/sdk';
import { resolveRuntimeAppStorageRoots } from '@nimiplatform/sdk/runtime';
import {
  invoke,
  toShellBridgeNimiError,
} from '@nimiplatform/kit/shell/renderer/bridge';
import { validateInscapeSpace } from '../../contracts/inscape-space-validator.ts';
import { INSCAPE_APP_ID } from '../../contracts/app-identity.ts';
import type { InscapeSpace } from '../../domain/inscape-space.ts';
import type {
  ClearResult,
  LoadResult,
  PersistenceClient,
  SaveResult,
} from '../../product/persistence/persistence-client.ts';

const STORAGE_LABEL = 'inscape app';

export interface RuntimeAppStoragePersistenceAdapterOptions {
  readonly getPlatformClient?: () => PlatformClient;
}

export class RuntimeAppStoragePersistenceAdapter implements PersistenceClient {
  readonly adapter_kind = 'runtime_app_storage' as const;
  private readonly getClient: () => PlatformClient;

  constructor(options: RuntimeAppStoragePersistenceAdapterOptions = {}) {
    this.getClient = options.getPlatformClient ?? (() => getPlatformClient());
  }

  async load(): Promise<LoadResult> {
    let root: string;
    try {
      root = await this.dataRoot();
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'load_open_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
    let raw: string | null | undefined;
    try {
      raw = await invokeInscapeCommand<string | null | undefined>('inscape_space_load', {
        payload: { storageRoot: root },
      });
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'load_read_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
    if (raw === null || raw === undefined) return { ok: true, snapshot: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'load_read_failed',
          adapter: this.adapter_kind,
          cause: `stored JSON parse failed: ${errorMessage(cause)}`,
        },
      };
    }
    const validation = validateInscapeSpace(parsed as InscapeSpace);
    if (!validation.ok) {
      return {
        ok: false,
        error: {
          kind: 'load_invalid_snapshot',
          adapter: this.adapter_kind,
          validation_error: validation.error,
        },
      };
    }
    return { ok: true, snapshot: parsed as InscapeSpace };
  }

  async save(snapshot: InscapeSpace): Promise<SaveResult> {
    const validation = validateInscapeSpace(snapshot);
    if (!validation.ok) {
      return {
        ok: false,
        error: {
          kind: 'save_validation_failed',
          adapter: this.adapter_kind,
          validation_error: validation.error,
        },
      };
    }
    let root: string;
    try {
      root = await this.dataRoot();
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'save_write_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
    try {
      await invokeInscapeCommand('inscape_space_save', {
        payload: {
          storageRoot: root,
          snapshotJson: JSON.stringify(snapshot),
          attestedAdult: snapshot.attested_adult,
        },
      });
      return { ok: true };
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'save_write_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
  }

  async clear(): Promise<ClearResult> {
    let root: string;
    try {
      root = await this.dataRoot();
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'clear_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
    try {
      await invokeInscapeCommand('inscape_space_clear', { payload: { storageRoot: root } });
      return { ok: true };
    } catch (cause) {
      return {
        ok: false,
        error: {
          kind: 'clear_failed',
          adapter: this.adapter_kind,
          cause: errorMessage(cause),
        },
      };
    }
  }

  private async dataRoot(): Promise<string> {
    const client = this.getClient();
    await client.runtime.ready();
    const roots = await resolveRuntimeAppStorageRoots({
      appLifecycle: client.runtime.appLifecycle,
      appId: INSCAPE_APP_ID,
      label: STORAGE_LABEL,
    });
    return roots.dataRoot;
  }
}

async function invokeInscapeCommand<T = void>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke(command, args ?? {}) as T;
  } catch (error) {
    throw toShellBridgeNimiError(error);
  }
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  return String(cause || 'unknown error');
}
