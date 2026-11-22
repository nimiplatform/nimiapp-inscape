import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';
import { createRuntimeStorageFixture } from './helpers/runtime-storage-client.mjs';

test('validateInscapeSpace accepts an empty attested space', () => {
  const space = createEmptyInscapeSpace('2026-06-05T00:00:00Z', true);
  assert.equal(validateInscapeSpace(space).ok, true);
});

test('validateInscapeSpace rejects a non-object', () => {
  assert.equal(validateInscapeSpace(null).ok, false);
});

test('validateInscapeSpace rejects an unsupported schema_version', () => {
  const result = validateInscapeSpace({
    schema_version: 999,
    attested_adult: true,
    created_at: '2026-06-05T00:00:00Z',
    updated_at: '2026-06-05T00:00:00Z',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.field, 'schema_version');
});

test('validateInscapeSpace rejects a missing attestation flag', () => {
  const result = validateInscapeSpace({
    schema_version: 1,
    created_at: '2026-06-05T00:00:00Z',
    updated_at: '2026-06-05T00:00:00Z',
  });
  assert.equal(result.ok, false);
});

test('in-memory adapter round-trips an attested space', async () => {
  const adapter = new InMemoryPersistenceAdapter();
  const space = createEmptyInscapeSpace('2026-06-05T00:00:00Z', true);
  assert.equal((await adapter.save(space)).ok, true);
  const load = await adapter.load();
  assert.equal(load.ok, true);
  assert.deepEqual(load.snapshot, space);
});

test('RuntimeStoragePersistenceAdapter round-trips state with fail-close adult gates', async () => {
  const { client } = createRuntimeStorageFixture();
  const space = createEmptyInscapeSpace('2026-06-05T00:00:00Z', true);
  assert.equal((await client.save(space)).ok, true);
  assert.deepEqual((await client.load()).snapshot, space);

  const unattested = await client.save({ ...space, attested_adult: false });
  assert.equal(unattested.ok, false);

  const unattestedOther = await client.save({
    ...space,
    other_subjects: [{
      id: 'x',
      kind: 'other_person',
      display_name: 'x',
      type_profile: null,
      age_attestation: { attested_adult: false, attested_at: '2026-06-05T00:00:00Z', method: 'test' },
      typing_episodes: [],
      reflection_entries: [],
    }],
  });
  assert.equal(unattestedOther.ok, false);

  assert.equal((await client.clear()).ok, true);
  assert.deepEqual(await client.load(), { ok: true, snapshot: null });
});
