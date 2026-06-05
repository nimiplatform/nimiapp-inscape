// IS-DATA — Inscape relational SQLite persistence (G1: keep locked SQLite).
//
// The renderer still hands the whole InscapeSpace snapshot across the bridge;
// the relational decomposition lives entirely here. Every entity is its own
// table with per-row CHECK constraints (T1-04): a subject row cannot exist
// unless adult-attested, a relationship row cannot exist without the
// observation attestation, and under-18 data lives only in the dedicated
// `quarantine` table — never joined into analysis.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use nimi_shell_tauri::runtime_app_storage;

const INSCAPE_DB_FILE: &str = "inscape.db";

pub const INSCAPE_SCHEMA: &str = "\
PRAGMA foreign_keys = ON;\
CREATE TABLE IF NOT EXISTS space_meta (\
  id INTEGER PRIMARY KEY CHECK (id = 1),\
  schema_version INTEGER NOT NULL,\
  created_at TEXT NOT NULL,\
  updated_at TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS app_attestation (\
  id INTEGER PRIMARY KEY CHECK (id = 1),\
  attested_adult INTEGER NOT NULL CHECK (attested_adult = 1),\
  attested_at TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS settings (\
  id INTEGER PRIMARY KEY CHECK (id = 1),\
  local_debug_logging INTEGER NOT NULL CHECK (local_debug_logging IN (0, 1)),\
  locale TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS subjects (\
  id TEXT PRIMARY KEY,\
  kind TEXT NOT NULL CHECK (kind IN ('self', 'other_person')),\
  display_name TEXT NOT NULL,\
  type_profile_json TEXT,\
  age_attested_adult INTEGER NOT NULL CHECK (age_attested_adult = 1),\
  age_attested_at TEXT NOT NULL,\
  age_attestation_method TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS typing_episodes (\
  id TEXT PRIMARY KEY,\
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,\
  source TEXT NOT NULL,\
  created_at TEXT NOT NULL,\
  summary TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS observation_events (\
  id TEXT PRIMARY KEY,\
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,\
  source TEXT NOT NULL,\
  created_at TEXT NOT NULL,\
  note TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS reflection_entries (\
  id TEXT PRIMARY KEY,\
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,\
  created_at TEXT NOT NULL,\
  text TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS relationships (\
  id TEXT PRIMARY KEY,\
  other_subject_id TEXT NOT NULL,\
  nature TEXT NOT NULL,\
  dyad_self_type TEXT,\
  dyad_other_type TEXT,\
  observation_attested INTEGER NOT NULL CHECK (observation_attested = 1)\
);\
CREATE TABLE IF NOT EXISTS communication_logs (\
  id TEXT PRIMARY KEY,\
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,\
  created_at TEXT NOT NULL,\
  snippet TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS friction_patterns (\
  id TEXT PRIMARY KEY,\
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,\
  created_at TEXT NOT NULL,\
  summary TEXT NOT NULL,\
  instance_count INTEGER NOT NULL\
);\
CREATE TABLE IF NOT EXISTS quarantine (\
  id TEXT PRIMARY KEY,\
  quarantined_at TEXT NOT NULL,\
  reason TEXT NOT NULL CHECK (reason = 'under_18_actual_knowledge'),\
  payload_json TEXT NOT NULL\
);";

// ---- snapshot mirror (serde shape == TS InscapeSpace, snake_case) ----

