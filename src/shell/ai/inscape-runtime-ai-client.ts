import { isStructuredAiMode, type StructuredAiMode } from '../../domain/ai-mode.ts';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { getInscapeNimiClient } from '../infra/inscape-nimi-client.ts';

export type InscapeTextRequest = {
  readonly mode: StructuredAiMode;
  readonly system?: string;
  readonly user: string;
  readonly temperature?: number;
};
export type InscapeTextFailureKind =
  | 'runtime_unavailable'
  | 'scheduling_denied'
  | 'empty_output'
  | 'processing_stopped'
  | 'unsupported_mode';
export type InscapeTextResult =
  | { ok: true; text: string }
  | { ok: false; failure: { kind: InscapeTextFailureKind; detail: string } };

export type InscapeRuntimeAiClientOptions = {
  readonly getClient?: () => NimiLocalAppClient;
  readonly canProcess: () => boolean;
  readonly beforeGenerate: () => Promise<boolean>;
  readonly getAgeContext: (request: InscapeTextRequest) => string | null;
};

export interface InscapeRuntimeAiClient {
  generate(request: InscapeTextRequest): Promise<InscapeTextResult>;
}

export function createInscapeRuntimeAiClient(
  options: InscapeRuntimeAiClientOptions,
): InscapeRuntimeAiClient {
  const getClient = options.getClient ?? getInscapeNimiClient;
  const stopped = (): InscapeTextResult => ({ ok: false, failure: { kind: 'processing_stopped', detail: 'Source material is no longer available for analysis.' } });
  return {
    async generate(request) {
      // @nimi-authority: rule.inscape.runtime-ai.r003
      if (!isStructuredAiMode(request.mode))
        return {
          ok: false,
          failure: { kind: 'unsupported_mode', detail: 'Unsupported structured exploration mode.' },
        };
      try {
        // @nimi-authority: rule.inscape.privacy.r003
        if (!options.canProcess()) return stopped();
        if (!(await options.beforeGenerate()) || !options.canProcess()) return stopped();
        // @nimi-authority: rule.inscape.runtime-ai.r002
        const client = getClient();
        const config = await client.aiConfig.get();
        if (!options.canProcess()) return stopped();
        const binding = config.config?.capabilities.find(
          (item) => item.capabilityContract === 'text.generate',
        );
        if (binding?.route.oneofKind !== 'local') {
          return {
            ok: false,
            failure: {
              kind: 'scheduling_denied',
              detail: 'Inscape requires a local text model route.',
            },
          };
        }
        const context = options.getAgeContext(request);
        const system = [request.system, context].filter(Boolean).join('\n\n');
        const result = await client.ai.text.generateCandidate({
          messages: [
            ...(system ? [{ role: 'system' as const, text: system }] : []),
            { role: 'user' as const, text: request.user },
          ],
          temperature: request.temperature ?? 0.7,
          topP: 0.95,
          maxTokens: 3072,
        });
        if (!options.canProcess()) return stopped();
        const output = result.text.trim();
        if (!output) {
          return {
            ok: false,
            failure: { kind: 'empty_output', detail: 'Runtime returned empty text.' },
          };
        }
        return { ok: true, text: output };
      } catch (error) {
        return {
          ok: false,
          failure: {
            kind: 'runtime_unavailable',
            detail: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };
}
