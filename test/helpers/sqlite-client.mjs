import {
  loadInscapeSpace,
  saveInscapeSpace,
  clearInscapeSpace,
} from '../../src-electron/persistence.ts';
import { validateInscapeSpace } from '../../src/contracts/inscape-space-validator.ts';
export function sqliteClient(root) {
  return {
    adapter_kind: 'local_sqlite',
    async load() {
      try {
        const raw = loadInscapeSpace(root);
        if (raw === null) return { ok: true, snapshot: null };
        const snapshot = JSON.parse(raw);
        const validation = validateInscapeSpace(snapshot);
        return validation.ok
          ? { ok: true, snapshot }
          : {
              ok: false,
              error: {
                kind: 'load_invalid_snapshot',
                adapter: 'local_sqlite',
                validation_error: validation.error,
              },
            };
      } catch (cause) {
        return {
          ok: false,
          error: { kind: 'load_read_failed', adapter: 'local_sqlite', cause: String(cause) },
        };
      }
    },
    async save(snapshot) {
      const validation = validateInscapeSpace(snapshot);
      if (!validation.ok)
        return {
          ok: false,
          error: {
            kind: 'save_validation_failed',
            adapter: 'local_sqlite',
            validation_error: validation.error,
          },
        };
      try {
        saveInscapeSpace(root, JSON.stringify(snapshot), snapshot.attested_adult);
        return { ok: true };
      } catch (cause) {
        return {
          ok: false,
          error: { kind: 'save_write_failed', adapter: 'local_sqlite', cause: String(cause) },
        };
      }
    },
    async clear() {
      try {
        clearInscapeSpace(root);
        return { ok: true };
      } catch (cause) {
        return {
          ok: false,
          error: { kind: 'clear_failed', adapter: 'local_sqlite', cause: String(cause) },
        };
      }
    },
  };
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
