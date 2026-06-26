import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyNimiAIConfig, encodeNimiAIScopeRef } from '@nimiplatform/sdk/ai';
import {
  INSCAPE_AI_CONFIG_QUARANTINE_PREFIX,
  INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY,
  INSCAPE_AI_CONFIG_STORAGE_KEY,
  createInscapeAIScopeRef,
  repairInscapeAIConfigStorageForScope,
} from '../src/shell/ai/inscape-ai-config.ts';

function createMemoryStorage() {
  const items = new Map();
  return {
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
    keys() {
      return [...items.keys()].sort();
    },
  };
}

test('Inscape AIConfig repair quarantines retired local target refs before SDK load', () => {
  const storage = createMemoryStorage();
  const scopeRef = createInscapeAIScopeRef();
  const scopeKey = encodeNimiAIScopeRef(scopeRef);
  const raw = JSON.stringify({
    scopeRef,
    capabilities: {
      targetRefs: {
        'text.generate': {
          kind: 'local-runtime',
          targetId: 'local-qwen',
          profileId: 'runtime-baseline:ready',
        },
      },
      selectedParams: {},
    },
    profileOrigin: null,
  });
  storage.setItem(INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY, JSON.stringify([scopeKey]));
  storage.setItem(INSCAPE_AI_CONFIG_STORAGE_KEY, raw);

  const result = repairInscapeAIConfigStorageForScope(scopeRef, storage, {
    now: () => '2026-06-26T00:00:00.000Z',
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.quarantined, 1);
  assert.deepEqual(result.removedScopeKeys, [scopeKey]);
  assert.equal(storage.getItem(INSCAPE_AI_CONFIG_STORAGE_KEY), null);
  assert.deepEqual(JSON.parse(storage.getItem(INSCAPE_AI_CONFIG_SCOPE_INDEX_KEY)), []);
  assert.equal(result.quarantineKeys.length, 1);
  assert.match(result.quarantineKeys[0], new RegExp(`^${INSCAPE_AI_CONFIG_QUARANTINE_PREFIX}`));
  const quarantine = JSON.parse(storage.getItem(result.quarantineKeys[0]));
  assert.match(quarantine.reason, /targetId is retired/);
  assert.equal(quarantine.raw, raw);

  assert.deepEqual(createEmptyNimiAIConfig(scopeRef), {
    scopeRef,
    capabilities: { targetRefs: {}, selectedParams: {} },
    profileOrigin: null,
  });
});
