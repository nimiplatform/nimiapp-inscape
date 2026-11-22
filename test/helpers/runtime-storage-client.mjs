import {
  INSCAPE_QUARANTINE_PENDING_STORAGE_PATH,
  INSCAPE_SPACE_STORAGE_PATH,
  RuntimeStoragePersistenceAdapter,
} from '../../src/shell/persistence/runtime-storage-persistence-adapter.ts';

export { INSCAPE_QUARANTINE_PENDING_STORAGE_PATH, INSCAPE_SPACE_STORAGE_PATH };

export function createRuntimeStorageFixture() {
  const files = new Map();
  let failWritePath = null;
  const notFound = (relativePath) => Object.assign(new Error(`Asset not found: ${relativePath}`), {
    code: 'not-found',
    reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND',
  });
  const backend = {
    files,
    setFailWritePath(relativePath) {
      failWritePath = relativePath;
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
              throw new Error(`simulated storage write failure for ${relativePath}`);
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
  const controller = new AbortController();
  const client = new RuntimeStoragePersistenceAdapter({
    client: backend.client,
    signal: controller.signal,
  });
  return { client, backend, controller };
}

export const reflectionFixture = {
  mode: 'resonance',
  mood: 'calm',
  feedback: 'accepted',
  read: {
    title: 'A test fixture',
    reflection: 'Unit-test content, not a model evaluation.',
    voices: [
      { function: 'Ni', perspective: 'A possibility', question: 'What matters?' },
      { function: 'Fe', perspective: 'Another possibility', question: 'What changed?' },
    ],
    alternative: 'An alternative to examine.',
    experiment: 'Record one observation.',
  },
};
