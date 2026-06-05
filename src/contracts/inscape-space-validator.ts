// IS-DATA fail-close validator. Every persistence read and write runs this;
// failure surfaces as a typed error, never a silent pass. Deeper IS-INFER
// posterior-shape checks land with the inference engine (wave-2.5).

import type { InscapeSpace } from '../domain/inscape-space.ts';
import { INSCAPE_SPACE_SCHEMA_VERSION } from '../domain/inscape-space.ts';
import type { Subject } from '../domain/subject.ts';
import type { Relationship } from '../domain/relationship.ts';

export type InscapeSpaceValidationError =
  | { kind: 'not_object' }
  | { kind: 'missing_field'; field: string }
  | { kind: 'invalid_field'; field: string; reason: string };

export type InscapeSpaceValidationResult =
  | { ok: true }
  | { ok: false; error: InscapeSpaceValidationError };

const OK: InscapeSpaceValidationResult = { ok: true };
function missing(field: string): InscapeSpaceValidationResult {
  return { ok: false, error: { kind: 'missing_field', field } };
}
function invalid(field: string, reason: string): InscapeSpaceValidationResult {
  return { ok: false, error: { kind: 'invalid_field', field, reason } };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.length > 0;
}

function validateAgeAttestation(value: unknown, path: string): InscapeSpaceValidationResult {
  if (!isObject(value)) return invalid(path, 'must be an object');
  if (typeof value.attested_adult !== 'boolean') return missing(`${path}.attested_adult`);
  if (!isNonEmptyString(value.attested_at)) return missing(`${path}.attested_at`);
  if (!isNonEmptyString(value.attestation_method)) return missing(`${path}.attestation_method`);
  return OK;
}

function validateSubject(value: unknown, path: string): InscapeSpaceValidationResult {
  if (!isObject(value)) return invalid(path, 'must be an object');
  if (!isNonEmptyString(value.id)) return missing(`${path}.id`);
  if (value.kind !== 'self' && value.kind !== 'other_person') {
    return invalid(`${path}.kind`, 'must be "self" or "other_person"');
  }
  if (typeof value.display_name !== 'string') return missing(`${path}.display_name`);
  const ageRes = validateAgeAttestation(value.age_attestation, `${path}.age_attestation`);
  if (!ageRes.ok) return ageRes;
  for (const arr of ['typing_episodes', 'observation_events', 'reflection_entries'] as const) {
    if (!Array.isArray(value[arr])) return missing(`${path}.${arr}`);
  }
  // type_profile may be null until first typing; deep posterior shape is checked in wave-2.5.
  if (value.type_profile !== null && !isObject(value.type_profile)) {
    return invalid(`${path}.type_profile`, 'must be an object or null');
  }
  return OK;
}

function validateRelationship(value: unknown, path: string): InscapeSpaceValidationResult {
  if (!isObject(value)) return invalid(path, 'must be an object');
  if (!isNonEmptyString(value.id)) return missing(`${path}.id`);
  if (!isNonEmptyString(value.other_subject_id)) return missing(`${path}.other_subject_id`);
  if (!isNonEmptyString(value.nature)) return missing(`${path}.nature`);
  if (!isObject(value.type_dyad)) return missing(`${path}.type_dyad`);
  if (!Array.isArray(value.communication_logs)) return missing(`${path}.communication_logs`);
  if (!Array.isArray(value.friction_patterns)) return missing(`${path}.friction_patterns`);
  if (typeof value.observation_attested !== 'boolean') return missing(`${path}.observation_attested`);
  return OK;
}

export function validateInscapeSpace(space: InscapeSpace): InscapeSpaceValidationResult {
  if (!isObject(space)) return { ok: false, error: { kind: 'not_object' } };

  if (typeof space.schema_version !== 'number') return missing('schema_version');
  if (space.schema_version !== INSCAPE_SPACE_SCHEMA_VERSION) {
    return invalid('schema_version', `unsupported schema_version ${space.schema_version}`);
  }
  if (typeof space.attested_adult !== 'boolean') return missing('attested_adult');

  const selfRes = validateSubject(space.self_subject, 'self_subject');
  if (!selfRes.ok) return selfRes;
  const self = space.self_subject as Subject;
  if (self.kind !== 'self') return invalid('self_subject.kind', 'must be "self"');
  // IS-PRIV: an adult-attested space requires the self subject to be adult-attested.
  if (space.attested_adult && !self.age_attestation.attested_adult) {
    return invalid('self_subject.age_attestation.attested_adult', 'must be true when the space is adult-attested');
  }

  if (!Array.isArray(space.other_subjects)) return missing('other_subjects');
  for (let i = 0; i < space.other_subjects.length; i++) {
    const res = validateSubject(space.other_subjects[i], `other_subjects[${i}]`);
    if (!res.ok) return res;
    if ((space.other_subjects[i] as Subject).kind !== 'other_person') {
      return invalid(`other_subjects[${i}].kind`, 'must be "other_person"');
    }
  }

  if (!Array.isArray(space.relationships)) return missing('relationships');
  for (let i = 0; i < space.relationships.length; i++) {
    const res = validateRelationship(space.relationships[i] as Relationship, `relationships[${i}]`);
    if (!res.ok) return res;
  }

  if (!Array.isArray(space.quarantine)) return missing('quarantine');
  if (!isObject(space.settings)) return missing('settings');
  if (typeof space.settings.local_debug_logging !== 'boolean') {
    return missing('settings.local_debug_logging');
  }
  if (!isNonEmptyString(space.settings.locale)) return missing('settings.locale');

  if (!isNonEmptyString(space.created_at)) return missing('created_at');
  if (!isNonEmptyString(space.updated_at)) return missing('updated_at');

  return OK;
}
