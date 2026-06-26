// Inscape AIConfig storage for the text.generate surface. Generic SDK config
// store (browser local storage), scoped to nimi.inscape / inscape.session.
// The model binding is populated from runtime first-run evidence by
// inscape-ai-config-bootstrap.ts. The model-config UI surface + AIProfile
// library land in a later wave.

import {
  areNimiAIScopeRefsEqual,
  createNimiAIConfigStore,
  createNimiAppAIScopeRef,
  encodeNimiAIScopeRef,
  validateNimiAIConfig,
  type NimiAIConfig,
  type NimiAIHostStorage,
  type NimiAIScopeRef,
} from '@nimiplatform/sdk/ai';
import { resolveBrowserStorage } from '@nimiplatform/kit/core/storage-json';
import { INSCAPE_APP_ID } from '../../contracts/app-identity.ts';

export const INSCAPE_AI_SURFACE_ID = 'inscape.session';
export const INSCAPE_AI_CONFIG_STORAGE_KEY = 'nimiapp-inscape:session-ai-config:v1';
export const INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY = 'nimi:ai-config:index';
export const INSCAPE_AI_CONFIG_QUARANTINE_PREFIX = `${INSCAPE_AI_CONFIG_STORAGE_KEY}:quarantine:`;

export type InscapeAIConfigStorageRepairResult = {
  readonly scanned: number;
  readonly quarantined: number;
  readonly removedScopeKeys: readonly string[];
  readonly quarantineKeys: readonly string[];
};

type InscapeAIConfigStorageRepairOptions = {
  readonly now?: () => string;
};

function getStorage(): Storage | null {
  return resolveBrowserStorage('local');
}

function useEphemeralStore(): boolean {
  return typeof window === 'undefined';
}

const aiConfigStore = createNimiAIConfigStore({
  storage: () => getStorage() as NimiAIHostStorage | null,
  configKeyForScope: () => INSCAPE_AI_CONFIG_STORAGE_KEY,
  enableEphemeralStore: useEphemeralStore(),
});

export function createInscapeAIScopeRef(): NimiAIScopeRef {
  return createNimiAppAIScopeRef(INSCAPE_APP_ID, INSCAPE_AI_SURFACE_ID);
}

function removeStorageItem(storage: NimiAIHostStorage, key: string): void {
  if (storage.removeItem) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, '');
}

function readScopeIndex(storage: NimiAIHostStorage): string[] {
  const raw = storage.getItem(INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function removeScopeKeyFromIndex(storage: NimiAIHostStorage, scopeKey: string): void {
  const next = readScopeIndex(storage).filter((entry) => entry !== scopeKey);
  storage.setItem(INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY, JSON.stringify([...new Set(next)].sort()));
}

function uniqueQuarantineKey(storage: NimiAIHostStorage, scopeKey: string, quarantinedAt: string): string {
  const base = `${INSCAPE_AI_CONFIG_QUARANTINE_PREFIX}${encodeURIComponent(scopeKey)}:${encodeURIComponent(quarantinedAt)}`;
  let candidate = base;
  let index = 1;
  while (storage.getItem(candidate) !== null) {
    candidate = `${base}:${index}`;
    index += 1;
  }
  return candidate;
}

function storedAIConfigInvalidReason(raw: string, scopeRef: NimiAIScopeRef): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return error instanceof Error ? error.message : String(error || 'Invalid stored AIConfig JSON.');
  }
  const validation = validateNimiAIConfig(parsed);
  if (!validation.valid) {
    return validation.errors.join('; ');
  }
  const config = parsed as NimiAIConfig;
  if (!areNimiAIScopeRefsEqual(config.scopeRef, scopeRef)) {
    return 'Stored AIConfig scopeRef does not match Inscape scopeRef.';
  }
  return null;
}

export function repairInscapeAIConfigStorageForScope(
  scopeRef: NimiAIScopeRef = createInscapeAIScopeRef(),
  storage: NimiAIHostStorage | null = getStorage() as NimiAIHostStorage | null,
  options: InscapeAIConfigStorageRepairOptions = {},
): InscapeAIConfigStorageRepairResult {
  if (!storage) {
    return { scanned: 0, quarantined: 0, removedScopeKeys: [], quarantineKeys: [] };
  }
  const scopeKey = encodeNimiAIScopeRef(scopeRef);
  const raw = storage.getItem(INSCAPE_AI_CONFIG_STORAGE_KEY);
  if (!raw) {
    removeScopeKeyFromIndex(storage, scopeKey);
    return { scanned: 0, quarantined: 0, removedScopeKeys: [], quarantineKeys: [] };
  }
  const reason = storedAIConfigInvalidReason(raw, scopeRef);
  if (!reason) {
    return { scanned: 1, quarantined: 0, removedScopeKeys: [], quarantineKeys: [] };
  }

  const quarantinedAt = options.now?.() ?? new Date().toISOString();
  const quarantineKey = uniqueQuarantineKey(storage, scopeKey, quarantinedAt);
  storage.setItem(quarantineKey, JSON.stringify({
    schemaVersion: 1,
    reasonCode: 'INSCAPE_AI_CONFIG_STORE_INVALID',
    reason,
    scopeKey,
    originalKey: INSCAPE_AI_CONFIG_STORAGE_KEY,
    quarantinedAt,
    raw,
  }));
  removeStorageItem(storage, INSCAPE_AI_CONFIG_STORAGE_KEY);
  removeScopeKeyFromIndex(storage, scopeKey);
  return {
    scanned: 1,
    quarantined: 1,
    removedScopeKeys: [scopeKey],
    quarantineKeys: [quarantineKey],
  };
}

export function loadInscapeAIConfig(scopeRef: NimiAIScopeRef = createInscapeAIScopeRef()): NimiAIConfig {
  repairInscapeAIConfigStorageForScope(scopeRef);
  return aiConfigStore.load(scopeRef);
}

export function saveInscapeAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createInscapeAIScopeRef(),
): NimiAIConfig {
  repairInscapeAIConfigStorageForScope(scopeRef);
  const normalized = { ...next, scopeRef };
  const validation = validateNimiAIConfig(normalized);
  if (!validation.valid) {
    throw new Error(`AIConfig validation failed: ${validation.errors.join('; ')}`);
  }
  return aiConfigStore.save(normalized);
}
