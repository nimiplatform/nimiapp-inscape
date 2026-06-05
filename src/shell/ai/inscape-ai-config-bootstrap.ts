// First-run AIConfig initialization. On a fresh install the runtime's
// product-control first-run evidence carries the locally-installed text model;
// this projects that evidence into the text.generate targetRef and saves it to
// the Inscape AIConfig. Fail-closed: if the evidence is missing or not ready,
// no target is fabricated — the outcome is 'not-initialized' and the AI
// surface stays unavailable until the runtime is ready.

import type { NimiClient } from '@nimiplatform/sdk';
import {
  getNimiRuntimeProductControlRecord,
  projectNimiFirstRunExecutionEvidenceToAIConfigTargets,
} from '@nimiplatform/sdk/runtime';
import type { NimiAIConfig, NimiAIScopeRef } from '@nimiplatform/sdk/ai';
import { getInscapeNimiClient } from '../infra/inscape-nimi-client.ts';
import {
  createInscapeAIScopeRef,
  loadInscapeAIConfig,
  saveInscapeAIConfig,
} from './inscape-ai-config.ts';
import { INSCAPE_TEXT_GENERATE_CAPABILITY_ID } from './inscape-runtime-ai-client.ts';

export type InscapeFirstRunAIConfigInitOutcome =
  | { outcome: 'already-bound'; config: NimiAIConfig }
  | {
      outcome: 'initialized';
      config: NimiAIConfig;
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
  readonly scopeRef?: NimiAIScopeRef;
  readonly client?: NimiClient;
  readonly getClient?: () => NimiClient;
  readonly loadConfig?: (scopeRef: NimiAIScopeRef) => NimiAIConfig;
  readonly saveConfig?: (next: NimiAIConfig, scopeRef: NimiAIScopeRef) => NimiAIConfig;
};

function detailFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTextGenerateTargetRef(config: NimiAIConfig) {
  return config.capabilities.targetRefs[INSCAPE_TEXT_GENERATE_CAPABILITY_ID] || null;
}

function ensureAIConfigShape(config: NimiAIConfig, scopeRef: NimiAIScopeRef): NimiAIConfig {
  return {
    ...config,
    scopeRef,
    capabilities: {
      targetRefs: { ...(config.capabilities.targetRefs || {}) },
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

  if (readTextGenerateTargetRef(config)) {
    return { outcome: 'already-bound', config };
  }

  const client = options.client
    ?? (options.getClient ? options.getClient() : getInscapeNimiClient());

  let recordProjection;
  try {
    recordProjection = await getNimiRuntimeProductControlRecord(client.runtime.generated);
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
    resolvedEvidence = await client.runtime.generated.resolveFirstRunExecutionEvidence({
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

  let textTargetRef;
  try {
    textTargetRef = projectNimiFirstRunExecutionEvidenceToAIConfigTargets(resolvedEvidence.ref)
      .find((item) => item.capability === INSCAPE_TEXT_GENERATE_CAPABILITY_ID)?.targetRef ?? null;
  } catch (error) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_text_binding_missing',
      detail: detailFromError(error),
    };
  }

  if (!textTargetRef) {
    return {
      outcome: 'not-initialized',
      reason: 'first_run_text_binding_missing',
      detail: 'Verified Runtime first-run evidence did not contain text.generate.',
    };
  }

  const next: NimiAIConfig = {
    ...config,
    capabilities: {
      ...config.capabilities,
      targetRefs: {
        ...config.capabilities.targetRefs,
        [INSCAPE_TEXT_GENERATE_CAPABILITY_ID]: textTargetRef,
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
