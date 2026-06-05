#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use serde::Serialize;

// Shared modules from the kit/shell/tauri crate (nimi-shell-tauri). Auth,
// OAuth, runtime bridge, runtime defaults, storage-root resolution, and
// session logging all come from the crate — this app owns only its own
// SQLite persistence seam.
use nimi_shell_tauri::auth_session_commands;
use nimi_shell_tauri::desktop_paths;
use nimi_shell_tauri::oauth_commands;
use nimi_shell_tauri::runtime_app_storage;
use nimi_shell_tauri::runtime_bridge;
use nimi_shell_tauri::runtime_defaults as defaults;
use nimi_shell_tauri::session_logging;

use rusqlite::Connection;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InscapeStorageDirs {
    nimi_dir: String,
    nimi_data_dir: String,
}

const INSCAPE_DB_FILE: &str = "inscape.db";

// Wave-1 minimal SQLite seam (G1 = keep locked SQLite). The full IS-DATA
// schema lands in wave-2. T1-04: attestation is gated at the DB level —
// `attested_adult` may only ever be 1, so a non-adult row cannot be stored.
const INSCAPE_SCHEMA: &str = "\
CREATE TABLE IF NOT EXISTS app_attestation (\
  id INTEGER PRIMARY KEY CHECK (id = 1),\
  attested_adult INTEGER NOT NULL CHECK (attested_adult = 1),\
  attested_at TEXT NOT NULL\
);\
CREATE TABLE IF NOT EXISTS inscape_space (\
  id INTEGER PRIMARY KEY CHECK (id = 1),\
  snapshot_json TEXT NOT NULL,\
  updated_at TEXT NOT NULL\
);";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InscapeStorageRootPayload {
    storage_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InscapeSpaceSavePayload {
    storage_root: String,
    snapshot_json: String,
    attested_adult: bool,
}

fn inscape_db_path(storage_root: &str) -> Result<std::path::PathBuf, String> {
    runtime_app_storage::scoped_storage_child(storage_root, "inscape data root", INSCAPE_DB_FILE)
}

fn open_inscape_db(storage_root: &str) -> Result<Connection, String> {
    let path = inscape_db_path(storage_root)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create inscape storage directory failed ({}): {error}",
                parent.display()
            )
        })?;
    }
    let conn = Connection::open(&path)
        .map_err(|error| format!("open inscape db failed ({}): {error}", path.display()))?;
    restrict_db_permissions(&path)?;
    conn.execute_batch(INSCAPE_SCHEMA)
        .map_err(|error| format!("inscape schema init failed: {error}"))?;
    Ok(conn)
}

#[cfg(unix)]
fn restrict_db_permissions(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    // T1-05: 0o600 on the SQLite file.
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|error| format!("set inscape db permissions failed ({}): {error}", path.display()))
}

#[cfg(not(unix))]
fn restrict_db_permissions(_path: &std::path::Path) -> Result<(), String> {
    // Windows ACL hardening lands in a later wave; the runtime-resolved data
    // root under the user profile already restricts cross-user access.
    Ok(())
}

#[tauri::command]
fn inscape_space_load(payload: InscapeStorageRootPayload) -> Result<Option<String>, String> {
    let path = inscape_db_path(&payload.storage_root)?;
    if !path.exists() {
        return Ok(None);
    }
    let conn = open_inscape_db(&payload.storage_root)?;
    match conn.query_row(
        "SELECT snapshot_json FROM inscape_space WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(json) => Ok(Some(json)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("load inscape space failed: {error}")),
    }
}

