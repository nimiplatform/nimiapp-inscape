import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { createInscapeStore } from '../src/product/state/inscape-store.ts';
import { createInscapeStoreAiClient } from '../src/product/state/inscape-ai-client.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';
import { findUnder18Candidate } from '../src/product/privacy/age-disclosure.ts';
import { projectReflectionCalibration } from '../src/product/inference/derive-profile.ts';
import { parsePosteriorUpdateProposal } from '../src/product/inference/ai-proposal-parser.ts';
import { loadInscapeSpaceReply } from '../src-electron/persistence.ts';
import { resolveDevelopmentRendererUrl } from '../src-electron/renderer-url.ts';
import { buildTodaysReadPrompt } from '../src/product/today/today-prompts.ts';
import { sqliteClient, reflectionFixture } from './helpers/sqlite-client.mjs';

const NOW = '2026-09-30T00:00:00Z';
async function setup(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'inscape-remediation-'));
  const locks = [];
  t.after(() => { for (const db of locks) if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); });
  const client = sqliteClient(root);
  const store = createInscapeStore(client);
  await store.getState().initialize();
  assert.equal(await store.getState().completeFirstRun(NOW, 'zh'), true);
  return { root, client, store, locks };
}
async function acceptedNote(store, text = 'Synthetic arithmetic source.') {
  return store.getState().addReflectionEntry(text, NOW, reflectionFixture);
}
function context(store) {
  const subject = store.getState().space.self_subject;
  return { profile: subject.type_profile, baseline: subject.profile_baseline };
}
function proposal(strength) {
  return { function_updates: [{ function: 'Ni', proposed_strength: strength, proposed_confidence: 0.4 }], axis_updates: [], reason: 'Synthetic arithmetic proposal; no model evaluation.' };
}
async function accept(store, entryId, update) {
  const entry = store.getState().space.self_subject.reflection_entries.find((e) => e.id === entryId);
  return store.getState().applyAcceptedPosteriorUpdate(update, NOW, 'reflection:' + entryId, entry.text, context(store));
}

test('calibration preview equals the actual SQLite result and survives reload', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INTJ', NOW);
  const id = await acceptedNote(store);
  const subject = store.getState().space.self_subject;
  const projected = projectReflectionCalibration(subject.type_profile, subject.profile_baseline,
    subject.reflection_entries, id, proposal(0.9), NOW);
  assert.ok(projected);
  assert.equal(await accept(store, id, proposal(0.9)), true);
  assert.deepEqual((await client.load()).snapshot.self_subject.type_profile, projected.profile);
});

test('removing a negative contribution cannot turn a preview into a different committed value', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INTJ', NOW);
  const ids = [];
  for (const value of [0.75, 0.85, 0.95, 1]) {
    const id = await acceptedNote(store);
    ids.push(id);
    assert.equal(await accept(store, id, proposal(value)), true);
  }
  assert.equal(await store.getState().deleteReflectionEntry(ids[0], NOW), true);
  const before = store.getState().space.self_subject.type_profile;
  const id = await acceptedNote(store);
  const subject = store.getState().space.self_subject;
  const update = proposal(0.9);
  update.function_updates.push({ function: 'Fe', proposed_strength: 0.26, proposed_confidence: 0.4 });
  assert.equal(projectReflectionCalibration(before, subject.profile_baseline, subject.reflection_entries, id, update, NOW), null);
  assert.equal(await accept(store, id, update), false);
  assert.deepEqual(store.getState().space.self_subject.type_profile, before);
  assert.equal((await client.load()).snapshot.self_subject.reflection_entries.at(-1).exploration.calibration, undefined);
});

test('A_T is rejected as a whole even alongside a valid reflection target', () => {
  const update = proposal(0.9);
  update.axis_updates.push({ axis: 'A_T', proposed_value: 0.05, proposed_confidence: 0.1 });
  assert.equal(parsePosteriorUpdateProposal(JSON.stringify(update)).ok, false);
});

