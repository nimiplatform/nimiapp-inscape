// First-run AIConfig initialization. On a fresh install the runtime's
// product-control first-run evidence carries the locally-installed text model;
// this projects that evidence into the text.generate binding and saves it to
// the Inscape AIConfig. Fail-closed: if the evidence is missing or not ready,
// no binding is fabricated — the outcome is 'not-initialized' and the AI
// surface stays unavailable until the runtime is ready.

import {
  getPlatformClient,
  getRuntimeProductControlRecord,
  type PlatformClient,
} from '@nimiplatform/sdk';
import { projectFirstRunExecutionEvidenceToAIConfigBindings } from '@nimiplatform/sdk/runtime';
import type { AIConfig, AIScopeRef } from '@nimiplatform/sdk/ai';
import {
  createInscapeAIScopeRef,
  loadInscapeAIConfig,
  saveInscapeAIConfig,
} from './inscape-ai-config.ts';
import { INSCAPE_TEXT_GENERATE_CAPABILITY_ID } from './inscape-runtime-ai-client.ts';

export type InscapeFirstRunAIConfigInitOutcome =
  | { outcome: 'already-bound'; config: AIConfig }
  | {
      outcome: 'initialized';
      config: AIConfig;
      executionEvidenceRef: string;
      runtimeBaselineRef: string;
    }
  | {
      outcome: 'not-initialized';
      reason:
        | 'first_run_record_unavailable'
        | 'first_run_evidence_missing'
        | 'first_run_evidence_not_ready'
        | 'first_run_text_binding_missing'
        | 'first_run_config_apply_failed';
      detail: string;
    };

export type InscapeFirstRunAIConfigInitOptions = {
  readonly scopeRef?: AIScopeRef;
  readonly platformClient?: PlatformClient;
  readonly getPlatformClient?: () => PlatformClient;
  readonly loadConfig?: (scopeRef: AIScopeRef) => AIConfig;
  readonly saveConfig?: (next: AIConfig, scopeRef: AIScopeRef) => AIConfig;
};

function detailFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTextGenerateBinding(config: AIConfig) {
  return config.capabilities.selectedBindings[INSCAPE_TEXT_GENERATE_CAPABILITY_ID] || null;
}

function ensureAIConfigShape(config: AIConfig, scopeRef: AIScopeRef): AIConfig {
  return {
    ...config,
    scopeRef,
    capabilities: {
      selectedBindings: { ...(config.capabilities.selectedBindings || {}) },
      localProfileRefs: { ...(config.capabilities.localProfileRefs || {}) },
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
  const saveConfig = options.saveConfig
    ?? ((next, targetScopeRef) => saveInscapeAIConfig(next, targetScopeRef));
  const config = ensureAIConfigShape(loadConfig(scopeRef), scopeRef);

  if (readTextGenerateBinding(config)) {
    return { outcome: 'already-bound', config };
  }

  const platformClient = options.platformClient
    ?? (options.getPlatformClient ? options.getPlatformClient() : getPlatformClient());

  let recordProjection;
  try {
    recordProjection = await getRuntimeProductControlRecord(platformClient.runtime);
  } catch (error) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_record_unavailable',
      detail: detailFromError(error),
    };
  }

  const firstRun = recordProjection.record?.firstRun ?? null;
  const executionEvidenceRef = String(firstRun?.executionEvidenceRef || '').trim();
  const runtimeBaselineRef = String(firstRun?.runtimeBaselineRef || '').trim();
  const installLevel = String(firstRun?.installLevel || '').trim();
  if (!executionEvidenceRef || !runtimeBaselineRef || !installLevel) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_evidence_missing',
      detail: 'Runtime product-control first-run evidence is incomplete.',
    };
  }

  let resolvedEvidence;
  try {
    resolvedEvidence = await platformClient.runtime.local.resolveFirstRunExecutionEvidence({
      executionEvidenceRef,
      expectedRuntimeBaselineRef: runtimeBaselineRef,
      expectedDataRootRef: '',
      expectedInstallLevel: installLevel,
    });
  } catch (error) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_evidence_not_ready',
      detail: detailFromError(error),
    };
  }

  if (resolvedEvidence.state !== 'local_ai_ready' || !resolvedEvidence.ref) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_evidence_not_ready',
      detail: resolvedEvidence.detail || resolvedEvidence.reasonCode || resolvedEvidence.state,
    };
  }

  let textBinding;
  try {
    textBinding = projectFirstRunExecutionEvidenceToAIConfigBindings(resolvedEvidence.ref)
      .find((item) => item.capability === INSCAPE_TEXT_GENERATE_CAPABILITY_ID)?.binding ?? null;
  } catch (error) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_text_binding_missing',
      detail: detailFromError(error),
    };
  }

  if (!textBinding) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_text_binding_missing',
      detail: 'Verified Runtime first-run evidence did not contain text.generate.',
    };
  }

  const next: AIConfig = {
    ...config,
    capabilities: {
      ...config.capabilities,
      selectedBindings: {
        ...config.capabilities.selectedBindings,
        [INSCAPE_TEXT_GENERATE_CAPABILITY_ID]: textBinding,
      },
    },
  };

  try {
    const saved = saveConfig(next, scopeRef);
    return {
      outcome: 'initialized',
      config: saved,
      executionEvidenceRef,
      runtimeBaselineRef,
    };
  } catch (error) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_config_apply_failed',
      detail: detailFromError(error),
    };
  }
}
