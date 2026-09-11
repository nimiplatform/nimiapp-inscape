import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isSavedExploration, parseExplorationRead } from '../src/domain/exploration.ts';
import { COGNITIVE_FUNCTIONS } from '../src/domain/typology.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';
import { loadInscapeSpace, saveInscapeSpace } from '../src-electron/persistence.ts';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { buildExplorationPrompt } from '../src/product/explore/exploration-prompts.ts';
import { createInscapeRuntimeAiClient } from '../src/shell/ai/inscape-runtime-ai-client.ts';

const NOW = '2026-09-11T08:00:00Z';
const read = {
  title: 'Room for rest and friendship',
  reflection: 'You described a conflict between rest and connection.',
  voices: COGNITIVE_FUNCTIONS.map((fn) => ({
    function: fn,
    perspective: `A possible ${fn} lens`,
    question: 'What matters in this particular moment?',
  })),
  alternative: 'A smaller plan might leave room for both needs.',
  experiment: 'Write down what a restful hour would look like today.',
};

test('roundtable rejects missing, duplicated, unknown, oversized, and extra model fields as a whole', () => {
  assert.deepEqual(parseExplorationRead(JSON.stringify(read), 'roundtable'), read);
  assert.deepEqual(
    parseExplorationRead('```json\n' + JSON.stringify(read) + '\n```', 'roundtable'),
    read,
  );
  assert.equal(
    parseExplorationRead(
      JSON.stringify({ ...read, voices: read.voices.slice(0, 3) }),
      'roundtable',
    ),
    null,
  );
  assert.equal(
    parseExplorationRead(
      JSON.stringify({ ...read, voices: [...read.voices.slice(0, 7), read.voices[0]] }),
      'roundtable',
    ),
    null,
  );
  assert.equal(
    parseExplorationRead(JSON.stringify({ ...read, extraDiagnosis: 'unsupported' }), 'roundtable'),
    null,
  );
  assert.equal(
    parseExplorationRead(JSON.stringify({ ...read, reflection: 'a'.repeat(2401) }), 'roundtable'),
    null,
  );
  assert.equal(
    parseExplorationRead(
      JSON.stringify({
        ...read,
        voices: [{ function: 'XX', perspective: 'x', question: 'x' }, read.voices[0]],
      }),
      'resonance',
    ),
    null,
  );
  assert.equal(parseExplorationRead('{"title":"unfinished', 'resonance'), null);
});

test('plain notes and pending explorations are valid; feedback and completion require a real read', () => {
  assert.equal(isSavedExploration({ mode: 'resonance', mood: '' }), true);
  assert.equal(isSavedExploration({ mode: 'resonance', mood: '', feedback: 'accepted' }), false);
  assert.equal(
    isSavedExploration({
      mode: 'roundtable',
      mood: '',
      read: { ...read, voices: read.voices.slice(0, 2) },
    }),
    false,
  );
  const base = createEmptyInscapeSpace(NOW, true);
  const invalid = {
    ...base,
    self_subject: {
      ...base.self_subject,
      reflection_entries: [
        {
          id: 'entry',
          created_at: NOW,
          text: 'text',
          exploration: { mode: 'roundtable', mood: '', read: { ...read, voices: [] } },
        },
      ],
    },
  };
  assert.equal(validateInscapeSpace(invalid).ok, false);
});