#[tauri::command]
fn inscape_space_save(payload: InscapeSpaceSavePayload) -> Result<(), String> {
    // Fail closed: the space is never persisted without an adult attestation.
    if !payload.attested_adult {
        return Err("inscape space save refused: adult attestation required".to_string());
    }
    let parsed: serde_json::Value = serde_json::from_str(&payload.snapshot_json)
        .map_err(|error| format!("inscape space JSON invalid: {error}"))?;
    if !parsed.is_object() {
        return Err("inscape space payload must be a JSON object".to_string());
    }
    let conn = open_inscape_db(&payload.storage_root)?;
    let now = now_iso8601();
    conn.execute(
        "INSERT INTO app_attestation (id, attested_adult, attested_at) VALUES (1, 1, ?1) \
         ON CONFLICT(id) DO UPDATE SET attested_adult = 1, attested_at = excluded.attested_at",
        rusqlite::params![now],
    )
    .map_err(|error| format!("write attestation failed: {error}"))?;
    conn.execute(
        "INSERT INTO inscape_space (id, snapshot_json, updated_at) VALUES (1, ?1, ?2) \
         ON CONFLICT(id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at",
        rusqlite::params![payload.snapshot_json, now],
    )
    .map_err(|error| format!("write inscape space failed: {error}"))?;
    Ok(())
}

#[tauri::command]
fn inscape_space_clear(payload: InscapeStorageRootPayload) -> Result<(), String> {
    let path = inscape_db_path(&payload.storage_root)?;
    if !path.exists() {
        return Ok(());
    }
    std::fs::remove_file(&path)
        .map_err(|error| format!("clear inscape space failed ({}): {error}", path.display()))
}

#[tauri::command]
fn get_storage_dirs() -> Result<InscapeStorageDirs, String> {
    let nimi_dir = desktop_paths::resolve_nimi_dir()?;
    let nimi_data_dir = desktop_paths::resolve_nimi_data_dir()?;
    Ok(InscapeStorageDirs {
        nimi_dir: nimi_dir.display().to_string(),
        nimi_data_dir: nimi_data_dir.display().to_string(),
    })
}

#[tauri::command]
fn inscape_start_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }

    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        window.start_dragging().map_err(|error| error.to_string())
    })) {
        Ok(result) => result,
        Err(_) => Err("window drag unavailable".to_string()),
    }
}

fn now_iso8601() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn load_dotenv_files() {
    let root_env_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env");
    if root_env_path.exists() {
        match dotenvy::from_path_iter(&root_env_path) {
            Ok(iter) => {
                for item in iter.flatten() {
                    let (key, value) = item;
                    let should_override = key.starts_with("NIMI_") || key.starts_with("VITE_NIMI_");
                    if should_override || std::env::var_os(&key).is_none() {
                        std::env::set_var(&key, &value);
                    }
                }
                eprintln!("[inscape] dotenv loaded path={}", root_env_path.display());
            }
            Err(error) => {
                eprintln!(
                    "[inscape] dotenv load failed path={} error={error}",
                    root_env_path.display()
                );
            }
        }
    }
}

fn configure_runtime_bridge_env() {
    if cfg!(debug_assertions) && std::env::var_os("NIMI_RUNTIME_BRIDGE_MODE").is_none() {
        std::env::set_var("NIMI_RUNTIME_BRIDGE_MODE", "RUNTIME");
    }
}

fn main() {
    load_dotenv_files();
    configure_runtime_bridge_env();
    session_logging::set_app_session_prefix("inscape");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("inscape main() entered");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_storage_dirs,
            inscape_space_load,
            inscape_space_save,
            inscape_space_clear,
            inscape_start_window_drag,
            defaults::runtime_defaults,
            auth_session_commands::auth_session_load,
            auth_session_commands::auth_session_save,
            auth_session_commands::auth_session_clear,
            oauth_commands::open_external_url,
            oauth_commands::oauth_token_exchange,
            oauth_commands::oauth_listen_for_code,
            runtime_bridge::runtime_bridge_unary,
            runtime_bridge::runtime_bridge_stream_open,
            runtime_bridge::runtime_bridge_stream_close,
            runtime_bridge::runtime_bridge_status,
            runtime_bridge::runtime_bridge_start,
            runtime_bridge::runtime_bridge_stop,
            runtime_bridge::runtime_bridge_restart,
            runtime_bridge::runtime_bridge_config_get,
            runtime_bridge::runtime_bridge_config_set,
            session_logging::log_renderer_event,
        ])
        .run(tauri::generate_context!())
        .expect("error running inscape");
}