#[derive(Serialize, Deserialize)]
pub struct InscapeSpace {
    pub schema_version: i64,
    pub attested_adult: bool,
    pub self_subject: Subject,
    pub other_subjects: Vec<Subject>,
    pub relationships: Vec<Relationship>,
    pub quarantine: Vec<QuarantineRecord>,
    pub settings: Settings,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct Subject {
    pub id: String,
    pub kind: String,
    pub display_name: String,
    pub age_attestation: AgeAttestation,
    #[serde(default)]
    pub type_profile: Option<serde_json::Value>,
    pub typing_episodes: Vec<TypingEpisode>,
    pub observation_events: Vec<ObservationEvent>,
    pub reflection_entries: Vec<ReflectionEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct AgeAttestation {
    pub attested_adult: bool,
    pub attested_at: String,
    pub attestation_method: String,
}

#[derive(Serialize, Deserialize)]
pub struct TypingEpisode {
    pub id: String,
    pub source: String,
    pub created_at: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize)]
pub struct ObservationEvent {
    pub id: String,
    pub source: String,
    pub created_at: String,
    pub note: String,
}

#[derive(Serialize, Deserialize)]
pub struct ReflectionEntry {
    pub id: String,
    pub created_at: String,
    pub text: String,
}

#[derive(Serialize, Deserialize)]
pub struct Relationship {
    pub id: String,
    pub other_subject_id: String,
    pub nature: String,
    pub type_dyad: TypeDyad,
    pub communication_logs: Vec<CommunicationLog>,
    pub friction_patterns: Vec<FrictionPattern>,
    pub observation_attested: bool,
}

#[derive(Serialize, Deserialize)]
pub struct TypeDyad {
    pub self_type: Option<String>,
    pub other_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CommunicationLog {
    pub id: String,
    pub created_at: String,
    pub snippet: String,
}

#[derive(Serialize, Deserialize)]
pub struct FrictionPattern {
    pub id: String,
    pub created_at: String,
    pub summary: String,
    pub instance_count: i64,
}

#[derive(Serialize, Deserialize)]
pub struct QuarantineRecord {
    pub id: String,
    pub quarantined_at: String,
    pub reason: String,
    pub payload_json: String,
}

#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub local_debug_logging: bool,
    pub locale: String,
}

// ---- core (Connection-level, unit-testable) ----

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(INSCAPE_SCHEMA)
        .map_err(|e| format!("inscape schema init failed: {e}"))
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn insert_subject(tx: &Connection, subject: &Subject) -> Result<(), String> {
    let type_profile_text = match &subject.type_profile {
        Some(value) => Some(
            serde_json::to_string(value).map_err(|e| format!("type_profile serialize failed: {e}"))?,
        ),
        None => None,
    };
    tx.execute(
        "INSERT INTO subjects (id, kind, display_name, type_profile_json, age_attested_adult, age_attested_at, age_attestation_method) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            subject.id,
            subject.kind,
            subject.display_name,
            type_profile_text,
            bool_to_i64(subject.age_attestation.attested_adult),
            subject.age_attestation.attested_at,
            subject.age_attestation.attestation_method,
        ],
    )
    .map_err(|e| format!("insert subject {} failed: {e}", subject.id))?;
    for episode in &subject.typing_episodes {
        tx.execute(
            "INSERT INTO typing_episodes (id, subject_id, source, created_at, summary) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![episode.id, subject.id, episode.source, episode.created_at, episode.summary],
        )
        .map_err(|e| format!("insert typing_episode {} failed: {e}", episode.id))?;
    }
    for event in &subject.observation_events {
        tx.execute(
            "INSERT INTO observation_events (id, subject_id, source, created_at, note) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![event.id, subject.id, event.source, event.created_at, event.note],
        )
        .map_err(|e| format!("insert observation_event {} failed: {e}", event.id))?;
    }
    for entry in &subject.reflection_entries {
        tx.execute(
            "INSERT INTO reflection_entries (id, subject_id, created_at, text) VALUES (?1, ?2, ?3, ?4)",
            params![entry.id, subject.id, entry.created_at, entry.text],
        )
        .map_err(|e| format!("insert reflection_entry {} failed: {e}", entry.id))?;
    }
    Ok(())
}

fn insert_relationship(tx: &Connection, relationship: &Relationship) -> Result<(), String> {
    tx.execute(
        "INSERT INTO relationships (id, other_subject_id, nature, dyad_self_type, dyad_other_type, observation_attested) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            relationship.id,
            relationship.other_subject_id,
            relationship.nature,
            relationship.type_dyad.self_type,
            relationship.type_dyad.other_type,
            bool_to_i64(relationship.observation_attested),
        ],
    )
    .map_err(|e| format!("insert relationship {} failed: {e}", relationship.id))?;
    for log in &relationship.communication_logs {
        tx.execute(
            "INSERT INTO communication_logs (id, relationship_id, created_at, snippet) VALUES (?1, ?2, ?3, ?4)",
            params![log.id, relationship.id, log.created_at, log.snippet],
        )
        .map_err(|e| format!("insert communication_log {} failed: {e}", log.id))?;
    }
    for pattern in &relationship.friction_patterns {
        tx.execute(
            "INSERT INTO friction_patterns (id, relationship_id, created_at, summary, instance_count) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![pattern.id, relationship.id, pattern.created_at, pattern.summary, pattern.instance_count],
        )
        .map_err(|e| format!("insert friction_pattern {} failed: {e}", pattern.id))?;
    }
    Ok(())
}

