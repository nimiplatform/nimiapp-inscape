import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';
import { validateInscapeSpace } from '../../contracts/inscape-space-validator.ts';
import type { InscapeSpace } from '../../domain/inscape-space.ts';
import type {
  ClearResult,
  LoadResult,
  PersistenceClient,
  SaveResult,
} from '../../product/persistence/persistence-client.ts';

export const INSCAPE_SPACE_STORAGE_PATH = 'product/inscape-space.json';
export const INSCAPE_QUARANTINE_PENDING_STORAGE_PATH = 'product/inscape-quarantine-pending.json';
const EXPECTED_SCHEMA_VERSION = 3;

export type InscapeStorageScope = {
  readonly client: Pick<NimiAppScope['client'], 'storage'>;
  readonly signal: AbortSignal;
};

type StorageErrorLike = {
  readonly code?: unknown;
  readonly reasonCode?: unknown;
  readonly message?: unknown;
};

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as StorageErrorLike;
  return (
    candidate.code === 'not-found' ||
    candidate.reasonCode === 'APP_STORAGE_ENTRY_NOT_FOUND' ||
    candidate.reasonCode === 'APP_ASSET_NOT_FOUND' ||
    candidate.reasonCode === 'NOT_FOUND'
  );
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && typeof (cause as StorageErrorLike).message === 'string') {
    const candidate = cause as StorageErrorLike;
    const prefix = typeof candidate.reasonCode === 'string' && candidate.reasonCode ? `${candidate.reasonCode}: ` : '';
    return `${prefix}${candidate.message}`;
  }
  return String(cause || 'unknown error');
}

function hasSelfQuarantineRecord(space: InscapeSpace): boolean {
  return space.quarantine.some((record) => {
    try {
      const parsed = JSON.parse(record.payload_json) as { subject?: { kind?: unknown } };
      return parsed.subject?.kind === 'self';
    } catch {
      return false;
    }
  });
}

// @nimi-authority: rule.inscape.data-model.r004
// @nimi-authority: rule.inscape.data-model.r006
export class RuntimeStoragePersistenceAdapter implements PersistenceClient {
  readonly adapter_kind = 'nimi_storage' as const;
  private readonly scope: InscapeStorageScope;
  private readonly spacePath: string;
  private readonly pendingPath: string;

  constructor(
    scope: InscapeStorageScope,
    options: { spacePath?: string; pendingPath?: string } = {},
  ) {
    this.scope = scope;
    this.spacePath = options.spacePath ?? INSCAPE_SPACE_STORAGE_PATH;
    this.pendingPath = options.pendingPath ?? INSCAPE_QUARANTINE_PENDING_STORAGE_PATH;
  }

  private async readJsonAsset(relativePath: string): Promise<{ found: false } | { found: true; raw: string }> {
    this.scope.signal.throwIfAborted();
    try {
      const result = await this.scope.client.storage.assets.read({ relativePath });
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let raw = '';
      for await (const chunk of result.body) {
        this.scope.signal.throwIfAborted();
        raw += decoder.decode(chunk, { stream: true });
      }
      this.scope.signal.throwIfAborted();
      raw += decoder.decode();
      return { found: true, raw };
    } catch (error) {
      if (!this.scope.signal.aborted && isNotFoundError(error)) {
        return { found: false };
      }
      throw error;
    }
  }

  private async writeJsonAsset(relativePath: string, payload: string): Promise<void> {
    this.scope.signal.throwIfAborted();
    await this.scope.client.storage.assets.write({
      relativePath,
      body: new TextEncoder().encode(payload),
      mediaType: 'application/json',
      overwrite: true,
    });
    this.scope.signal.throwIfAborted();
  }

  private async removeAssetIfPresent(relativePath: string): Promise<void> {
    this.scope.signal.throwIfAborted();
    try {
      await this.scope.client.storage.assets.remove(relativePath);
    } catch (error) {
      if (!this.scope.signal.aborted && isNotFoundError(error)) return;
      throw error;
    }
    this.scope.signal.throwIfAborted();
  }

