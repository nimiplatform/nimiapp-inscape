import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_FILE = 'inscape.db';
const QUARANTINE_INTENT_FILE = 'inscape-quarantine-pending.json';

export const INSCAPE_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS space_meta (id INTEGER PRIMARY KEY CHECK (id = 1), schema_version INTEGER NOT NULL, self_quarantined INTEGER NOT NULL CHECK (self_quarantined IN (0, 1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app_attestation (id INTEGER PRIMARY KEY CHECK (id = 1), attested_adult INTEGER NOT NULL CHECK (attested_adult = 1), attested_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), local_debug_logging INTEGER NOT NULL CHECK (local_debug_logging IN (0, 1)), locale TEXT NOT NULL CHECK (locale IN ('en', 'zh')));
CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('self', 'other_person')), display_name TEXT NOT NULL, type_profile_json TEXT, profile_baseline_json TEXT, age_attested_adult INTEGER NOT NULL CHECK (age_attested_adult = 1), age_attested_at TEXT NOT NULL, age_attestation_method TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS subjects_no_quarantined_self BEFORE INSERT ON subjects WHEN (SELECT self_quarantined FROM space_meta WHERE id = 1) = 1 BEGIN SELECT RAISE(ABORT, 'self quarantine forbids active subjects'); END;
CREATE TABLE IF NOT EXISTS typing_episodes (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, source TEXT NOT NULL, created_at TEXT NOT NULL, summary TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reflection_entries (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, created_at TEXT NOT NULL, text TEXT NOT NULL, age_context_json TEXT CHECK (age_context_json IS NULL OR json_valid(age_context_json)));
CREATE TABLE IF NOT EXISTS reflection_explorations (reflection_id TEXT PRIMARY KEY REFERENCES reflection_entries(id) ON DELETE CASCADE, exploration_json TEXT NOT NULL CHECK (json_valid(exploration_json)));
CREATE TABLE IF NOT EXISTS relationships (id TEXT PRIMARY KEY, other_subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, nature TEXT NOT NULL, dyad_self_type TEXT, dyad_other_type TEXT, observation_attested INTEGER NOT NULL CHECK (observation_attested = 1));
CREATE TABLE IF NOT EXISTS communication_logs (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE, created_at TEXT NOT NULL, snippet TEXT NOT NULL, age_context_json TEXT CHECK (age_context_json IS NULL OR json_valid(age_context_json)));
CREATE TABLE IF NOT EXISTS quarantine (id TEXT PRIMARY KEY, quarantined_at TEXT NOT NULL, reason TEXT NOT NULL CHECK (reason = 'under_18_actual_knowledge'), payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, relationship_id TEXT REFERENCES relationships(id) ON DELETE CASCADE, reading_json TEXT NOT NULL CHECK (json_valid(reading_json)));
`;

type Row = Record<string, unknown>;

export class InscapeSchemaVersionError extends Error {
  readonly expectedVersion = 3;
  readonly storedVersion: number;
  constructor(storedVersion: number) {
    super('unsupported Inscape schema version');
    this.storedVersion = storedVersion;
  }
}
export type InscapeLoadReply =
  | { kind: 'loaded'; snapshotJson: string | null }
  | { kind: 'quarantine_pending'; snapshotJson: string }
  | { kind: 'schema_incompatible'; storedVersion: number; expectedVersion: number };

export function loadInscapeSpaceReply(dataRoot: string): InscapeLoadReply {
  try {
    const final = path.join(dataRoot, QUARANTINE_INTENT_FILE);
    const pending = existsSync(final) ? final : final + '.tmp';
    if (existsSync(pending)) {
      chmodSync(dataRoot, 0o700);
      chmodSync(pending, 0o600);
      return { kind: 'quarantine_pending', snapshotJson: readFileSync(pending, 'utf8') };
    }
    return { kind: 'loaded', snapshotJson: loadInscapeSpace(dataRoot) };
  }
  catch (error) {
    if (error instanceof InscapeSchemaVersionError)
      return { kind: 'schema_incompatible', storedVersion: error.storedVersion, expectedVersion: error.expectedVersion };
    throw error;
  }
}

export function loadInscapeSpace(dataRoot: string): string | null {
  const pending = path.join(dataRoot, QUARANTINE_INTENT_FILE);
  if (existsSync(pending) || existsSync(pending + '.tmp')) throw new Error('quarantine recovery required');
  const file = dbPath(dataRoot);
  if (!existsSync(file)) return null;
  const db = openDatabase(dataRoot);
  try {
    const meta = db
      .prepare('SELECT schema_version, self_quarantined, created_at, updated_at FROM space_meta WHERE id = 1')
      .get() as Row | undefined;
    if (!meta) return null;
    const attestation = db
      .prepare('SELECT attested_adult FROM app_attestation WHERE id = 1')
      .get() as Row;
    const settings = db
      .prepare('SELECT local_debug_logging, locale FROM settings WHERE id = 1')
      .get() as Row;
    const subjects = (db.prepare('SELECT * FROM subjects ORDER BY rowid').all() as Row[]).map(
      (row) => readSubject(db, row),
    );
    const selfIndex = subjects.findIndex((subject) => subject.kind === 'self');
    if (meta.self_quarantined !== 1 && selfIndex < 0) throw new Error('inscape space is missing the self subject');
    if (meta.self_quarantined === 1 && subjects.length) throw new Error('quarantined space contains active subjects');
    const selfSubject = selfIndex < 0 ? null : subjects.splice(selfIndex, 1)[0];
    const relationships = (
      db.prepare('SELECT * FROM relationships ORDER BY rowid').all() as Row[]
    ).map((row) => ({
      id: row.id,
      other_subject_id: row.other_subject_id,
      nature: row.nature,
      type_dyad: { self_type: row.dyad_self_type ?? null, other_type: row.dyad_other_type ?? null },
      communication_logs: (db
        .prepare(
          'SELECT id, created_at, snippet, age_context_json FROM communication_logs WHERE relationship_id = ? ORDER BY rowid',
        )
        .all(row.id) as Row[]).map(({ age_context_json, ...log }) => ({
          ...log, ...(typeof age_context_json === 'string' ? { age_context: JSON.parse(age_context_json) } : {}),
        })),
      observation_attested: row.observation_attested === 1,
    }));
    return JSON.stringify({
      schema_version: meta.schema_version,
      attested_adult: attestation.attested_adult === 1,
      self_subject: selfSubject,
      other_subjects: subjects,
      relationships,
      readings: (db.prepare('SELECT reading_json FROM readings ORDER BY rowid').all() as Row[]).map(
        (row) => JSON.parse(String(row.reading_json)),
      ),
      quarantine: db
        .prepare('SELECT id, quarantined_at, reason, payload_json FROM quarantine ORDER BY rowid')
        .all(),
      settings: {
        local_debug_logging: settings.local_debug_logging === 1,
        locale: settings.locale,
      },
      created_at: meta.created_at,
      updated_at: meta.updated_at,
    });
  } finally {
    db.close();
  }
}

export function saveInscapeSpace(
  dataRoot: string,
  snapshotJson: string,
  attestedAdult: boolean,
  options: { confirmedQuarantine?: boolean } = {},
): void {
  if (!attestedAdult) throw new Error('inscape space save refused: adult attestation required');
  const space = JSON.parse(snapshotJson) as Row;
  if (space.schema_version !== 3) throw new InscapeSchemaVersionError(Number(space.schema_version));
  // @nimi-authority: rule.inscape.privacy.r003
  const selfSubject = space.self_subject === null ? null : asRow(space.self_subject, 'self_subject');
  if (space.attested_adult !== true || (selfSubject && asRow(selfSubject.age_attestation, 'self age_attestation').attested_adult !== true))
    throw new Error('inscape space save refused: adult attestation required');
  if (!selfSubject) {
    if ([space.other_subjects, space.relationships, space.readings].some((rows) => asRows(rows, 'active material').length > 0))
      throw new Error('quarantined space cannot contain active material');
    const hasSelf = asRows(space.quarantine, 'quarantine').some((record) => {
      try { return JSON.parse(String(record.payload_json)).subject?.kind === 'self'; }
      catch { return false; }
    });
    if (!hasSelf) throw new Error('self quarantine material required');
  }
  const settings = asRow(space.settings, 'settings');
  if (settings.locale !== 'en' && settings.locale !== 'zh') throw new Error('unsupported locale');
  const pendingFile = path.join(dataRoot, QUARANTINE_INTENT_FILE);
  if (options.confirmedQuarantine) {
    if (!asRows(space.quarantine, 'quarantine').length) throw new Error('confirmed quarantine material required');
    mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
    chmodSync(dataRoot, 0o700);
    const temporary = pendingFile + '.tmp';
    writeFileSync(temporary, snapshotJson, { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, pendingFile);
  } else if (existsSync(pendingFile) || existsSync(pendingFile + '.tmp')) {
    throw new Error('pending quarantine must be recovered before ordinary writes');
  }
  const db = openDatabase(dataRoot);
  const save = db.transaction(() => {
    const previous = db.prepare('SELECT self_quarantined FROM space_meta WHERE id = 1').get() as Row | undefined;
    if (previous?.self_quarantined === 1 && selfSubject)
      throw new Error('quarantined Inscape space requires explicit clear');
    for (const table of [
      'readings',
      'communication_logs',
      'relationships',
      'reflection_entries',
      'typing_episodes',
      'subjects',
      'quarantine',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare(
      'INSERT INTO space_meta (id, schema_version, self_quarantined, created_at, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version=excluded.schema_version, self_quarantined=excluded.self_quarantined, created_at=excluded.created_at, updated_at=excluded.updated_at',
    ).run(space.schema_version, selfSubject ? 0 : 1, space.created_at, space.updated_at);
    db.prepare(
      'INSERT INTO app_attestation (id, attested_adult, attested_at) VALUES (1, 1, ?) ON CONFLICT(id) DO UPDATE SET attested_adult=1, attested_at=excluded.attested_at',
    ).run(space.updated_at);
    db.prepare(
      'INSERT INTO settings (id, local_debug_logging, locale) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET local_debug_logging=excluded.local_debug_logging, locale=excluded.locale',
    ).run(settings.local_debug_logging === true ? 1 : 0, settings.locale);
    if (selfSubject) insertSubject(db, selfSubject);
    for (const subject of asRows(space.other_subjects, 'other_subjects'))
      insertSubject(db, subject);
    for (const relationship of asRows(space.relationships, 'relationships'))
      insertRelationship(db, relationship);
    for (const record of asRows(space.quarantine, 'quarantine')) {
      db.prepare(
        'INSERT INTO quarantine (id, quarantined_at, reason, payload_json) VALUES (?, ?, ?, ?)',
      ).run(record.id, record.quarantined_at, record.reason, record.payload_json);
    }
    for (const reading of asRows(space.readings, 'readings'))
      db.prepare('INSERT INTO readings (id, relationship_id, reading_json) VALUES (?, ?, ?)').run(
        reading.id,
        reading.relationship_id,
        JSON.stringify(reading),
      );
  });
  try {
    save();
    if (options.confirmedQuarantine && existsSync(pendingFile)) unlinkSync(pendingFile);
  } finally {
    db.close();
  }
}

export function clearInscapeSpace(dataRoot: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = dbPath(dataRoot) + suffix;
    if (existsSync(file)) unlinkSync(file);
  }
  for (const name of [QUARANTINE_INTENT_FILE, QUARANTINE_INTENT_FILE + '.tmp']) {
    const file = path.join(dataRoot, name);
    if (existsSync(file)) unlinkSync(file);
  }
}

function openDatabase(dataRoot: string): Database.Database {
  mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
  chmodSync(dataRoot, 0o700);
  const file = dbPath(dataRoot);
  const db = new Database(file, { timeout: 1000 });
  try {
    chmodSync(file, 0o600);
    if (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'space_meta'")
        .get()
    ) {
      const meta = db.prepare('SELECT schema_version FROM space_meta WHERE id = 1').get() as
        | Row
        | undefined;
      if (meta && meta.schema_version !== 3) {
        throw new InscapeSchemaVersionError(Number(meta.schema_version));
      }
    }
    db.exec(INSCAPE_SCHEMA);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

function dbPath(dataRoot: string): string {
  return path.join(dataRoot, DB_FILE);
}

function insertSubject(db: Database.Database, subject: Row): void {
  const age = asRow(subject.age_attestation, 'age_attestation');
  db.prepare(
    'INSERT INTO subjects (id, kind, display_name, type_profile_json, profile_baseline_json, age_attested_adult, age_attested_at, age_attestation_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    subject.id,
    subject.kind,
    subject.display_name,
    subject.type_profile == null ? null : JSON.stringify(subject.type_profile),
    subject.profile_baseline == null ? null : JSON.stringify(subject.profile_baseline),
    age.attested_adult === true ? 1 : 0,
    age.attested_at,
    age.attestation_method,
  );
  for (const entry of asRows(subject.typing_episodes, 'typing_episodes'))
    db.prepare(
      'INSERT INTO typing_episodes (id, subject_id, source, created_at, summary) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.id, subject.id, entry.source, entry.created_at, entry.summary);
  for (const entry of asRows(subject.reflection_entries, 'reflection_entries')) {
    db.prepare(
      'INSERT INTO reflection_entries (id, subject_id, created_at, text, age_context_json) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.id, subject.id, entry.created_at, entry.text, entry.age_context ? JSON.stringify(entry.age_context) : null);
    if (entry.exploration !== undefined)
      db.prepare(
        'INSERT INTO reflection_explorations (reflection_id, exploration_json) VALUES (?, ?)',
      ).run(entry.id, JSON.stringify(entry.exploration));
  }
}

function insertRelationship(db: Database.Database, relationship: Row): void {
  const dyad = asRow(relationship.type_dyad, 'type_dyad');
  db.prepare(
    'INSERT INTO relationships (id, other_subject_id, nature, dyad_self_type, dyad_other_type, observation_attested) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    relationship.id,
    relationship.other_subject_id,
    relationship.nature,
    dyad.self_type ?? null,
    dyad.other_type ?? null,
    relationship.observation_attested === true ? 1 : 0,
  );
  for (const entry of asRows(relationship.communication_logs, 'communication_logs'))
    db.prepare(
      'INSERT INTO communication_logs (id, relationship_id, created_at, snippet, age_context_json) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.id, relationship.id, entry.created_at, entry.snippet, entry.age_context ? JSON.stringify(entry.age_context) : null);

}

function readSubject(db: Database.Database, row: Row): Row {
  return {
    id: row.id,
    kind: row.kind,
    display_name: row.display_name,
    age_attestation: {
      attested_adult: row.age_attested_adult === 1,
      attested_at: row.age_attested_at,
      attestation_method: row.age_attestation_method,
    },
    type_profile:
      typeof row.type_profile_json === 'string' ? JSON.parse(row.type_profile_json) : null,
    profile_baseline:
      typeof row.profile_baseline_json === 'string' ? JSON.parse(row.profile_baseline_json) : null,
    typing_episodes: db
      .prepare(
        'SELECT id, source, created_at, summary FROM typing_episodes WHERE subject_id = ? ORDER BY rowid',
      )
      .all(row.id),
    reflection_entries: (
      db
        .prepare(
          'SELECT r.id, r.created_at, r.text, r.age_context_json, e.exploration_json FROM reflection_entries r LEFT JOIN reflection_explorations e ON e.reflection_id = r.id WHERE r.subject_id = ? ORDER BY r.rowid',
        )
        .all(row.id) as Row[]
    ).map(({ exploration_json, age_context_json, ...entry }) => ({
      ...entry,
      ...(typeof age_context_json === 'string' ? { age_context: JSON.parse(age_context_json) } : {}),
      ...(typeof exploration_json === 'string'
        ? { exploration: JSON.parse(exploration_json) }
        : {}),
    })),
  };
}

function asRow(value: unknown, label: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Row;
}

function asRows(value: unknown, label: string): Row[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry) => asRow(entry, label));
}
