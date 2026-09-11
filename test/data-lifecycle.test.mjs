import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { sqliteClient, reflectionFixture } from './helpers/sqlite-client.mjs';

const NOW = '2026-09-11T12:00:00Z';
function proposalContext(store) {
  const subject = store.getState().space.self_subject;
  return { profile: subject.type_profile, baseline: subject.profile_baseline };
}
function accept(store, proposal, now, sourceId) {
  const entry = store
    .getState()
    .space.self_subject.reflection_entries.find((e) => 'reflection:' + e.id === sourceId);
  return store.getState().applyAcceptedPosteriorUpdate(
    proposal, now, sourceId, entry?.text ?? '', proposalContext(store),
  );
}

async function setup(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'inscape-lifecycle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = sqliteClient(root);
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW, 'zh');
  return { root, client, store };
}

test(
  'a real SQLite lock preserves the live store and retry completes one original save before queued changes',
  { timeout: 15000 },
  async (t) => {
    const { root, client, store } = await setup(t);
    const lock = new Database(path.join(root, 'inscape.db'));
    t.after(() => {
      if (lock.open) lock.close();
    });
    lock.exec('BEGIN EXCLUSIVE');
    const pending = store.getState().addReflectionEntry('Retain this draft.', NOW);
    const queued = store.getState().setLocale('en', NOW);
    await setImmediate();
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().space.self_subject.reflection_entries.length, 0);
    assert.equal(store.getState().saveError, 'persistence_save_write_failed');
    lock.exec('ROLLBACK');
    assert.equal(await store.getState().retrySave(), true);
    assert.ok(await pending);
    assert.equal(await queued, true);
    const reloaded = await client.load();
    assert.equal(reloaded.snapshot.self_subject.reflection_entries.length, 1);
    assert.equal(reloaded.snapshot.self_subject.reflection_entries[0].text, 'Retain this draft.');
    assert.equal(reloaded.snapshot.settings.locale, 'en');
    assert.equal(store.getState().saveError, null);
  },
);

test(
  'cancelling a real failed save returns no successful id and allows later saves',
  { timeout: 15000 },
  async (t) => {
    const { root, store } = await setup(t);
    const lock = new Database(path.join(root, 'inscape.db'));
    t.after(() => {
      if (lock.open) lock.close();
    });
    lock.exec('BEGIN EXCLUSIVE');
    const pending = store.getState().addReflectionEntry('Unsaved only.', NOW);
    await setImmediate();
    store.getState().cancelSave();
    assert.equal(await pending, '');
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().space.self_subject.reflection_entries.length, 0);
    lock.exec('ROLLBACK');
    assert.ok(await store.getState().addReflectionEntry('Saved later.', NOW));
  },
);

test('calibration needs a real accepted source, can contribute only once, and feedback withdrawal reverses it', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INFP', NOW);
  const before =
    store.getState().space.self_subject.type_profile.function_stack_posterior.Fe.strength;
  const entryId = await store
    .getState()
    .addReflectionEntry('My own observation.', NOW, reflectionFixture);
  const proposal = {
    function_updates: [
      { function: 'Fe', proposed_strength: before + 0.05, proposed_confidence: 0.4 },
    ],
    axis_updates: [],
    reason: 'Unit-test proposal.',
  };
  assert.equal(await accept(store, proposal, NOW, 'reflection:missing'), false);
  assert.equal(await accept(store, proposal, NOW, 'reflection:' + entryId), true);
  assert.equal(await accept(store, proposal, NOW, 'reflection:' + entryId), false);
  const reopened = createInscapeStore(client);
  await reopened.getState().initialize();
  assert.equal(
    await accept(reopened, proposal, NOW, 'reflection:' + entryId),
    false,
    'reopening must not bypass the per-reflection limit',
  );
  const exploration = reopened.getState().space.self_subject.reflection_entries[0].exploration;
  await reopened.getState().updateExploration(entryId, { ...exploration, feedback: null }, NOW);
  assert.equal(
    reopened.getState().space.self_subject.type_profile.function_stack_posterior.Fe.strength,
    before,
  );
  assert.equal(
    reopened.getState().space.self_subject.reflection_entries[0].exploration.calibration,
    undefined,
  );
});

