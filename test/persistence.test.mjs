import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { InMemoryPersistenceAdapter } from '../src/product/persistence/in-memory-adapter.ts';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { clearInscapeSpace, loadInscapeSpace, saveInscapeSpace } from '../src-electron/persistence.ts';

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

test('Electron SQLite round-trips relational state with DB fail-close gates', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'inscape-sqlite-'));
  const space = createEmptyInscapeSpace('2026-06-05T00:00:00Z', true);
  saveInscapeSpace(root, JSON.stringify(space), true);
  assert.deepEqual(JSON.parse(loadInscapeSpace(root)), space);
  assert.equal(statSync(path.join(root, 'inscape.db')).mode & 0o777, 0o600);

  const db = new Database(path.join(root, 'inscape.db'));
  assert.throws(() => db.prepare("INSERT INTO subjects (id, kind, display_name, type_profile_json, age_attested_adult, age_attested_at, age_attestation_method) VALUES ('x', 'other_person', 'x', NULL, 0, '2026-06-05T00:00:00Z', 'test')").run(), /CHECK constraint failed/);
  db.close();
  assert.throws(() => saveInscapeSpace(root, JSON.stringify({ ...space, attested_adult: false }), false), /adult attestation required/);
  clearInscapeSpace(root);
  assert.equal(loadInscapeSpace(root), null);
});