test('current minor-age declarations are distinguished from adult, quoted, historical and unrelated-person text', () => {
  for (const text of ['我今年17岁。', '我是十七岁。', '我未满18周岁。', '我还未成年。', 'I am 17 years old.', "I'm seventeen and reflecting today.", 'I am under eighteen.'])
    assert.equal(findUnder18Candidate(text), 'self', text);
  for (const text of ['我今年18岁。', '我17岁的时候很内向。', '我不是未成年。', '我说：“我今年17岁。”这是以前的日记。', 'I was 17 years old.', 'I am 17 years older than her.', 'Someone wrote "I am 17 years old."', "He said 'I am seventeen.'", 'I am 30. My son is 17 years old.'])
    assert.equal(findUnder18Candidate(text), null, text);
  assert.equal(findUnder18Candidate('小林今年17岁。', '小林'), 'other');
  assert.equal(findUnder18Candidate('She is 17 years old.', 'Lin', true), 'other');
  assert.equal(findUnder18Candidate('She is 17 years old.', 'Lin'), null);
});

test('confirmed self disclosure removes active SQLite subjects and cannot be bypassed by ordinary product actions or reload', async (t) => {
  const { store, client, root, locks } = await setup(t);
  await store.getState().addReflectionEntry('An existing adult-attested note.', NOW);
  const text = '我今年17岁，想了解自己。';
  const sourceId = await store.getState().addReflectionEntry(text, NOW);
  const review = store.getState().checkAgeDisclosure(text, NOW, undefined, { kind: 'reflection', id: sourceId });
  await setImmediate();
  assert.ok(store.getState().space, 'a text match does not quarantine');
  const pending = store.getState().ageReview;
  assert.equal(store.getState().resolveAgeReview(pending.id, { kind: 'confirmed_minor', subjectId: 'self' }), true);
  assert.equal(await review, false);
  assert.equal(store.getState().status, 'quarantined');
  assert.equal(store.getState().space, null);
  assert.equal(await store.getState().completeFirstRun(NOW), false);
  assert.equal(await store.getState().setInitialType('INTJ', NOW), false);
  assert.equal(await store.getState().addReflectionEntry('A later note.', NOW), '');
  const loaded = (await client.load()).snapshot;
  assert.equal(loaded.self_subject, null);
  assert.equal(validateInscapeSpace(loaded).ok, true);
  const payload = JSON.parse(loaded.quarantine.at(-1).payload_json);
  assert.equal(payload.subject.age_attestation.attested_adult, false);
  assert.equal(payload.subject.reflection_entries.length, 2);
  assert.match(payload.disclosure, /17/);
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM subjects').get().count, 0);
  assert.throws(() => db.prepare("INSERT INTO subjects (id,kind,display_name,age_attested_adult,age_attested_at,age_attestation_method) VALUES ('forged','self','',1,?,'test')").run(NOW), /self quarantine forbids/);
  db.close();
  assert.equal((await client.save(createEmptyInscapeSpace(NOW, true))).ok, false);
  const reopened = createInscapeStore(client); await reopened.getState().initialize();
  assert.equal(reopened.getState().status, 'quarantined');
  assert.equal(await reopened.getState().clearLocalData(), true);
  assert.equal(reopened.getState().status, 'first-run');
});

test('manual self re-declaration and confirmed review of an edited note close analysis', async (t) => {
  const first = await setup(t);
  assert.equal(await first.store.getState().quarantineSelf(NOW), true);
  assert.equal((await first.client.load()).snapshot.self_subject, null);
  const second = await setup(t);
  const id = await second.store.getState().addReflectionEntry('An original adult note.', NOW);
  assert.equal(await second.store.getState().editReflectionEntry(id, 'I am 16 years old.', NOW), true);
  const review = second.store.getState().checkAgeDisclosure('I am 16 years old.', NOW, undefined, { kind: 'reflection', id });
  await setImmediate();
  const pending = second.store.getState().ageReview;
  second.store.getState().resolveAgeReview(pending.id, { kind: 'confirmed_minor', subjectId: 'self' });
  assert.equal(await review, false);
  assert.equal((await second.client.load()).snapshot.self_subject, null);
});

