// Inscape Runtime AI client — fail-close text.generate through the AIConfig
// binding + runtime scheduling gate. Plain text (no structured-output schema);
// the structured posterior parser (T1-11) lands in wave-2 with the inference
// engine. Local-only posture: a binding must be source='local' with empty
// connectorId, or an explicit cloud connector — no silent route rescue.

import { getPlatformClient, type PlatformClient } from '@nimiplatform/sdk';
import { createAIConfigEvidence, type AIConfig } from '@nimiplatform/sdk/ai';
import {
  createAIRuntimeEvidence,
  peekRuntimeSchedulingBatch,
  projectAIRuntimeEvidenceMetadata,
  resolveAIConfigRuntimeSchedulingTargetForCapability,
  type NimiRoutePolicy,
  type RuntimeRouteBinding,
} from '@nimiplatform/sdk/runtime';
import { runAppAiTextGenerate } from '@nimiplatform/sdk/ai-app';
import { INSCAPE_APP_ID } from '../../contracts/app-identity.ts';
import { createInscapeAIScopeRef, loadInscapeAIConfig } from './inscape-ai-config.ts';

export const INSCAPE_TEXT_GENERATE_CAPABILITY_ID = 'text.generate';

export type InscapeTextRequest = {
  readonly system?: string;
  readonly user: string;
};

export type InscapeTextFailureKind =
  | 'runtime_unavailable'
  | 'scheduling_denied'
  | 'empty_output';

export type InscapeTextResult =
  | { ok: true; text: string }
  | { ok: false; failure: { kind: InscapeTextFailureKind; detail: string } };

type RuntimeTextParams = {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
};

type ResolvedBinding =
  | {
      ok: true;
      model: string;
      route: NimiRoutePolicy;
      connectorId?: string;
      params: RuntimeTextParams;
      metadata: Record<string, string>;
    }
  | { ok: false; detail: string };

function bindingModel(binding: RuntimeRouteBinding): string {
  return String(binding.model || binding.modelId || binding.localModelId || '').trim();
}