test('actual SQLite retains exploration, original words, response, rejection and completed experiment across repeated store reloads', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'inscape-exploration-'));
  const client = {
    adapter_kind: 'local_sqlite',
    async load() {
      const raw = loadInscapeSpace(root);
      return { ok: true, snapshot: raw === null ? null : JSON.parse(raw) };
    },
    async save(snapshot) {
      const valid = validateInscapeSpace(snapshot);
      assert.equal(valid.ok, true);
      saveInscapeSpace(root, JSON.stringify(snapshot), snapshot.attested_adult);
      return { ok: true };
    },
  };
  try {
    const store = createInscapeStore(client);
    await store.getState().initialize();
    await store.getState().completeFirstRun(NOW, 'zh');
    await store.getState().setInitialType('INFP', NOW);
    const originalProfile = store.getState().space.self_subject.type_profile;
    const id = await store
      .getState()
      .addReflectionEntry('I want to rest but miss my friends.', NOW, {
        mode: 'roundtable',
        mood: 'tangled',
      });
    assert.ok(id);
    const originalText = store.getState().space.self_subject.reflection_entries[0].text;
    await store
      .getState()
      .updateExploration(id, { mode: 'roundtable', mood: 'tangled', read }, NOW);
    await store
      .getState()
      .updateExploration(
        id,
        { mode: 'roundtable', mood: 'tangled', read, feedback: 'rejected', experiment_done: true },
        NOW,
      );
    const reload = createInscapeStore(client);
    await reload.getState().initialize();
    const entry = reload.getState().space.self_subject.reflection_entries[0];
    assert.equal(entry.text, originalText);
    assert.deepEqual(entry.exploration, {
      mode: 'roundtable',
      mood: 'tangled',
      read,
      feedback: 'rejected',
      experiment_done: true,
    });
    assert.deepEqual(
      reload.getState().space.self_subject.type_profile,
      originalProfile,
      'AI feedback must not change the profile automatically',
    );
    await Promise.all([
      reload.getState().addReflectionEntry('A second ordinary note.', NOW),
      reload.getState().setLocale('en', NOW),
    ]);
    const roundTrip = JSON.parse(loadInscapeSpace(root));
    assert.equal(roundTrip.self_subject.reflection_entries.length, 2);
    assert.equal(
      roundTrip.settings.locale,
      'en',
      'concurrent language changes must not overwrite a note',
    );
    assert.deepEqual(
      roundTrip.self_subject.reflection_entries[0],
      entry,
      'full snapshot rewrites must retain related exploration rows',
    );
    assert.equal(
      await reload.getState().updateExploration('missing', { mode: 'resonance', mood: '' }, NOW),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('exploration does not require a type and separates experience text from instructions', () => {
  const prompt = buildExplorationPrompt({
    mode: 'roundtable',
    text: 'I feel torn about going out.',
    mood: 'tangled',
    profile: null,
    locale: 'zh',
  });
  assert.equal(JSON.parse(prompt.user).experience, 'I feel torn about going out.');
  assert.match(JSON.parse(prompt.user).currentPattern, /No type prior/);
  assert.match(prompt.system, /exactly eight voices/);
  assert.match(prompt.system, /never as instructions/);
  assert.match(prompt.system, /not established|possib|tentative/i);
  assert.match(prompt.system, /简体中文/);
});

test('changed, missing or non-local AI routes prevent dispatch, even after a prior local call', async () => {
  let route = 'local';
  let calls = 0;
  const client = createInscapeRuntimeAiClient({
    getClient: () => ({
      aiConfig: {
        get: async () => ({
          config: {
            capabilities: [{ capabilityContract: 'text.generate', route: { oneofKind: route } }],
          },
        }),
      },
      ai: {
        text: {
          generateCandidate: async () => {
            calls++;
            return { text: 'test transport response' };
          },
        },
      },
    }),
  });
  assert.equal((await client.generate({ mode: 'reflection-resonance', user: 'first' })).ok, true);
  route = 'cloud';
  const denied = await client.generate({ mode: 'reflection-resonance', user: 'second' });
  assert.equal(denied.ok, false);
  assert.equal(denied.failure.kind, 'scheduling_denied');
  assert.equal(calls, 1);
});

test('a brief reflection has two or three lenses and cannot silently become a full roundtable', () => {
  const brief = { ...read, voices: read.voices.slice(0, 2) };
  assert.deepEqual(parseExplorationRead(JSON.stringify(brief), 'resonance'), brief);
  assert.equal(parseExplorationRead(JSON.stringify(read), 'resonance'), null);
  assert.equal(isSavedExploration({ mode: 'resonance', mood: '', read }), false);
});