pub fn save_space(conn: &mut Connection, space: &InscapeSpace) -> Result<(), String> {
    // Fail closed: never persist a non-adult-attested space.
    if !space.attested_adult || !space.self_subject.age_attestation.attested_adult {
        return Err("inscape space save refused: adult attestation required".to_string());
    }
    let tx = conn
        .transaction()
        .map_err(|e| format!("begin transaction failed: {e}"))?;
    // Full-replace (the snapshot is the complete state); children before parents.
    for table in [
        "friction_patterns",
        "communication_logs",
        "relationships",
        "reflection_entries",
        "observation_events",
        "typing_episodes",
        "subjects",
        "quarantine",
    ] {
        tx.execute(&format!("DELETE FROM {table}"), [])
            .map_err(|e| format!("clear {table} failed: {e}"))?;
    }
    tx.execute(
        "INSERT INTO space_meta (id, schema_version, created_at, updated_at) VALUES (1, ?1, ?2, ?3) \
         ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, created_at = excluded.created_at, updated_at = excluded.updated_at",
        params![space.schema_version, space.created_at, space.updated_at],
    )
    .map_err(|e| format!("write space_meta failed: {e}"))?;
    tx.execute(
        "INSERT INTO app_attestation (id, attested_adult, attested_at) VALUES (1, 1, ?1) \
         ON CONFLICT(id) DO UPDATE SET attested_adult = 1, attested_at = excluded.attested_at",
        params![space.updated_at],
    )
    .map_err(|e| format!("write attestation failed: {e}"))?;
    tx.execute(
        "INSERT INTO settings (id, local_debug_logging, locale) VALUES (1, ?1, ?2) \
         ON CONFLICT(id) DO UPDATE SET local_debug_logging = excluded.local_debug_logging, locale = excluded.locale",
        params![bool_to_i64(space.settings.local_debug_logging), space.settings.locale],
    )
    .map_err(|e| format!("write settings failed: {e}"))?;
    insert_subject(&tx, &space.self_subject)?;
    for subject in &space.other_subjects {
        insert_subject(&tx, subject)?;
    }
    for relationship in &space.relationships {
        insert_relationship(&tx, relationship)?;
    }
    for record in &space.quarantine {
        tx.execute(
            "INSERT INTO quarantine (id, quarantined_at, reason, payload_json) VALUES (?1, ?2, ?3, ?4)",
            params![record.id, record.quarantined_at, record.reason, record.payload_json],
        )
        .map_err(|e| format!("insert quarantine {} failed: {e}", record.id))?;
    }
    tx.commit().map_err(|e| format!("commit failed: {e}"))
}

