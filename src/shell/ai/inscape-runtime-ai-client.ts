// Inscape Runtime AI client — fail-close text.generate through the AIConfig
// binding + runtime scheduling gate. Plain text (no structured-output schema);
// the structured posterior parser (T1-11) lands in wave-2 with the inference
// engine. Local-only posture: a binding must be source='local' with empty
// connectorId, or an explicit cloud connector — no silent route rescue.

import type { NimiClient } from '@nimiplatform/sdk';
import {
  createNimiAIConfigEvidence,
  createNimiAIRuntimeEvidence,
  createNimiRuntimeAIModel,
  createNimiRuntimeAISchedulingClient,
  projectNimiAIRuntimeEvidenceMetadata,
  runNimiTextGenerate,
  type NimiAIConfig,
  type NimiAIConfigTargetRef,
  type NimiAISchedulingTargetInput,
  type NimiRuntimeAIRoutePolicy,
} from '@nimiplatform/sdk/ai';
import { INSCAPE_APP_ID } from '../../contracts/app-identity.ts';
import { getInscapeNimiClient } from '../infra/inscape-nimi-client.ts';
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
      route: NimiRuntimeAIRoutePolicy;
      connectorId?: string;
      params: RuntimeTextParams;
      metadata: Record<string, string>;
      schedulingTarget: NimiAISchedulingTargetInput | null;
    }
  | { ok: false; detail: string };

function targetRefModel(targetRef: NimiAIConfigTargetRef): string {
  if (targetRef.kind === 'cloud-connector') {
    return String(targetRef.providerModelId || '').trim();
  }
  if (targetRef.kind === 'local-runtime') {
    return String(targetRef.profileId || targetRef.targetId || targetRef.readinessRef || '').trim();
  }
  return '';
}

function schedulingTargetFor(
  capability: string,
  targetRef: NimiAIConfigTargetRef,
): NimiAISchedulingTargetInput | null {
  if (targetRef.kind === 'profile-slice') return null;
  return { capability, targetRef };
}

function paramsRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
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

export function resolveInscapeTextGenerateBinding(config: NimiAIConfig): ResolvedBinding {
  const targetRef = config.capabilities.targetRefs[INSCAPE_TEXT_GENERATE_CAPABILITY_ID] || null;
  if (!targetRef) {
    return {
      ok: false,
      detail:
        'AIConfig targetRef is required for text.generate; Inscape Runtime AI failed closed before request dispatch.',
    };
  }
  if (targetRef.kind === 'profile-slice') {
    return {
      ok: false,
      detail: `AIConfig targetRef for text.generate still points to profile-slice ${targetRef.sliceId}; apply/materialize a live Runtime target before dispatch.`,
    };
  }
  const model = targetRefModel(targetRef);
  if (!model) {
    return { ok: false, detail: 'AIConfig targetRef for text.generate does not include a Runtime model id.' };
  }
  const connectorId = targetRef.kind === 'cloud-connector' ? String(targetRef.connectorId || '').trim() : '';
  const route = targetRef.kind === 'cloud-connector' ? 'cloud' : 'local';
  const evidence = createNimiAIConfigEvidence(config);
  return {
    ok: true,
    model,
    route,
    ...(connectorId ? { connectorId } : {}),
    params: extractTextParams(paramsRecord(config.capabilities.selectedParams[INSCAPE_TEXT_GENERATE_CAPABILITY_ID])),
    schedulingTarget: schedulingTargetFor(INSCAPE_TEXT_GENERATE_CAPABILITY_ID, targetRef),
    metadata: {
      aiConfigScopeKind: config.scopeRef.kind,
      aiConfigScopeOwnerId: config.scopeRef.ownerId,
      aiConfigScopeSurfaceId: config.scopeRef.surfaceId || '',
      aiConfigCapabilityId: INSCAPE_TEXT_GENERATE_CAPABILITY_ID,
      aiConfigTargetRefKind: targetRef.kind,
      aiConfigBindingSource: route,
      aiConfigBindingConnectorId: connectorId,
      aiConfigBindingModel: model,
      aiConfigHash: evidence.configHash,
      surfaceId: 'inscape.session.runtime-ai',
    },
  };
}

async function schedulingMetadata(
  client: NimiClient,
  config: NimiAIConfig,
  target: NimiAISchedulingTargetInput | null,
): Promise<Record<string, string> | { readonly failure: string }> {
  if (!target) return {};
  try {
    const scheduling = createNimiRuntimeAISchedulingClient({
      appId: INSCAPE_APP_ID,
      runtime: client.runtime,
      targets: [target],
    });
    const batch = await scheduling.peek({ config });
    const judgement = batch.aggregateJudgement ?? null;
    if (judgement?.state === 'denied') {
      return { failure: `Runtime scheduling denied text.generate: ${judgement.detail || 'denied'}` };
    }
    return projectNimiAIRuntimeEvidenceMetadata(createNimiAIRuntimeEvidence({ schedulingJudgement: judgement }));
  } catch (error) {
    return { failure: error instanceof Error ? error.message : String(error) };
  }
}

export type InscapeRuntimeAiClientOptions = {
  readonly loadConfig?: () => NimiAIConfig;
  readonly getClient?: () => NimiClient;
};

export interface InscapeRuntimeAiClient {
  generate(request: InscapeTextRequest): Promise<InscapeTextResult>;
}

export function createInscapeRuntimeAiClient(
  options: InscapeRuntimeAiClientOptions = {},
): InscapeRuntimeAiClient {
  const loadConfig = options.loadConfig ?? (() => loadInscapeAIConfig(createInscapeAIScopeRef()));
  const getClient = options.getClient ?? (() => getInscapeNimiClient());

  return {
    async generate(request: InscapeTextRequest): Promise<InscapeTextResult> {
      let config: NimiAIConfig;
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

      let client: NimiClient;
      try {
        client = getClient();
      } catch (error) {
        return {
          ok: false,
          failure: { kind: 'runtime_unavailable', detail: error instanceof Error ? error.message : String(error) },
        };
      }

      const scheduling = await schedulingMetadata(client, config, resolved.schedulingTarget);
      if ('failure' in scheduling) {
        return { ok: false, failure: { kind: 'scheduling_denied', detail: scheduling.failure } };
      }

      const model = createNimiRuntimeAIModel({
        runtime: client.runtime,
        appId: INSCAPE_APP_ID,
        routePolicy: resolved.route,
        connectorId: resolved.connectorId,
        timeoutMs: resolved.params.timeoutMs,
        model: {
          modelId: resolved.model,
          ...(resolved.connectorId ? { providerId: resolved.connectorId } : {}),
        },
      });
      const result = await runNimiTextGenerate({
        runtime: { model },
        request: {
          model: model.model,
          messages: [
            ...(request.system ? [{ role: 'system' as const, content: [{ type: 'text' as const, text: request.system }] }] : []),
            { role: 'user', content: [{ type: 'text', text: request.user }] },
          ],
          parameters: {
            temperature: resolved.params.temperature,
            topP: resolved.params.topP,
            maxTokens: resolved.params.maxTokens,
            metadata: { ...resolved.metadata, ...scheduling },
          },
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
