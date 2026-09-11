import { chmodSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_FILE = 'inscape.db';

export const INSCAPE_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS space_meta (id INTEGER PRIMARY KEY CHECK (id = 1), schema_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app_attestation (id INTEGER PRIMARY KEY CHECK (id = 1), attested_adult INTEGER NOT NULL CHECK (attested_adult = 1), attested_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), local_debug_logging INTEGER NOT NULL CHECK (local_debug_logging IN (0, 1)), locale TEXT NOT NULL CHECK (locale IN ('en', 'zh')));
CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('self', 'other_person')), display_name TEXT NOT NULL, type_profile_json TEXT, profile_baseline_json TEXT, age_attested_adult INTEGER NOT NULL CHECK (age_attested_adult = 1), age_attested_at TEXT NOT NULL, age_attestation_method TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS typing_episodes (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, source TEXT NOT NULL, created_at TEXT NOT NULL, summary TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observation_events (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, source TEXT NOT NULL, created_at TEXT NOT NULL, note TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reflection_entries (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, created_at TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reflection_explorations (reflection_id TEXT PRIMARY KEY REFERENCES reflection_entries(id) ON DELETE CASCADE, exploration_json TEXT NOT NULL CHECK (json_valid(exploration_json)));
CREATE TABLE IF NOT EXISTS relationships (id TEXT PRIMARY KEY, other_subject_id TEXT NOT NULL, nature TEXT NOT NULL, dyad_self_type TEXT, dyad_other_type TEXT, observation_attested INTEGER NOT NULL CHECK (observation_attested = 1));
CREATE TABLE IF NOT EXISTS communication_logs (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE, created_at TEXT NOT NULL, snippet TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS friction_patterns (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE, created_at TEXT NOT NULL, summary TEXT NOT NULL, instance_count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quarantine (id TEXT PRIMARY KEY, quarantined_at TEXT NOT NULL, reason TEXT NOT NULL CHECK (reason = 'under_18_actual_knowledge'), payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, relationship_id TEXT REFERENCES relationships(id) ON DELETE CASCADE, reading_json TEXT NOT NULL CHECK (json_valid(reading_json)));
`;

type Row = Record<string, unknown>;

export function loadInscapeSpace(dataRoot: string): string | null {
  const file = dbPath(dataRoot);
  if (!existsSync(file)) return null;
  const db = openDatabase(dataRoot);
  try {
    const meta = db
      .prepare('SELECT schema_version, created_at, updated_at FROM space_meta WHERE id = 1')
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
    if (selfIndex < 0) throw new Error('inscape space is missing the self subject');
    const [selfSubject] = subjects.splice(selfIndex, 1);
    const relationships = (
      db.prepare('SELECT * FROM relationships ORDER BY rowid').all() as Row[]
    ).map((row) => ({
      id: row.id,
      other_subject_id: row.other_subject_id,
      nature: row.nature,
      type_dyad: { self_type: row.dyad_self_type ?? null, other_type: row.dyad_other_type ?? null },
      communication_logs: db
        .prepare(
          'SELECT id, created_at, snippet FROM communication_logs WHERE relationship_id = ? ORDER BY rowid',
        )
        .all(row.id),
      friction_patterns: db
        .prepare(
          'SELECT id, created_at, summary, instance_count FROM friction_patterns WHERE relationship_id = ? ORDER BY rowid',
        )
        .all(row.id),
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
): void {
  if (!attestedAdult) throw new Error('inscape space save refused: adult attestation required');
  const space = JSON.parse(snapshotJson) as Row;
  if (space.schema_version !== 2) throw new Error('unsupported Inscape schema version');
  const selfSubject = asRow(space.self_subject, 'self_subject');
  const selfAttestation = asRow(selfSubject.age_attestation, 'self age_attestation');
  if (space.attested_adult !== true || selfAttestation.attested_adult !== true) {
    throw new Error('inscape space save refused: adult attestation required');
  }
  const settings = asRow(space.settings, 'settings');
  if (settings.locale !== 'en' && settings.locale !== 'zh') throw new Error('unsupported locale');
  const db = openDatabase(dataRoot);
  const save = db.transaction(() => {
    for (const table of [
      'readings',
      'friction_patterns',
      'communication_logs',
      'relationships',
      'reflection_entries',
      'observation_events',
      'typing_episodes',
      'subjects',
      'quarantine',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare(
      'INSERT INTO space_meta (id, schema_version, created_at, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version=excluded.schema_version, created_at=excluded.created_at, updated_at=excluded.updated_at',
    ).run(space.schema_version, space.created_at, space.updated_at);
    db.prepare(
      'INSERT INTO app_attestation (id, attested_adult, attested_at) VALUES (1, 1, ?) ON CONFLICT(id) DO UPDATE SET attested_adult=1, attested_at=excluded.attested_at',
    ).run(space.updated_at);
    db.prepare(
      'INSERT INTO settings (id, local_debug_logging, locale) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET local_debug_logging=excluded.local_debug_logging, locale=excluded.locale',
    ).run(settings.local_debug_logging === true ? 1 : 0, settings.locale);
    insertSubject(db, selfSubject);
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
  } finally {
    db.close();
  }
}

export function clearInscapeSpace(dataRoot: string): void {
  const file = dbPath(dataRoot);
  if (existsSync(file)) unlinkSync(file);
}

function openDatabase(dataRoot: string): Database.Database {
  mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
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
      if (meta && meta.schema_version !== 2) {
        throw new Error('unsupported Inscape schema version');
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
  for (const entry of asRows(subject.observation_events, 'observation_events'))
    db.prepare(
      'INSERT INTO observation_events (id, subject_id, source, created_at, note) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.id, subject.id, entry.source, entry.created_at, entry.note);
  for (const entry of asRows(subject.reflection_entries, 'reflection_entries')) {
    db.prepare(
      'INSERT INTO reflection_entries (id, subject_id, created_at, text) VALUES (?, ?, ?, ?)',
    ).run(entry.id, subject.id, entry.created_at, entry.text);
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
      'INSERT INTO communication_logs (id, relationship_id, created_at, snippet) VALUES (?, ?, ?, ?)',
    ).run(entry.id, relationship.id, entry.created_at, entry.snippet);
  for (const entry of asRows(relationship.friction_patterns, 'friction_patterns'))
    db.prepare(
      'INSERT INTO friction_patterns (id, relationship_id, created_at, summary, instance_count) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.id, relationship.id, entry.created_at, entry.summary, entry.instance_count);
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
    observation_events: db
      .prepare(
        'SELECT id, source, created_at, note FROM observation_events WHERE subject_id = ? ORDER BY rowid',
      )
      .all(row.id),
    reflection_entries: (
      db
        .prepare(
          'SELECT r.id, r.created_at, r.text, e.exploration_json FROM reflection_entries r LEFT JOIN reflection_explorations e ON e.reflection_id = r.id WHERE r.subject_id = ? ORDER BY r.rowid',
        )
        .all(row.id) as Row[]
    ).map(({ exploration_json, ...entry }) => ({
      ...entry,
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