function numberParam(params: Readonly<Record<string, unknown>> | undefined, key: string): number | undefined {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractTextParams(params: Readonly<Record<string, unknown>> | undefined): RuntimeTextParams {
  return {
    ...(numberParam(params, 'temperature') !== undefined
      ? { temperature: numberParam(params, 'temperature') }
      : {}),
    ...(numberParam(params, 'topP') !== undefined ? { topP: numberParam(params, 'topP') } : {}),
    ...(numberParam(params, 'maxTokens') !== undefined
      ? { maxTokens: numberParam(params, 'maxTokens') }
      : {}),
    ...(numberParam(params, 'timeoutMs') !== undefined
      ? { timeoutMs: numberParam(params, 'timeoutMs') }
      : {}),
  };
}

export function resolveInscapeTextGenerateBinding(config: AIConfig): ResolvedBinding {
  const binding = config.capabilities.selectedBindings[INSCAPE_TEXT_GENERATE_CAPABILITY_ID] || null;
  if (!binding) {
    return {
      ok: false,
      detail:
        'AIConfig binding is required for text.generate; Inscape Runtime AI failed closed before request dispatch.',
    };
  }
  const model = bindingModel(binding);
  if (!model) {
    return { ok: false, detail: 'AIConfig binding for text.generate does not include a runtime model id.' };
  }
  const connectorId = String(binding.connectorId || '').trim();
  if (binding.source === 'local' && connectorId) {
    return {
      ok: false,
      detail: 'AIConfig binding for text.generate is local but includes connectorId; local bindings must use connectorId="".',
    };
  }
  if (binding.source === 'cloud' && !connectorId) {
    return { ok: false, detail: 'AIConfig binding for text.generate is cloud but does not include connectorId.' };
  }
  if (binding.source !== 'local' && binding.source !== 'cloud') {
    return { ok: false, detail: `AIConfig binding has unsupported source "${String(binding.source)}".` };
  }
  const evidence = createAIConfigEvidence(config);
  return {
    ok: true,
    model,
    route: binding.source,
    ...(connectorId ? { connectorId } : {}),
    params: extractTextParams(config.capabilities.selectedParams[INSCAPE_TEXT_GENERATE_CAPABILITY_ID]),
    metadata: {
      aiConfigScopeKind: config.scopeRef.kind,
      aiConfigScopeOwnerId: config.scopeRef.ownerId,
      aiConfigCapabilityId: INSCAPE_TEXT_GENERATE_CAPABILITY_ID,
      aiConfigBindingSource: binding.source,
      aiConfigBindingModel: model,
      aiConfigHash: evidence.configHash,
      surfaceId: 'inscape.session.runtime-ai',
    },
  };
}

async function schedulingMetadata(
  client: PlatformClient,
  config: AIConfig,
): Promise<Record<string, string> | { readonly failure: string }> {
  const target = resolveAIConfigRuntimeSchedulingTargetForCapability(
    config,
    INSCAPE_TEXT_GENERATE_CAPABILITY_ID,
  );
  if (!target) return {};
  try {
    const batch = await peekRuntimeSchedulingBatch({
      appId: INSCAPE_APP_ID,
      targets: [target],
      peekScheduling: (request, options) => client.runtime.ai.peekScheduling(request, options),
    });
    const judgement = batch?.aggregateJudgement ?? null;
    if (judgement?.state === 'denied') {
      return { failure: `Runtime scheduling denied text.generate: ${judgement.detail || 'denied'}` };
    }
    return projectAIRuntimeEvidenceMetadata(createAIRuntimeEvidence({ schedulingJudgement: judgement }));
  } catch (error) {
    return { failure: error instanceof Error ? error.message : String(error) };
  }
}

export type InscapeRuntimeAiClientOptions = {
  readonly loadConfig?: () => AIConfig;
  readonly getPlatformClient?: () => PlatformClient;
};

export interface InscapeRuntimeAiClient {
  generate(request: InscapeTextRequest): Promise<InscapeTextResult>;
}

export function createInscapeRuntimeAiClient(
  options: InscapeRuntimeAiClientOptions = {},
): InscapeRuntimeAiClient {
  const loadConfig = options.loadConfig ?? (() => loadInscapeAIConfig(createInscapeAIScopeRef()));
  const getClient = options.getPlatformClient ?? (() => getPlatformClient());

  return {
    async generate(request: InscapeTextRequest): Promise<InscapeTextResult> {
      let config: AIConfig;
      try {
        config = loadConfig();
      } catch (error) {
        return {
          ok: false,
          failure: { kind: 'runtime_unavailable', detail: error instanceof Error ? error.message : String(error) },
        };
      }

      const resolved = resolveInscapeTextGenerateBinding(config);
      if (!resolved.ok) {
        return { ok: false, failure: { kind: 'runtime_unavailable', detail: resolved.detail } };
      }

      let client: PlatformClient;
      try {
        client = getClient();
      } catch (error) {
        return {
          ok: false,
          failure: { kind: 'runtime_unavailable', detail: error instanceof Error ? error.message : String(error) },
        };
      }

      const scheduling = await schedulingMetadata(client, config);
      if ('failure' in scheduling) {
        return { ok: false, failure: { kind: 'scheduling_denied', detail: scheduling.failure } };
      }

      const result = await runAppAiTextGenerate({
        runtime: { generateText: (req) => client.runtime.ai.text.generate(req) },
        request: {
          model: resolved.model,
          input: request.user,
          ...(request.system ? { system: request.system } : {}),
          route: resolved.route,
          ...(resolved.connectorId ? { connectorId: resolved.connectorId } : {}),
          metadata: { ...resolved.metadata, ...scheduling },
          ...resolved.params,
        },
      });

      if (!result.ok) {
        return {
          ok: false,
          failure: { kind: 'runtime_unavailable', detail: result.error.message || result.error.code },
        };
      }
      const text = result.text.trim();
      if (!text) {
        return { ok: false, failure: { kind: 'empty_output', detail: 'Runtime returned empty text.' } };
      }
      return { ok: true, text };
    },
  };
}
