// Canonical Inscape app identity (G2).
//
// The Nimi app id is single-source across manifest, Runtime/SDK, storage,
// AIConfig, and Tauri bundle identity. The product slug remains `inscape`, but
// it is not an app identity.

export const INSCAPE_APP_ID = 'nimi.inscape';
export const INSCAPE_PRODUCT_SLUG = 'inscape';
export const INSCAPE_TAURI_IDENTIFIER = INSCAPE_APP_ID;
export const INSCAPE_APP_INSTANCE_ID = `${INSCAPE_APP_ID}.local-developer`;
export const INSCAPE_DEVICE_ID = 'inscape-local-developer-device';