fn read_subjects(conn: &Connection) -> Result<Vec<Subject>, String> {
    let mut stmt = conn
        .prepare("SELECT id, kind, display_name, type_profile_json, age_attested_adult, age_attested_at, age_attestation_method FROM subjects")
        .map_err(|e| format!("prepare subjects failed: {e}"))?;
    let base: Vec<(String, String, String, Option<String>, i64, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .map_err(|e| format!("query subjects failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("read subjects failed: {e}"))?;

    let mut subjects = Vec::with_capacity(base.len());
    for (id, kind, display_name, tp_json, aaa, aat, aam) in base {
        let type_profile = match tp_json {
            Some(text) => Some(
                serde_json::from_str(&text).map_err(|e| format!("type_profile parse failed: {e}"))?,
            ),
            None => None,
        };
        subjects.push(Subject {
            typing_episodes: read_typing_episodes(conn, &id)?,
            observation_events: read_observation_events(conn, &id)?,
            reflection_entries: read_reflection_entries(conn, &id)?,
            id,
            kind,
            display_name,
            age_attestation: AgeAttestation {
                attested_adult: aaa == 1,
                attested_at: aat,
                attestation_method: aam,
            },
            type_profile,
        });
    }
    Ok(subjects)
}

fn read_typing_episodes(conn: &Connection, subject_id: &str) -> Result<Vec<TypingEpisode>, String> {
    let mut stmt = conn
        .prepare("SELECT id, source, created_at, summary FROM typing_episodes WHERE subject_id = ?1")
        .map_err(|e| format!("prepare typing_episodes failed: {e}"))?;
    let mapped = stmt
        .query_map(params![subject_id], |row| {
            Ok(TypingEpisode {
                id: row.get(0)?,
                source: row.get(1)?,
                created_at: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| format!("query typing_episodes failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read typing_episodes failed: {e}"))?);
    }
    Ok(out)
}

fn read_observation_events(
    conn: &Connection,
    subject_id: &str,
) -> Result<Vec<ObservationEvent>, String> {
    let mut stmt = conn
        .prepare("SELECT id, source, created_at, note FROM observation_events WHERE subject_id = ?1")
        .map_err(|e| format!("prepare observation_events failed: {e}"))?;
    let mapped = stmt
        .query_map(params![subject_id], |row| {
            Ok(ObservationEvent {
                id: row.get(0)?,
                source: row.get(1)?,
                created_at: row.get(2)?,
                note: row.get(3)?,
            })
        })
        .map_err(|e| format!("query observation_events failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read observation_events failed: {e}"))?);
    }
    Ok(out)
}

fn read_reflection_entries(
    conn: &Connection,
    subject_id: &str,
) -> Result<Vec<ReflectionEntry>, String> {
    let mut stmt = conn
        .prepare("SELECT id, created_at, text FROM reflection_entries WHERE subject_id = ?1")
        .map_err(|e| format!("prepare reflection_entries failed: {e}"))?;
    let mapped = stmt
        .query_map(params![subject_id], |row| {
            Ok(ReflectionEntry {
                id: row.get(0)?,
                created_at: row.get(1)?,
                text: row.get(2)?,
            })
        })
        .map_err(|e| format!("query reflection_entries failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read reflection_entries failed: {e}"))?);
    }
    Ok(out)
}

fn read_relationships(conn: &Connection) -> Result<Vec<Relationship>, String> {
    let mut stmt = conn
        .prepare("SELECT id, other_subject_id, nature, dyad_self_type, dyad_other_type, observation_attested FROM relationships")
        .map_err(|e| format!("prepare relationships failed: {e}"))?;
    let base: Vec<(String, String, String, Option<String>, Option<String>, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })
        .map_err(|e| format!("query relationships failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("read relationships failed: {e}"))?;

    let mut relationships = Vec::with_capacity(base.len());
    for (id, other_subject_id, nature, dyad_self, dyad_other, attested) in base {
        relationships.push(Relationship {
            communication_logs: read_communication_logs(conn, &id)?,
            friction_patterns: read_friction_patterns(conn, &id)?,
            id,
            other_subject_id,
            nature,
            type_dyad: TypeDyad {
                self_type: dyad_self,
                other_type: dyad_other,
            },
            observation_attested: attested == 1,
        });
    }
    Ok(relationships)
}

fn read_communication_logs(
    conn: &Connection,
    relationship_id: &str,
) -> Result<Vec<CommunicationLog>, String> {
    let mut stmt = conn
        .prepare("SELECT id, created_at, snippet FROM communication_logs WHERE relationship_id = ?1")
        .map_err(|e| format!("prepare communication_logs failed: {e}"))?;
    let mapped = stmt
        .query_map(params![relationship_id], |row| {
            Ok(CommunicationLog {
                id: row.get(0)?,
                created_at: row.get(1)?,
                snippet: row.get(2)?,
            })
        })
        .map_err(|e| format!("query communication_logs failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read communication_logs failed: {e}"))?);
    }
    Ok(out)
}

