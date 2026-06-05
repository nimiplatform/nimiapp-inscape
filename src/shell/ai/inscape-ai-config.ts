// Inscape AIConfig storage for the text.generate surface. Generic SDK config
// store (browser local storage), scoped to ai.nimi.apps.inscape / inscape.session.
// The model binding is populated from runtime first-run evidence by
// inscape-ai-config-bootstrap.ts. The model-config UI surface + AIProfile
// library land in a later wave.

import {
  createNimiAIConfigStore,
  createNimiAppAIScopeRef,
  validateNimiAIConfig,
  type NimiAIConfig,
  type NimiAIHostStorage,
  type NimiAIScopeRef,
} from '@nimiplatform/sdk/ai';
import { resolveBrowserStorage } from '@nimiplatform/kit/core/storage-json';
import { INSCAPE_APP_ID } from '../../contracts/app-identity.ts';

export const INSCAPE_AI_SURFACE_ID = 'inscape.session';
export const INSCAPE_AI_CONFIG_STORAGE_KEY = 'nimiapp-inscape:session-ai-config:v1';

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

export function loadInscapeAIConfig(scopeRef: NimiAIScopeRef = createInscapeAIScopeRef()): NimiAIConfig {
  return aiConfigStore.load(scopeRef);
}

export function saveInscapeAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createInscapeAIScopeRef(),
): NimiAIConfig {
  const normalized = { ...next, scopeRef };
  const validation = validateNimiAIConfig(normalized);
  if (!validation.valid) {
    throw new Error(`AIConfig validation failed: ${validation.errors.join('; ')}`);
  }
  return aiConfigStore.save(normalized);
}
