import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';
import { buildFrictionPrompt } from '../src/product/relationship/relationship-prompts.ts';

const NOW = '2026-06-05T00:00:00Z';

async function readyStore() {
  const client = new InMemoryPersistenceAdapter();
  const store = createInscapeStore(client);
  await store.getState().initialize();
  await store.getState().completeFirstRun(NOW);
  return { client, store };
}

test('addPerson creates an other_person subject + a relationship', async () => {
  const { client, store } = await readyStore();
  await store.getState().addPerson('Marcus', 'coworker', NOW);
  const space = store.getState().space;
  assert.equal(space.other_subjects.length, 1);
  assert.equal(space.other_subjects[0].kind, 'other_person');
  assert.equal(space.other_subjects[0].age_attestation.attested_adult, true);
  assert.equal(space.relationships.length, 1);
  assert.equal(space.relationships[0].observation_attested, true);
  const reload = await client.load();
  assert.equal(reload.ok, true);
  assert.equal(reload.snapshot.relationships[0].nature, 'coworker');
});

test('addCommunicationLog appends a user-pasted snippet to the relationship', async () => {
  const { store } = await readyStore();
  await store.getState().addPerson('Sam', 'partner', NOW);
  const relId = store.getState().space.relationships[0].id;
  await store.getState().addCommunicationLog(relId, 'we keep clashing on timing', NOW);
  const rel = store.getState().space.relationships[0];
  assert.equal(rel.communication_logs.length, 1);
  assert.equal(rel.communication_logs[0].snippet, 'we keep clashing on timing');
});

test('friction prompt is two-sided and blames neither party', () => {
  const prompt = buildFrictionPrompt(['a', 'b'], 'INTJ', 'partner');
  assert.match(prompt.system, /two-sided|blame neither/i);
  assert.match(prompt.user, /partner/);
});

test('quarantineOtherSubject removes the subject from analysis into quarantine', async () => {
  const { store } = await readyStore();
  await store.getState().addPerson('Lily', 'other', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  await store.getState().quarantineOtherSubject(subjectId, NOW);
  const space = store.getState().space;
  assert.equal(space.other_subjects.length, 0);
  assert.equal(space.relationships.length, 0);
  assert.equal(space.quarantine.length, 1);
  assert.equal(space.quarantine[0].reason, 'under_18_actual_knowledge');
});

test('deleteQuarantineRecord permanently removes the record', async () => {
  const { store } = await readyStore();
  await store.getState().addPerson('Lily', 'other', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  await store.getState().quarantineOtherSubject(subjectId, NOW);
  const recordId = store.getState().space.quarantine[0].id;
  await store.getState().deleteQuarantineRecord(recordId, NOW);
  assert.equal(store.getState().space.quarantine.length, 0);
});