test('identified relationship disclosure quarantines that person while preserving the adult self', async (t) => {
  const { store, client, root, locks } = await setup(t);
  const relationshipId = await store.getState().addPerson('小林', 'friend', NOW);
  const subjectId = store.getState().space.relationships[0].other_subject_id;
  const review = store.getState().checkAgeDisclosure('对方今年17岁。', NOW, subjectId);
  await setImmediate();
  const pending = store.getState().ageReview;
  store.getState().resolveAgeReview(pending.id, { kind: 'confirmed_minor', subjectId });
  assert.equal(await review, false);
  assert.equal(store.getState().status, 'ready');
  const space = (await client.load()).snapshot;
  assert.ok(space.self_subject);
  assert.equal(space.other_subjects.length, 0);
  assert.equal(space.relationships.length, 0);
  assert.match(JSON.parse(space.quarantine[0].payload_json).disclosure, /17/);
  assert.equal(await store.getState().addCommunicationLog(relationshipId, 'A later interaction.', NOW), false);
  assert.equal(await store.getState().checkAgeDisclosure('A later draft.', NOW, subjectId), false);
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  db.pragma('foreign_keys = ON');
  assert.throws(() => db.prepare("INSERT INTO relationships (id,other_subject_id,nature,observation_attested) VALUES ('orphan','missing','friend',1)").run(), /FOREIGN KEY/);
  db.close();
});

test('a locked quarantine save blocks processing immediately, cannot be cancelled and remains recoverable', { timeout: 15000 }, async (t) => {
  const { store, root, client, locks } = await setup(t);
  const before = store.getState().space;
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  db.exec('BEGIN EXCLUSIVE');
  const pending = store.getState().quarantineSelf(NOW);
  await setImmediate();
  assert.equal(store.getState().space, before, 'failed writes do not masquerade as a committed snapshot');
  assert.equal(store.getState().processingBlocked, true);
  assert.equal(store.getState().saveCanCancel, false);
  store.getState().cancelSave();
  assert.ok(store.getState().saveError);
  db.exec('ROLLBACK');
  assert.equal(await store.getState().retrySave(), true);
  assert.equal(await pending, true);
  assert.equal((await client.load()).snapshot.self_subject, null);
});