fn read_friction_patterns(
    conn: &Connection,
    relationship_id: &str,
) -> Result<Vec<FrictionPattern>, String> {
    let mut stmt = conn
        .prepare("SELECT id, created_at, summary, instance_count FROM friction_patterns WHERE relationship_id = ?1")
        .map_err(|e| format!("prepare friction_patterns failed: {e}"))?;
    let mapped = stmt
        .query_map(params![relationship_id], |row| {
            Ok(FrictionPattern {
                id: row.get(0)?,
                created_at: row.get(1)?,
                summary: row.get(2)?,
                instance_count: row.get(3)?,
            })
        })
        .map_err(|e| format!("query friction_patterns failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read friction_patterns failed: {e}"))?);
    }
    Ok(out)
}

fn read_quarantine(conn: &Connection) -> Result<Vec<QuarantineRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, quarantined_at, reason, payload_json FROM quarantine")
        .map_err(|e| format!("prepare quarantine failed: {e}"))?;
    let mapped = stmt
        .query_map([], |row| {
            Ok(QuarantineRecord {
                id: row.get(0)?,
                quarantined_at: row.get(1)?,
                reason: row.get(2)?,
                payload_json: row.get(3)?,
            })
        })
        .map_err(|e| format!("query quarantine failed: {e}"))?;
    let mut out = Vec::new();
    for item in mapped {
        out.push(item.map_err(|e| format!("read quarantine failed: {e}"))?);
    }
    Ok(out)
}

pub fn load_space(conn: &Connection) -> Result<Option<InscapeSpace>, String> {
    let meta = conn
        .query_row(
            "SELECT schema_version, created_at, updated_at FROM space_meta WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(format!("read space_meta failed: {other}")),
        })?;
    let (schema_version, created_at, updated_at) = match meta {
        Some(values) => values,
        None => return Ok(None),
    };

    let attested_adult = conn
        .query_row(
            "SELECT attested_adult FROM app_attestation WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(|e| format!("read attestation failed: {e}"))?;

    let settings = conn
        .query_row(
            "SELECT local_debug_logging, locale FROM settings WHERE id = 1",
            [],
            |row| Ok(Settings { local_debug_logging: row.get::<_, i64>(0)? == 1, locale: row.get(1)? }),
        )
        .map_err(|e| format!("read settings failed: {e}"))?;

    let mut subjects = read_subjects(conn)?;
    let self_index = subjects.iter().position(|s| s.kind == "self");
    let self_subject = match self_index {
        Some(index) => subjects.remove(index),
        None => return Err("inscape space is missing the self subject".to_string()),
    };

    Ok(Some(InscapeSpace {
        schema_version,
        attested_adult,
        self_subject,
        other_subjects: subjects,
        relationships: read_relationships(conn)?,
        quarantine: read_quarantine(conn)?,
        settings,
        created_at,
        updated_at,
    }))
}

// ---- Tauri command surface (path resolution + open + 0o600) ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageRootPayload {
    pub storage_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceSavePayload {
    pub storage_root: String,
    pub snapshot_json: String,
    pub attested_adult: bool,
}

fn db_path(storage_root: &str) -> Result<std::path::PathBuf, String> {
    runtime_app_storage::scoped_storage_child(storage_root, "inscape data root", INSCAPE_DB_FILE)
}

fn open_db(storage_root: &str) -> Result<Connection, String> {
    let path = db_path(storage_root)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("create inscape storage directory failed ({}): {e}", parent.display()))?;
    }
    let conn = Connection::open(&path)
        .map_err(|e| format!("open inscape db failed ({}): {e}", path.display()))?;
    restrict_db_permissions(&path)?;
    init_schema(&conn)?;
    Ok(conn)
}

#[cfg(unix)]
fn restrict_db_permissions(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    // T1-05: 0o600 on the SQLite file.
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("set inscape db permissions failed ({}): {e}", path.display()))
}

#[cfg(not(unix))]
fn restrict_db_permissions(_path: &std::path::Path) -> Result<(), String> {
    // Windows ACL hardening lands in a later wave; the runtime-resolved data root
    // under the user profile already restricts cross-user access.
    Ok(())
}

