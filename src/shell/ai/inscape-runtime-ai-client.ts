import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { getInscapeNimiClient } from '../infra/inscape-nimi-client.ts';

export type InscapeTextRequest = { readonly system?: string; readonly user: string };
export type InscapeTextFailureKind = 'runtime_unavailable' | 'scheduling_denied' | 'empty_output';
export type InscapeTextResult =
  | { ok: true; text: string }
  | { ok: false; failure: { kind: InscapeTextFailureKind; detail: string } };

export type InscapeRuntimeAiClientOptions = {
  readonly getClient?: () => NimiLocalAppClient;
};

export interface InscapeRuntimeAiClient {
  generate(request: InscapeTextRequest): Promise<InscapeTextResult>;
}

export function createInscapeRuntimeAiClient(
  options: InscapeRuntimeAiClientOptions = {},
): InscapeRuntimeAiClient {
  const getClient = options.getClient ?? getInscapeNimiClient;
  return {
    async generate(request) {
      try {
        const result = await getClient().ai.text.generateCandidate({
          messages: [
            ...(request.system ? [{ role: 'system' as const, text: request.system }] : []),
            { role: 'user' as const, text: request.user },
          ],
          temperature: 0.7,
          topP: 0.95,
          maxTokens: 2048,
        });
        const output = result.text.trim();
        if (!output) {
          return { ok: false, failure: { kind: 'empty_output', detail: 'Runtime returned empty text.' } };
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
