import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';

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
  await store.getState().completeFirstRun(NOW);
  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().space.attested_adult, true);
  const reload = await client.load();
  assert.equal(reload.ok, true);
  assert.equal(reload.snapshot.self_subject.kind, 'self');
});

test('initialize with an existing space becomes ready', async () => {
  const client = new InMemoryPersistenceAdapter(createEmptyInscapeSpace(NOW, true));
  const store = createInscapeStore(client);
  await store.getState().initialize();
  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().space.schema_version, 1);
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

test('applyAcceptedPosteriorUpdate updates only the targeted posterior entry', async () => {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  await store.getState().setInitialType('INTJ', NOW);
  const before = store.getState().space.self_subject.type_profile.function_stack_posterior.Ni.strength;
  const proposal = {
    function_updates: [{ function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.5 }],
    dichotomy_updates: [],
    rationale: 'test',
  };
  await store.getState().applyAcceptedPosteriorUpdate(proposal, '2026-07-01T00:00:00Z', 'reflection:x');
  const profile = store.getState().space.self_subject.type_profile;
  assert.equal(profile.function_stack_posterior.Fe.strength, 0.3);
  assert.equal(profile.function_stack_posterior.Ni.strength, before); // untouched
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