test('editing and deleting sources remove their readings, feedback, and reversible profile contributions', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INFP', NOW);
  const entryId = await store
    .getState()
    .addReflectionEntry('An original note.', NOW, reflectionFixture);
  await accept(
    store,
    {
      function_updates: [{ function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.4 }],
      axis_updates: [],
      reason: 'Unit-test contribution.',
    },
    NOW,
    'reflection:' + entryId,
  );
  const readingId = await store
    .getState()
    .addReading(
      {
        mode: 'today-read',
        relationship_id: null,
        source_ids: [entryId],
        evidence: 'An original note.',
        text: 'Stored reading fixture.',
        reference_type: 'INFP',
        other_reference_type: null,
        refusal: null,
      },
      NOW,
    );
  await store.getState().setReadingFeedback(readingId, 'accepted', NOW);
  await store.getState().editReflectionEntry(entryId, 'Revised in my own words.', NOW);
  const result = await client.load();
  assert.equal(result.snapshot.readings.length, 0);
  assert.equal(result.snapshot.self_subject.reflection_entries[0].exploration.read, undefined);
  assert.equal(
    result.snapshot.self_subject.type_profile.function_stack_posterior.Fe.strength,
    0.25,
  );
  await store.getState().deleteReflectionEntry(entryId, NOW);
  assert.equal((await client.load()).snapshot.self_subject.reflection_entries.length, 0);
});

test('relationship editing, local refusal history, reversible feedback, and ordinary deletion survive reload', async (t) => {
  const { store, client } = await setup(t);
  const relId = await store.getState().addPerson('A friend', 'friend', NOW);
  await store.getState().editPerson(relId, 'Sam', 'partner', NOW);
  await store.getState().addCommunicationLog(relId, 'We talked about timing.', NOW);
  const logId = store.getState().space.relationships[0].communication_logs[0].id;
  const readingId = await store
    .getState()
    .addReading(
      {
        mode: 'friction-analysis',
        relationship_id: relId,
        source_ids: [logId],
        evidence: 'We talked about timing.',
        text: 'A saved interpretation fixture.',
        reference_type: null,
        other_reference_type: null,
        refusal: null,
      },
      NOW,
    );
  await store.getState().setReadingFeedback(readingId, 'accepted', NOW);
  await store.getState().setReadingFeedback(readingId, 'rejected', NOW);
  await store.getState().setReadingFeedback(readingId, null, NOW);
  const refusalId = await store
    .getState()
    .addReading(
      {
        mode: 'communication-rewrite',
        relationship_id: relId,
        source_ids: [],
        evidence: 'You must decide tonight.',
        text: '',
        reference_type: null,
        other_reference_type: null,
        refusal: 'decision_pressure',
      },
      NOW,
    );
  assert.ok(refusalId);
  let loaded = (await client.load()).snapshot;
  assert.equal(loaded.other_subjects[0].display_name, 'Sam');
  assert.equal(loaded.relationships[0].nature, 'partner');
  assert.equal(loaded.readings[0].feedback, null);
  assert.equal(loaded.readings[1].refusal, 'decision_pressure');
  await store.getState().editCommunicationLog(relId, logId, 'A corrected observation.', NOW);
  assert.equal(store.getState().space.readings.length, 1);
  await store.getState().deletePerson(relId, NOW);
  loaded = (await client.load()).snapshot;
  assert.equal(loaded.other_subjects.length, 0);
  assert.equal(loaded.relationships.length, 0);
  assert.equal(loaded.readings.length, 0);
  assert.equal(loaded.quarantine.length, 0, 'ordinary deletion must not create an under-18 record');
});

test('replacing or removing a type prior preserves notes and withdraws old calibration contributions', async (t) => {
  const { store } = await setup(t);
  await store.getState().setInitialType('INFP', NOW);
  const entryId = await store
    .getState()
    .addReflectionEntry('A retained note.', NOW, reflectionFixture);
  await accept(
    store,
    {
      function_updates: [{ function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.4 }],
      axis_updates: [],
      reason: 'Unit-test contribution.',
    },
    NOW,
    'reflection:' + entryId,
  );
  await store.getState().setInitialType('INTJ', NOW);
  assert.equal(store.getState().space.self_subject.type_profile.leading_type, 'INTJ');
  assert.equal(
    store.getState().space.self_subject.reflection_entries[0].exploration.calibration,
    undefined,
  );
  await store.getState().setInitialType(null, NOW);
  assert.equal(store.getState().space.self_subject.type_profile, null);
  assert.equal(store.getState().space.self_subject.reflection_entries[0].text, 'A retained note.');
});

test('a changing dichotomy passes through uncertainty and rebuilds both type and Beebe positions', async (t) => {
  const { store } = await setup(t);
  await store.getState().setInitialType('INTJ', NOW);
  for (let i = 0; i < 8; i++) {
    const entryId = await store
      .getState()
      .addReflectionEntry('User-chosen source ' + i, NOW, reflectionFixture);
    const profile = store.getState().space.self_subject.type_profile;
    const value = Number((profile.dichotomy_distribution.E_I.value - 0.1).toFixed(2));
    assert.equal(
      await accept(
        store,
        {
          function_updates: [],
          axis_updates: [{ axis: 'E_I', proposed_value: value, proposed_confidence: 0.4 }],
          reason: 'Unit-test directional contribution.',
        },
        NOW,
        'reflection:' + entryId,
      ),
      true,
    );
    if (i === 5) {
      assert.equal(store.getState().space.self_subject.type_profile.leading_type, null);
      assert.equal(
        store.getState().space.self_subject.type_profile.beebe_archetype_inference,
        null,
      );
    }
  }
  const profile = store.getState().space.self_subject.type_profile;
  assert.equal(profile.leading_type, 'ENTJ');
  assert.equal(profile.beebe_archetype_inference.hero, 'Te');
});

