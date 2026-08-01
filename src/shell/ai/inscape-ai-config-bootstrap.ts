// First-run AIConfig initialization. The Runtime used to publish first-run
// execution evidence carrying the locally-installed text model; that chain was
// removed in favor of Runtime-owned live gates and has no SDK equivalent.
// Fail-closed: when no text.generate targetRef is bound, no target is
// fabricated — the outcome is 'not-initialized' and the AI surface stays
// unavailable until a target is bound through a supported path.

import type { NimiAIConfig, NimiAIScopeRef } from '@nimiplatform/sdk/ai';
import {
  createInscapeAIScopeRef,
  loadInscapeAIConfig,
} from './inscape-ai-config.ts';
import { INSCAPE_TEXT_GENERATE_CAPABILITY_ID } from './inscape-runtime-ai-client.ts';

export type InscapeFirstRunAIConfigInitOutcome =
  | { outcome: 'already-bound'; config: NimiAIConfig }
  | {
      outcome: 'not-initialized';
      reason: 'first_run_evidence_missing';
      detail: string;
    };

export type InscapeFirstRunAIConfigInitOptions = {
  readonly scopeRef?: NimiAIScopeRef;
  readonly loadConfig?: (scopeRef: NimiAIScopeRef) => NimiAIConfig;
};

function readTextGenerateTargetRef(config: NimiAIConfig) {
  return config.capabilities.targetRefs[INSCAPE_TEXT_GENERATE_CAPABILITY_ID] || null;
}

function ensureAIConfigShape(config: NimiAIConfig, scopeRef: NimiAIScopeRef): NimiAIConfig {
  return {
    ...config,
    scopeRef,
    capabilities: {
      logicalModelIds: { ...(config.capabilities.logicalModelIds || {}) },
      targetRefs: { ...(config.capabilities.targetRefs || {}) },
      selectedComponents: { ...(config.capabilities.selectedComponents || {}) },
      selectedParams: { ...(config.capabilities.selectedParams || {}) },
    },
    profileOrigin: config.profileOrigin ?? null,
  };
}

export async function ensureInscapeAIConfigFromFirstRunEvidence(
  options: InscapeFirstRunAIConfigInitOptions = {},
): Promise<InscapeFirstRunAIConfigInitOutcome> {
  const scopeRef = options.scopeRef ?? createInscapeAIScopeRef();
  const loadConfig = options.loadConfig ?? loadInscapeAIConfig;
  const config = ensureAIConfigShape(loadConfig(scopeRef), scopeRef);

  if (readTextGenerateTargetRef(config)) {
    return { outcome: 'already-bound', config };
  }

  // Fail closed: the Runtime no longer publishes first-run execution evidence
  // and exposes no SDK API to derive an AIConfig targetRef from it, so the
  // automatic text.generate binding cannot be initialized here.
  return {
    outcome: 'not-initialized',
    reason: 'first_run_evidence_missing',
    detail: 'Runtime first-run execution evidence is no longer published; automatic text.generate binding is unavailable.',
  };
}
