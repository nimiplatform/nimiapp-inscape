// Canonical Inscape app identity (G2).
//
// Tauri `identifier`, Nimi Runtime caller id, and app-scoped AIConfig owner id
// must stay identical. Divergence splits runtime evidence from local app
// configuration and makes model bindings non-authoritative.
//
// Follows the live `ai.nimi.apps.<name>` convention (Inscape = ai.nimi.apps.inscape).
// The topic's earlier `nimi.inscape` locked-decision justification was stale.

export const INSCAPE_APP_ID = 'ai.nimi.apps.inscape';
export const INSCAPE_APP_INSTANCE_ID = `${INSCAPE_APP_ID}.local-first-party`;
export const INSCAPE_DEVICE_ID = 'local-first-party-device';