test('accepting a stored type suggestion is explicit, subject-bound, and atomically records the decision', async (t) => {
  const { store, client } = await setup(t);
  const first = await store.getState().addPerson('First adult', 'friend', NOW);
  const second = await store.getState().addPerson('Second adult', 'friend', NOW);
  const subjectOf = (id) =>
    store.getState().space.relationships.find((r) => r.id === id).other_subject_id;
  const readingId = await store
    .getState()
    .addReading(
      {
        mode: 'type-suggestion',
        relationship_id: first,
        source_ids: [],
        evidence: 'Unit-test observation.',
        text: JSON.stringify({ type: 'ENTJ', confidence: 0.4, rationale: 'Unit-test suggestion.' }),
        reference_type: null,
        other_reference_type: null,
        refusal: null,
      },
      NOW,
    );
  assert.equal(store.getState().space.other_subjects[0].type_profile, null);
  assert.equal(
    await store.getState().setOtherSubjectType(subjectOf(second), 'ENTJ', NOW, readingId),
    false,
  );
  assert.equal(
    await store.getState().setOtherSubjectType(subjectOf(first), 'INFP', NOW, readingId),
    false,
  );
  assert.equal(
    await store.getState().setOtherSubjectType(subjectOf(first), 'ENTJ', NOW, readingId),
    true,
  );
  const loaded = (await client.load()).snapshot;
  assert.equal(loaded.other_subjects[0].type_profile.leading_type, 'ENTJ');
  assert.equal(loaded.other_subjects[1].type_profile, null);
  assert.equal(loaded.readings[0].feedback, 'accepted');
});

test('a delayed calibration cannot attach itself to a revised original', async (t) => {
  const { store } = await setup(t);
  await store.getState().setInitialType('INFP', NOW);
  const entryId = await store
    .getState()
    .addReflectionEntry('Original wording.', NOW, reflectionFixture);
  const proposal = {
    function_updates: [{ function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.4 }],
    axis_updates: [],
    reason: 'Unit-test delayed proposal.',
  };
  await store.getState().editReflectionEntry(entryId, 'Revised wording.', NOW);
  await store.getState().updateExploration(entryId, reflectionFixture, NOW);
  assert.equal(
    await store
      .getState()
      .applyAcceptedPosteriorUpdate(proposal, NOW, 'reflection:' + entryId, 'Original wording.', proposalContext(store)),
    false,
  );
  assert.equal(
    await store
      .getState()
      .applyAcceptedPosteriorUpdate(proposal, NOW, 'reflection:' + entryId, 'Revised wording.', proposalContext(store)),
    true,
  );
});

test('a delayed calibration cannot use a replaced baseline or changed profile, but unrelated saves keep it valid', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INFP', NOW);
  const entryId = await store.getState().addReflectionEntry('A retained source.', NOW, reflectionFixture);
  const proposal = {
    function_updates: [{ function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.4 }],
    axis_updates: [],
    reason: 'Unit-test delayed contribution.',
  };
  const original = proposalContext(store);
  await store.getState().setInitialType('INFP', NOW);
  assert.equal(store.getState().space.self_subject.type_profile, original.profile,
    'even identical profile values must not revive evidence for a replaced baseline');
  assert.equal(await store.getState().applyAcceptedPosteriorUpdate(
    proposal, NOW, 'reflection:' + entryId, 'A retained source.', original,
  ), false);
  const current = proposalContext(store);
  await store.getState().setLocale('en', NOW);
  assert.equal(await store.getState().applyAcceptedPosteriorUpdate(
    proposal, NOW, 'reflection:' + entryId, 'A retained source.', current,
  ), true);
  const secondId = await store.getState().addReflectionEntry('A second source.', NOW, reflectionFixture);
  assert.equal(await store.getState().applyAcceptedPosteriorUpdate(
    proposal, NOW, 'reflection:' + secondId, 'A second source.', current,
  ), false, 'the first accepted contribution changed the current evidence');
  const snapshot = (await client.load()).snapshot;
  assert.equal(snapshot.self_subject.type_profile.function_stack_posterior.Fe.strength, 0.3);
  assert.equal(snapshot.self_subject.reflection_entries[1].exploration.calibration, undefined);
});