test('unsupported development versions are reported distinctly without changing the old database', (t) => {
  for (const version of [1, 2]) {
    const root = mkdtempSync(path.join(tmpdir(), 'inscape-old-version-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, 'inscape.db');
    const db = new Database(file);
    db.exec('CREATE TABLE space_meta (id INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL)');
    db.prepare('INSERT INTO space_meta VALUES (1, ?)').run(version); db.close();
    const before = readFileSync(file);
    assert.deepEqual(loadInscapeSpaceReply(root), { kind: 'schema_incompatible', storedVersion: version, expectedVersion: 3 });
    assert.deepEqual(readFileSync(file), before);
    const check = new Database(file);
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM sqlite_master WHERE type = ?').get('table').count, 1);
    check.close();
  }
});

test('environment and argument renderer URLs share strict validation, while production cannot use dev arguments', () => {
  for (const url of ['http://example.com:1431', 'https://127.0.0.1:1431', 'http://127.0.0.1:1431/path', 'http://user:pass@127.0.0.1:1431', 'http://localhost', 'http://localhost:0', 'http://localhost:1431?x=1']) {
    assert.throws(() => resolveDevelopmentRendererUrl([], url, false));
    assert.throws(() => resolveDevelopmentRendererUrl(['--nimi-dev-renderer-url=' + url], '', false));
  }
  assert.equal(resolveDevelopmentRendererUrl([], 'http://127.0.0.1:1431/', false), 'http://127.0.0.1:1431');
  assert.equal(resolveDevelopmentRendererUrl(['--nimi-dev-renderer-url=http://[::1]:1431'], '', false), 'http://[::1]:1431');
  assert.throws(() => resolveDevelopmentRendererUrl(['--nimi-dev-renderer-url=http://localhost:1431'], '', true));
  assert.equal(resolveDevelopmentRendererUrl([], 'http://example.com:1431', true), '');
});


test('hypothetical and recalled age matches require review and corrections survive reload without changing the source', async (t) => {
  for (const text of ['假如我今年17岁，我会怎么理解这件事？', '我记得我17岁，第一次参加比赛。', 'If I am 17 years old, what would this mean?']) {
    const { store, client } = await setup(t);
    const id = await store.getState().addReflectionEntry(text, NOW);
    const review = store.getState().checkAgeDisclosure(text, NOW, undefined, { kind: 'reflection', id });
    await setImmediate();
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().space.quarantine.length, 0);
    const pending = store.getState().ageReview;
    assert.ok(pending);
    assert.equal(store.getState().resolveAgeReview(pending.id, { kind: 'not_current_age' }), true);
    assert.equal(await review, true);
    const reopened = createInscapeStore(client); await reopened.getState().initialize();
    assert.equal(await reopened.getState().checkAgeDisclosure(text, NOW, undefined, { kind: 'reflection', id }), true);
    const entry = reopened.getState().space.self_subject.reflection_entries[0];
    assert.equal(entry.text, text);
    assert.equal(entry.age_context.reason, 'not_current_age');
    assert.equal(reopened.getState().space.quarantine.length, 0);
    await reopened.getState().editReflectionEntry(id, '我今年17岁。', NOW);
    const changed = reopened.getState().checkAgeDisclosure('我今年17岁。', NOW, undefined, { kind: 'reflection', id });
    await setImmediate();
    assert.ok(reopened.getState().ageReview, 'an edited source cannot reuse a previous context correction');
    reopened.getState().resolveAgeReview(reopened.getState().ageReview.id, { kind: 'cancel' });
    assert.equal(await changed, false);
    assert.equal(reopened.getState().space.quarantine.length, 0);
  }
});

test('review allows attribution correction before confirmed quarantine', async (t) => {
  const { store } = await setup(t);
  await store.getState().addPerson('Lin', 'friend', NOW);
  const otherId = store.getState().space.other_subjects[0].id;
  const pending = store.getState().checkAgeDisclosure('I am 17 years old.', NOW, otherId);
  await setImmediate();
  const review = store.getState().ageReview;
  assert.equal(review.candidateSubjectId, 'self');
  store.getState().resolveAgeReview(review.id, { kind: 'confirmed_minor', subjectId: otherId });
  assert.equal(await pending, false);
  assert.ok(store.getState().space.self_subject);
  assert.equal(store.getState().space.other_subjects.length, 0);
});

test('confirmed quarantine save failure has an explicit reset exit that resolves the pending action', { timeout: 15000 }, async (t) => {
  const { store, root, client, locks } = await setup(t);
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  db.exec('BEGIN EXCLUSIVE');
  const pending = store.getState().quarantineSelf(NOW);
  await setImmediate();
  assert.equal(store.getState().processingBlocked, true);
  db.exec('ROLLBACK'); db.close();
  assert.equal(await store.getState().clearLocalData(), true);
  assert.equal(await pending, false, 'the failed save is not reported as completed');
  assert.equal(store.getState().status, 'first-run');
  assert.equal((await client.load()).snapshot, null);
});

test('confirmed quarantine remains stopped across restart while SQLite is locked', { timeout: 15000 }, async (t) => {
  const { store, root, client, locks } = await setup(t);
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  db.exec('BEGIN EXCLUSIVE');
  const first = store.getState().quarantineSelf(NOW);
  await setImmediate();
  const intentFile = path.join(root, 'inscape-quarantine-pending.json');
  assert.equal(existsSync(intentFile), true);
  if (process.platform !== 'win32') assert.equal(statSync(intentFile).mode & 0o777, 0o600);
  const reopened = createInscapeStore(client);
  const initializing = reopened.getState().initialize();
  await setImmediate();
  assert.equal(reopened.getState().processingBlocked, true);
  assert.equal(reopened.getState().space, null);
  assert.ok(reopened.getState().saveError);
  db.exec('ROLLBACK'); db.close();
  assert.equal(await reopened.getState().retrySave(), true);
  await initializing;
  assert.equal(reopened.getState().status, 'quarantined');
  assert.equal(existsSync(intentFile), false);
  assert.equal((await client.load()).snapshot.self_subject, null);
  // Resolve the old in-memory pending action, simulating its obsolete process.
  assert.equal(await store.getState().retrySave(), true);
  assert.equal(await first, true);
});

test('relationship context corrections belong to the exact shared moment and are invalidated by edits', async (t) => {
  const { store, client } = await setup(t);
  const relationshipId = await store.getState().addPerson('Lin', 'friend', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  const text = 'If she is 17 years old, what would that mean?';
  await store.getState().addCommunicationLog(relationshipId, text, NOW);
  const id = store.getState().space.relationships[0].communication_logs[0].id;
  const checking = store.getState().checkAgeDisclosure(text, NOW, subjectId, { kind: 'communication', id });
  await setImmediate();
  store.getState().resolveAgeReview(store.getState().ageReview.id, { kind: 'not_current_age' });
  assert.equal(await checking, true);
  const loaded = (await client.load()).snapshot;
  assert.equal(loaded.relationships[0].communication_logs[0].age_context.text, text);
  await store.getState().editCommunicationLog(relationshipId, id, 'She is 17 years old.', NOW);
  assert.equal((await client.load()).snapshot.relationships[0].communication_logs[0].age_context, undefined);
});

test('confirmed minor material in a self note and its derived readings and calibration leave active SQLite data', async (t) => {
  const { store, client } = await setup(t);
  await store.getState().setInitialType('INTJ', NOW);
  await store.getState().addPerson('小林', 'friend', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  const text = '小林今年17岁。今天我和小林发生了争执，想理解他的反应。';
  const sourceId = await acceptedNote(store, text);
  assert.equal(await accept(store, sourceId, proposal(0.9)), true);
  const original = store.getState().space.self_subject.reflection_entries[0];
  const unrelatedId = await store.getState().addReflectionEntry('An unrelated adult reflection.', NOW);
  const derivedId = await store.getState().addReading({
    mode: 'today-read', relationship_id: null, source_ids: [sourceId], evidence: text,
    text: 'A synthetic reading derived from the confirmed source.',
    reference_type: 'INTJ', other_reference_type: null, refusal: null,
  }, NOW);
  const unrelatedReadingId = await store.getState().addReading({
    mode: 'today-read', relationship_id: null, source_ids: [unrelatedId], evidence: 'An unrelated adult reflection.',
    text: 'A separate synthetic reading.', reference_type: 'INTJ', other_reference_type: null, refusal: null,
  }, NOW);
  assert.ok(derivedId && unrelatedReadingId);
  const source = { kind: 'reflection', id: sourceId };
  const checking = store.getState().checkAgeDisclosure(text, NOW, undefined, source);
  await setImmediate();
  store.getState().resolveAgeReview(store.getState().ageReview.id, { kind: 'confirmed_minor', subjectId });
  assert.equal(await checking, false);
  const reopened = createInscapeStore(client); await reopened.getState().initialize();
  const space = reopened.getState().space;
  assert.equal(reopened.getState().status, 'ready');
  assert.deepEqual(space.self_subject.reflection_entries.map((entry) => entry.id), [unrelatedId]);
  assert.deepEqual(space.readings.map((reading) => reading.id), [unrelatedReadingId]);
  assert.equal(space.self_subject.type_profile.function_stack_posterior.Ni.strength, 0.85);
  const removed = JSON.parse(space.quarantine.at(-1).payload_json);
  assert.deepEqual(removed.source, source);
  assert.deepEqual(removed.reflection_entries, [original]);
  assert.deepEqual(removed.readings.map((reading) => reading.id), [derivedId]);
  assert.equal(await reopened.getState().checkAgeDisclosure(text, NOW, undefined, source), false);
  assert.equal(await reopened.getState().updateExploration(sourceId, reflectionFixture, NOW, text), false);
  assert.equal(buildTodaysReadPrompt(space.self_subject.reflection_entries.map((entry) => entry.text), null).user.includes(text), false);
});

test('corrected attribution quarantines the confirmed shared moment while preserving the adult relationship', async (t) => {
  const { store, client } = await setup(t);
  const removedRelationshipId = await store.getState().addPerson('Lin', 'friend', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  const keptRelationshipId = await store.getState().addPerson('Rui', 'friend', NOW);
  const otherId = store.getState().space.other_subjects[1].id;
  const text = 'Lin is 17 years old. We talked about Lin today.';
  await store.getState().addCommunicationLog(keptRelationshipId, text, NOW);
  await store.getState().addCommunicationLog(keptRelationshipId, 'An unrelated adult interaction.', NOW);
  const sourceId = store.getState().space.relationships[1].communication_logs[0].id;
  const derivedId = await store.getState().addReading({
    mode: 'friction-analysis', relationship_id: keptRelationshipId, source_ids: [sourceId], evidence: text,
    text: 'Synthetic source-bound reading.', reference_type: null, other_reference_type: null, refusal: null,
  }, NOW);
  assert.ok(derivedId);
  const source = { kind: 'communication', id: sourceId };
  const checking = store.getState().checkAgeDisclosure(text, NOW, otherId, source);
  await setImmediate();
  store.getState().resolveAgeReview(store.getState().ageReview.id, { kind: 'confirmed_minor', subjectId });
  assert.equal(await checking, false);
  const space = (await client.load()).snapshot;
  assert.deepEqual(space.relationships.map((relationship) => relationship.id), [keptRelationshipId]);
  assert.deepEqual(space.relationships[0].communication_logs.map((log) => log.snippet), ['An unrelated adult interaction.']);
  assert.deepEqual(space.readings, []);
  const removed = JSON.parse(space.quarantine[0].payload_json);
  assert.deepEqual(removed.source, source);
  assert.equal(removed.communication_logs[0].id, sourceId);
  assert.equal(removed.communication_logs[0].relationship_id, keptRelationshipId);
  assert.equal(removed.relationships[0].id, removedRelationshipId);
});

test('a failed source quarantine retains its full recovery intent and stops stale clients after retry', { timeout: 15000 }, async (t) => {
  const { store, client, root, locks } = await setup(t);
  await store.getState().addPerson('Lin', 'friend', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  const text = 'Lin is 17 years old.';
  const sourceId = await store.getState().addReflectionEntry(text, NOW);
  const previous = store.getState().space;
  const ai = createInscapeStoreAiClient(store, undefined, () => { throw new Error('must not obtain runtime access'); });
  const checking = store.getState().checkAgeDisclosure(text, NOW, undefined, { kind: 'reflection', id: sourceId });
  await setImmediate();
  const db = new Database(path.join(root, 'inscape.db')); locks.push(db);
  db.exec('BEGIN EXCLUSIVE');
  store.getState().resolveAgeReview(store.getState().ageReview.id, { kind: 'confirmed_minor', subjectId });
  await setImmediate();
  assert.equal(store.getState().space, previous);
  assert.equal(store.getState().processingBlocked, true);
  const pending = (await client.load()).pendingQuarantine;
  assert.deepEqual(pending.self_subject.reflection_entries, []);
  assert.equal(JSON.parse(pending.quarantine[0].payload_json).reflection_entries[0].id, sourceId);
  assert.equal((await ai.generate({ mode: 'today-read', user: text })).failure.kind, 'processing_stopped');
  db.exec('ROLLBACK'); db.close();
  assert.equal(await store.getState().retrySave(), true);
  assert.equal(await checking, false);
  assert.equal(store.getState().processingBlocked, false);
  assert.equal((await ai.generate({ mode: 'today-read', user: text })).failure.kind, 'processing_stopped');
  assert.deepEqual((await client.load()).snapshot.self_subject.reflection_entries, []);
});

test('a completed other-person quarantine cannot revive an in-flight response after the block ends', async (t) => {
  const { store } = await setup(t);
  await store.getState().addPerson('Lin', 'friend', NOW);
  const subjectId = store.getState().space.other_subjects[0].id;
  await store.getState().addReflectionEntry('An adult reflection.', NOW);
  let finish;
  const ai = createInscapeStoreAiClient(store, undefined, () => ({
    aiConfig: { get: async () => ({ config: { capabilities: [{ capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } }] } }) },
    ai: { text: { generateCandidate: () => new Promise((resolve) => { finish = resolve; }) } },
  }));
  const pending = ai.generate({ mode: 'today-read', user: 'An adult reflection.' });
  await setImmediate();
  assert.equal(typeof finish, 'function');
  assert.equal(await store.getState().quarantineOtherSubject(subjectId, NOW), true);
  assert.equal(store.getState().processingBlocked, false);
  finish({ text: 'A late synthetic response.' });
  assert.equal((await pending).failure.kind, 'processing_stopped');
  const current = createInscapeStoreAiClient(store, undefined, () => ({
    aiConfig: { get: async () => ({ config: { capabilities: [{ capabilityContract: 'text.generate', route: { oneofKind: 'local', local: {} } }] } }) },
    ai: { text: { generateCandidate: async () => ({ text: 'A new synthetic response.' }) } },
  }));
  assert.equal((await current.generate({ mode: 'today-read', user: 'An adult reflection.' })).ok, true);
});
