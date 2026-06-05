// Wave-1 fail-close validator for InscapeSpace. Every persistence read and
// write runs this; failure surfaces as a typed error, never a silent pass.
// The full IS-DATA validation (subject membership, quarantine invariants,
// removed-surface bans) lands in wave-2.

import type { InscapeSpace } from '../domain/inscape-space.ts';
import { INSCAPE_SPACE_SCHEMA_VERSION } from '../domain/inscape-space.ts';

export type InscapeSpaceValidationError =
  | { kind: 'not_object' }
  | { kind: 'missing_field'; field: string }
  | { kind: 'invalid_field'; field: string; reason: string };

export type InscapeSpaceValidationResult =
  | { ok: true }
  | { ok: false; error: InscapeSpaceValidationError };

export function validateInscapeSpace(space: InscapeSpace): InscapeSpaceValidationResult {
  if (!space || typeof space !== 'object') {
    return { ok: false, error: { kind: 'not_object' } };
  }
  if (typeof space.schema_version !== 'number') {
    return { ok: false, error: { kind: 'missing_field', field: 'schema_version' } };
  }
  if (space.schema_version !== INSCAPE_SPACE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        kind: 'invalid_field',
        field: 'schema_version',
        reason: `unsupported schema_version ${space.schema_version}`,
      },
    };
  }
  if (typeof space.attested_adult !== 'boolean') {
    return { ok: false, error: { kind: 'missing_field', field: 'attested_adult' } };
  }
  if (typeof space.created_at !== 'string' || space.created_at.length === 0) {
    return { ok: false, error: { kind: 'missing_field', field: 'created_at' } };
  }
  if (typeof space.updated_at !== 'string' || space.updated_at.length === 0) {
    return { ok: false, error: { kind: 'missing_field', field: 'updated_at' } };
  }
  return { ok: true };
}
