import assert from 'node:assert/strict';
import test from 'node:test';
import { createInscapeRuntimeAiClient } from '../src/shell/ai/inscape-runtime-ai-client.ts';

test('AI client maps product text requests to one bounded App Access candidate call', async () => {
  let captured;
  const client = createInscapeRuntimeAiClient({
    getClient: () => ({
      aiConfig: {
        get: async () => ({
          config: {
            capabilities: [
              { capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } },
            ],
          },
        }),
      },
      ai: {
        text: {
          generateCandidate: async (input) => {
            captured = input;
            return { text: '  reflection  ', finishReason: 'stop', traceId: 'trace-1' };
          },
        },
      },
    }),
  });
  const result = await client.generate({
    mode: 'reflection-resonance',
    system: 'system',
    user: 'user',
  });
  assert.deepEqual(result, { ok: true, text: 'reflection' });
  assert.deepEqual(captured.messages, [
    { role: 'system', text: 'system' },
    { role: 'user', text: 'user' },
  ]);
  assert.equal(captured.maxTokens <= 4096, true);
});

test('AI client fails closed when protected Runtime access rejects', async () => {
  const client = createInscapeRuntimeAiClient({
    getClient: () => ({
      aiConfig: {
        get: async () => ({
          config: {
            capabilities: [
              { capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } },
            ],
          },
        }),
      },
      ai: {
        text: {
          generateCandidate: async () => {
            throw new Error('local-app-access-denied');
          },
        },
      },
    }),
  });
  const result = await client.generate({ mode: 'reflection-resonance', user: 'user' });
  assert.equal(result.ok, false);
  assert.equal(result.failure.kind, 'runtime_unavailable');
});

test('unknown or missing structured modes are rejected before obtaining Runtime access', async () => {
  const client = createInscapeRuntimeAiClient({
    getClient: () => {
      throw new Error('must not obtain Runtime access');
    },
  });
  for (const mode of ['open-chat', undefined, '']) {
    const result = await client.generate({ mode, user: 'hello' });
    assert.equal(result.ok, false);
    assert.equal(result.failure.kind, 'unsupported_mode');
  }
});
