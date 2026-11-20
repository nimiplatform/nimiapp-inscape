import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import {
  INSCAPE_QUARANTINE_PENDING_STORAGE_PATH,
  INSCAPE_SPACE_STORAGE_PATH,
  RuntimeStoragePersistenceAdapter,
} from '../src/shell/persistence/runtime-storage-persistence-adapter.ts';

const NOW = '2026-11-20T10:00:00Z';

function createMemoryAssets(options = {}) {
  const files = new Map();
  let failWritePath = options.failWritePath ?? null;
  const notFound = (path) => Object.assign(new Error(`Asset not found: ${path}`), {
    code: 'not-found',
    reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND',
  });
  return {
    files,
    setFailWritePath(path) {
      failWritePath = path;
    },
    client: {
      storage: {
        assets: {
          async read({ relativePath }) {
            const bytes = files.get(relativePath);
            if (!bytes) throw notFound(relativePath);
            return {
              body: (async function* () {
                yield bytes;
              })(),
            };
          },
          async write({ relativePath, body }) {
            if (failWritePath === relativePath) {
              throw new Error(`simulated write failure for ${relativePath}`);
            }
            const bytes = body instanceof Uint8Array
              ? body
              : new Uint8Array(await body.arrayBuffer());
            files.set(relativePath, bytes);
          },
          async remove(relativePath) {
            if (!files.has(relativePath)) throw notFound(relativePath);
            files.delete(relativePath);
          },
        },
      },
    },
  };
}

test('RuntimeStoragePersistenceAdapter loads null when empty and round-trips adult InscapeSpace', async () => {
  const backend = createMemoryAssets();
  const controller = new AbortController();
  const adapter = new RuntimeStoragePersistenceAdapter({ client: backend.client, signal: controller.signal });

  assert.deepEqual(await adapter.load(), { ok: true, snapshot: null });

  const store = createInscapeStore(adapter);
  await store.getState().initialize();
  assert.equal(await store.getState().completeFirstRun(NOW, 'zh'), true);
  const noteId = await store.getState().addReflectionEntry('虚构成年人的日常事件测试手记。', NOW);
  assert.ok(noteId);

  const reopened = createInscapeStore(adapter);
  await reopened.getState().initialize();
  assert.equal(reopened.getState().status, 'ready');
  assert.equal(reopened.getState().space.self_subject.reflection_entries.length, 1);
  assert.equal(reopened.getState().space.self_subject.reflection_entries[0].text, '虚构成年人的日常事件测试手记。');

  assert.equal(await reopened.getState().clearLocalData(), true);
  assert.deepEqual(await adapter.load(), { ok: true, snapshot: null });
});

test('RuntimeStoragePersistenceAdapter rejects unattested writes and incompatible schema versions', async () => {
  const backend = createMemoryAssets();
  const controller = new AbortController();
  const adapter = new RuntimeStoragePersistenceAdapter({ client: backend.client, signal: controller.signal });

  const unattested = createEmptyInscapeSpace(NOW, false);
  const saved = await adapter.save(unattested);
  assert.equal(saved.ok, false);

  backend.files.set(
    INSCAPE_SPACE_STORAGE_PATH,
    new TextEncoder().encode(JSON.stringify({ schema_version: 2 })),
  );
  const loaded = await adapter.load();
  assert.equal(loaded.ok, false);
  assert.equal(loaded.error.kind, 'load_incompatible_version');
  assert.equal(loaded.error.storedVersion, 2);
  assert.equal(loaded.error.expectedVersion, 3);
});

test('RuntimeStoragePersistenceAdapter preserves confirmed quarantine recovery intent and blocks overwrite after self quarantine', async () => {
  const backend = createMemoryAssets();
  const controller = new AbortController();
  const adapter = new RuntimeStoragePersistenceAdapter({ client: backend.client, signal: controller.signal });

  const store = createInscapeStore(adapter);
  await store.getState().initialize();
  assert.equal(await store.getState().completeFirstRun(NOW, 'zh'), true);

  backend.setFailWritePath(INSCAPE_SPACE_STORAGE_PATH);
  const pending = store.getState().quarantineSelf(NOW);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getState().processingBlocked, true);
  assert.equal(backend.files.has(INSCAPE_QUARANTINE_PENDING_STORAGE_PATH), true);

  const loadedPending = await adapter.load();
  assert.equal(loadedPending.ok, true);
  assert.ok(loadedPending.pendingQuarantine);

  backend.setFailWritePath(null);
  assert.equal(await store.getState().retrySave(), true);
  assert.equal(await pending, true);
  assert.equal(backend.files.has(INSCAPE_QUARANTINE_PENDING_STORAGE_PATH), false);

  const overwriteAttempt = await adapter.save(createEmptyInscapeSpace(NOW, true));
  assert.equal(overwriteAttempt.ok, false);
  assert.equal(overwriteAttempt.error.kind, 'save_write_failed');
});

test('RuntimeStoragePersistenceAdapter stops cleanly when connection scope signal is aborted', async () => {
  const backend = createMemoryAssets();
  const controller = new AbortController();
  const adapter = new RuntimeStoragePersistenceAdapter({ client: backend.client, signal: controller.signal });
  controller.abort();

  const loadResult = await adapter.load();
  assert.equal(loadResult.ok, false);
  assert.equal(loadResult.error.kind, 'load_read_failed');

  const saveResult = await adapter.save(createEmptyInscapeSpace(NOW, true));
  assert.equal(saveResult.ok, false);
  assert.equal(saveResult.error.kind, 'save_write_failed');
});
