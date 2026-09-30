import assert from 'node:assert/strict';
import test from 'node:test';
import { createInscapeRuntimeAiClient } from '../src/shell/ai/inscape-runtime-ai-client.ts';

test('AI client maps product text requests to one bounded App Access candidate call', async () => {
  let captured;
  const client = createInscapeRuntimeAiClient({
    beforeGenerate: async () => true,
    getAgeContext: () => null,
    canProcess: () => true,
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
    beforeGenerate: async () => true,
    getAgeContext: () => null,
    canProcess: () => true,
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
    beforeGenerate: async () => true,
    getAgeContext: () => null,
    canProcess: () => true,
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

test('quarantine during AI configuration prevents model dispatch', async () => {
  let allowed = true;
  let calls = 0;
  const client = createInscapeRuntimeAiClient({
    beforeGenerate: async () => true,
    getAgeContext: () => null,
    canProcess: () => allowed,
    getClient: () => ({
      aiConfig: { get: async () => {
        allowed = false;
        return { config: { capabilities: [{ capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } }] } };
      } },
      ai: { text: { generateCandidate: async () => { calls++; return { text: 'must not dispatch' }; } } },
    }),
  });
  const result = await client.generate({ mode: 'reflection-resonance', user: 'Synthetic source.' });
  assert.equal(result.ok, false);
  assert.equal(result.failure.kind, 'processing_stopped');
  assert.equal(calls, 0);
});

test('a model response arriving after quarantine is discarded', async () => {
  let allowed = true;
  let resolve;
  const client = createInscapeRuntimeAiClient({
    beforeGenerate: async () => true,
    getAgeContext: () => null,
    canProcess: () => allowed,
    getClient: () => ({
      aiConfig: { get: async () => ({ config: { capabilities: [{ capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } }] } }) },
      ai: { text: { generateCandidate: () => new Promise((done) => { resolve = done; }) } },
    }),
  });
  const pending = client.generate({ mode: 'reflection-resonance', user: 'Synthetic source.' });
  await new Promise((done) => setImmediate(done));
  allowed = false;
  resolve({ text: 'A late synthetic response.' });
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.failure.kind, 'processing_stopped');
});

test('a cancelled source review prevents obtaining Runtime access or model dispatch', async () => {
  const client = createInscapeRuntimeAiClient({
    canProcess: () => true,
    beforeGenerate: async () => false,
    getAgeContext: () => null,
    getClient: () => { throw new Error('must not obtain Runtime access before source approval'); },
  });
  const result = await client.generate({ mode: 'reflection-resonance', user: 'Synthetic source.' });
  assert.equal(result.ok, false);
  assert.equal(result.failure.kind, 'processing_stopped');
});