#[tauri::command]
pub fn inscape_space_load(payload: StorageRootPayload) -> Result<Option<String>, String> {
    let path = db_path(&payload.storage_root)?;
    if !path.exists() {
        return Ok(None);
    }
    let conn = open_db(&payload.storage_root)?;
    match load_space(&conn)? {
        Some(space) => Ok(Some(
            serde_json::to_string(&space).map_err(|e| format!("serialize inscape space failed: {e}"))?,
        )),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn inscape_space_save(payload: SpaceSavePayload) -> Result<(), String> {
    if !payload.attested_adult {
        return Err("inscape space save refused: adult attestation required".to_string());
    }
    let space: InscapeSpace = serde_json::from_str(&payload.snapshot_json)
        .map_err(|e| format!("inscape space JSON invalid: {e}"))?;
    let mut conn = open_db(&payload.storage_root)?;
    save_space(&mut conn, &space)
}

#[tauri::command]
pub fn inscape_space_clear(payload: StorageRootPayload) -> Result<(), String> {
    let path = db_path(&payload.storage_root)?;
    if !path.exists() {
        return Ok(());
    }
    std::fs::remove_file(&path)
        .map_err(|e| format!("clear inscape space failed ({}): {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_space() -> InscapeSpace {
        InscapeSpace {
            schema_version: 1,
            attested_adult: true,
            self_subject: Subject {
                id: "self".into(),
                kind: "self".into(),
                display_name: "".into(),
                age_attestation: AgeAttestation {
                    attested_adult: true,
                    attested_at: "2026-06-05T00:00:00Z".into(),
                    attestation_method: "first_run_checkbox".into(),
                },
                type_profile: None,
                typing_episodes: vec![TypingEpisode {
                    id: "ep1".into(),
                    source: "test_submission".into(),
                    created_at: "2026-06-05T00:00:00Z".into(),
                    summary: "first test".into(),
                }],
                observation_events: vec![],
                reflection_entries: vec![],
            },
            other_subjects: vec![Subject {
                id: "m1".into(),
                kind: "other_person".into(),
                display_name: "Marcus".into(),
                age_attestation: AgeAttestation {
                    attested_adult: true,
                    attested_at: "2026-06-05T00:00:00Z".into(),
                    attestation_method: "other_person_checkbox".into(),
                },
                type_profile: None,
                typing_episodes: vec![],
                observation_events: vec![],
                reflection_entries: vec![],
            }],
            relationships: vec![Relationship {
                id: "rel1".into(),
                other_subject_id: "m1".into(),
                nature: "coworker".into(),
                type_dyad: TypeDyad { self_type: None, other_type: None },
                communication_logs: vec![CommunicationLog {
                    id: "log1".into(),
                    created_at: "2026-06-05T00:00:00Z".into(),
                    snippet: "pasted".into(),
                }],
                friction_patterns: vec![],
                observation_attested: true,
            }],
            quarantine: vec![],
            settings: Settings { local_debug_logging: false, locale: "en".into() },
            created_at: "2026-06-05T00:00:00Z".into(),
            updated_at: "2026-06-05T00:00:00Z".into(),
        }
    }

    #[test]
    fn round_trips_a_relational_space() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let space = sample_space();
        save_space(&mut conn, &space).unwrap();
        let loaded = load_space(&conn).unwrap().expect("space present");
        assert_eq!(loaded.self_subject.id, "self");
        assert_eq!(loaded.self_subject.typing_episodes.len(), 1);
        assert_eq!(loaded.other_subjects.len(), 1);
        assert_eq!(loaded.other_subjects[0].id, "m1");
        assert_eq!(loaded.relationships.len(), 1);
        assert_eq!(loaded.relationships[0].communication_logs.len(), 1);
    }

    #[test]
    fn check_rejects_a_non_adult_subject_row() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let result = conn.execute(
            "INSERT INTO subjects (id, kind, display_name, type_profile_json, age_attested_adult, age_attested_at, age_attestation_method) \
             VALUES ('x', 'other_person', 'Lily', NULL, 0, '2026-06-05T00:00:00Z', 're_declaration')",
            [],
        );
        assert!(result.is_err(), "CHECK(age_attested_adult = 1) must reject a non-adult subject");
    }

    #[test]
    fn save_refuses_a_non_attested_space() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let mut space = sample_space();
        space.attested_adult = false;
        assert!(save_space(&mut conn, &space).is_err());
    }
}
