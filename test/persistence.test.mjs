import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';

// Wave-1 baseline: the InscapeSpace fail-close validator + the in-memory
// PersistenceClient. The runtime-backed SQLite adapter is exercised by the
// app launch smoke (Increment 3), not the Node test runner.

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
