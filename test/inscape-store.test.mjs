import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';
import {
  createEmptyInscapeSpace,
  INSCAPE_SPACE_SCHEMA_VERSION,
} from '../src/domain/inscape-space.ts';

import { reflectionFixture } from './helpers/sqlite-client.mjs';

const NOW = '2026-06-05T00:00:00Z';

test('initialize on an empty store enters first-run', async () => {
  const store = createInscapeStore(new InMemoryPersistenceAdapter());
  await store.getState().initialize();
  assert.equal(store.getState().status, 'first-run');
});

test('completeFirstRun persists an attested space and becomes ready', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW, 'zh');
  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().space.attested_adult, true);
  assert.equal(store.getState().space.settings.locale, 'zh');
  const reload = await client.load();
  assert.equal(reload.ok, true);
  assert.equal(reload.snapshot.self_subject.kind, 'self');
  assert.equal(reload.snapshot.settings.locale, 'zh');
});

test('initialize with an existing space becomes ready', async () => {
  const client = new InMemoryPersistenceAdapter(createEmptyInscapeSpace(NOW, true));
  const store = createInscapeStore(client);
  await store.getState().initialize();
  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().space.schema_version, INSCAPE_SPACE_SCHEMA_VERSION);
});

test('setLocale persists a supported locale', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW, 'zh');
  const saved = await store.getState().setLocale('en', '2026-06-06T00:00:00Z');
  assert.equal(saved, true);
  assert.equal(store.getState().space.settings.locale, 'en');
  assert.equal(store.getState().space.updated_at, '2026-06-06T00:00:00Z');
  const reload = await client.load();
  assert.equal(reload.snapshot.settings.locale, 'en');
});

test('setInitialType seeds the self type_profile and persists', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  await store.getState().setInitialType('INTJ', NOW);
  const profile = store.getState().space.self_subject.type_profile;
  assert.ok(profile);
  assert.equal(profile.leading_type, 'INTJ');
  assert.equal(store.getState().space.self_subject.typing_episodes.length, 1);
  const reload = await client.load();
  assert.equal(reload.ok, true);
  assert.ok(reload.snapshot.self_subject.type_profile);
});

test('addReflectionEntry appends and persists, returning the id', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  const id = await store.getState().addReflectionEntry('felt scattered today', NOW);
  assert.ok(id.length > 0);
  assert.equal(store.getState().space.self_subject.reflection_entries.length, 1);
  const reload = await client.load();
  assert.equal(reload.snapshot.self_subject.reflection_entries[0].text, 'felt scattered today');
});

test('addObservationEvent appends a user-driven signal and persists', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  await store.getState().addObservationEvent('today-read feedback: right', 'ai_read_feedback', NOW);
  const events = store.getState().space.self_subject.observation_events;
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'ai_read_feedback');
  const reload = await client.load();
  assert.equal(reload.snapshot.self_subject.observation_events.length, 1);
});

test('a single reflection cannot overwrite the profile with a large model jump', async () => {
  const store = createInscapeStore(new InMemoryPersistenceAdapter());
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  await store.getState().setInitialType('INFP', NOW);
  const before = store.getState().space.self_subject.type_profile;
  const sourceId = await store
    .getState()
    .addReflectionEntry('A short reflection.', NOW, reflectionFixture);
  const accepted = await store.getState().applyAcceptedPosteriorUpdate(
    {
      function_updates: [{ function: 'Fe', proposed_strength: 0.2, proposed_confidence: 0.4 }],
      axis_updates: [{ axis: 'T_F', proposed_value: 0.1, proposed_confidence: 0.4 }],
      reason: 'Live model regression: a large shift from one short reflection.',
    },
    NOW,
    'reflection:' + sourceId,
    'A short reflection.',
    { profile: before, baseline: store.getState().space.self_subject.profile_baseline },
  );
  assert.equal(accepted, false);
  assert.deepEqual(store.getState().space.self_subject.type_profile, before);
});