  async load(): Promise<LoadResult> {
    try {
      const pending = await this.readJsonAsset(this.pendingPath);
      if (pending.found) {
        let parsedPending: unknown;
        try {
          parsedPending = JSON.parse(pending.raw);
        } catch (cause) {
          return {
            ok: false,
            error: {
              kind: 'load_read_failed',
              adapter: this.adapter_kind,
              cause: `pending quarantine JSON parse failed: ${errorMessage(cause)}`,
            },
          };
        }
        const checked = validateInscapeSpace(parsedPending as InscapeSpace);
        if (!checked.ok) {
          return {
            ok: false,
            error: {
              kind: 'load_invalid_snapshot',
              adapter: this.adapter_kind,
              validation_error: checked.error,
            },
          };
        }
        return { ok: true, snapshot: null, pendingQuarantine: parsedPending as InscapeSpace };
      }

      const stored = await this.readJsonAsset(this.spacePath);
      if (!stored.found) return { ok: true, snapshot: null };

      let parsed: unknown;
      try {
        parsed = JSON.parse(stored.raw);
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
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        typeof (parsed as { schema_version?: unknown }).schema_version === 'number' &&
        (parsed as { schema_version: number }).schema_version !== EXPECTED_SCHEMA_VERSION
      ) {
        return {
          ok: false,
          error: {
            kind: 'load_incompatible_version',
            adapter: this.adapter_kind,
            storedVersion: (parsed as { schema_version: number }).schema_version,
            expectedVersion: EXPECTED_SCHEMA_VERSION,
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
  }

  async save(
    snapshot: InscapeSpace,
    options: { confirmedQuarantine?: boolean } = {},
  ): Promise<SaveResult> {
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

    if (
      snapshot.attested_adult !== true ||
      (snapshot.self_subject && snapshot.self_subject.age_attestation.attested_adult !== true)
    ) {
      return {
        ok: false,
        error: {
          kind: 'save_write_failed',
          adapter: this.adapter_kind,
          cause: 'inscape space save refused: adult attestation required',
        },
      };
    }

    if (!snapshot.self_subject) {
      if (
        snapshot.other_subjects.length > 0 ||
        snapshot.relationships.length > 0 ||
        snapshot.readings.length > 0
      ) {
        return {
          ok: false,
          error: {
            kind: 'save_write_failed',
            adapter: this.adapter_kind,
            cause: 'quarantined space cannot contain active material',
          },
        };
      }
      if (!hasSelfQuarantineRecord(snapshot)) {
        return {
          ok: false,
          error: {
            kind: 'save_write_failed',
            adapter: this.adapter_kind,
            cause: 'self quarantine material required',
          },
        };
      }
    }

    const serialized = JSON.stringify(snapshot);
    try {
      if (options.confirmedQuarantine) {
        if (snapshot.quarantine.length === 0) {
          throw new Error('confirmed quarantine material required');
        }
        await this.writeJsonAsset(this.pendingPath, serialized);
      } else {
        const pending = await this.readJsonAsset(this.pendingPath);
        if (pending.found) {
          throw new Error('pending quarantine must be recovered before ordinary writes');
        }
        const existing = await this.readJsonAsset(this.spacePath);
        if (existing.found) {
          const parsedExisting = JSON.parse(existing.raw) as { self_subject?: unknown };
          if (parsedExisting.self_subject === null && snapshot.self_subject !== null) {
            throw new Error('quarantined Inscape space requires explicit clear');
          }
        }
      }

      await this.writeJsonAsset(this.spacePath, serialized);
      if (options.confirmedQuarantine) {
        await this.removeAssetIfPresent(this.pendingPath);
      }
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
    try {
      await this.removeAssetIfPresent(this.spacePath);
      await this.removeAssetIfPresent(this.pendingPath);
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
}
