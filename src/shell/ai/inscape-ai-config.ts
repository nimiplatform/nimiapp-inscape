// Inscape AIConfig storage for the text.generate surface. Generic SDK config
// store (browser local storage), scoped to ai.nimi.apps.inscape / inscape.session.
// The model binding is populated from runtime first-run evidence by
// inscape-ai-config-bootstrap.ts. The model-config UI surface + AIProfile
// library land in a later wave.

import {
  createAppAIScopeRef,
  createScopedAIConfigStore,
  validateAIConfigRuntimeBindings,
  type AIConfig,
  type AIConfigStorageLike,
  type AIScopeRef,
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

const aiConfigStore = createScopedAIConfigStore({
  storage: () => getStorage() as AIConfigStorageLike | null,
  configKeyForScope: () => INSCAPE_AI_CONFIG_STORAGE_KEY,
  validateRuntimeBindings: true,
  enableEphemeralStore: useEphemeralStore(),
});

export function createInscapeAIScopeRef(): AIScopeRef {
  return createAppAIScopeRef(INSCAPE_APP_ID, INSCAPE_AI_SURFACE_ID);
}

export function loadInscapeAIConfig(scopeRef: AIScopeRef = createInscapeAIScopeRef()): AIConfig {
  return aiConfigStore.load(scopeRef);
}

export function saveInscapeAIConfig(
  next: AIConfig,
  scopeRef: AIScopeRef = createInscapeAIScopeRef(),
): AIConfig {
  const normalized = { ...next, scopeRef };
  const bindingErrors = validateAIConfigRuntimeBindings(normalized);
  if (bindingErrors.length > 0) {
    throw new Error(`AIConfig binding validation failed: ${bindingErrors.join('; ')}`);
  }
  return aiConfigStore.save(normalized);
}
