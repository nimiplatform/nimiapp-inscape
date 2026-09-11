// IS-DATA fail-close validator. Every persistence read and write runs this;
// failure surfaces as a typed error, never a silent pass. Deeper IS-INFER
// posterior-shape checks land with the inference engine (wave-2.5).

import type { InscapeSpace } from '../domain/inscape-space.ts';
import { INSCAPE_SPACE_SCHEMA_VERSION } from '../domain/inscape-space.ts';
import { isInscapeLocale } from '../domain/locale.ts';
import type { Subject } from '../domain/subject.ts';
import type { CommunicationLog, Relationship } from '../domain/relationship.ts';
import { isSavedExploration } from '../domain/exploration.ts';
import { isSavedReading } from '../domain/reading.ts';
import {
  BEEBE_ARCHETYPES,
  COGNITIVE_FUNCTIONS,
  DICHOTOMIES,
  functionStackFor,
  isFourLetterType,
} from '../domain/typology.ts';
import { isUnitInterval, isSignedUnit } from '../domain/type-profile.ts';

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

function isProfile(value: unknown): boolean {
  if (value === null) return true;
  if (
    !isObject(value) ||
    !isObject(value.function_stack_posterior) ||
    !isObject(value.dichotomy_distribution)
  )
    return false;
  const functions = value.function_stack_posterior;
  const axes = value.dichotomy_distribution;
  if (
    !COGNITIVE_FUNCTIONS.every(
      (fn) =>
        isObject(functions[fn]) &&
        isUnitInterval(functions[fn].strength) &&
        isUnitInterval(functions[fn].confidence),
    )
  )
    return false;
  if (
    !DICHOTOMIES.every(
      (axis) =>
        isObject(axes[axis]) &&
        isSignedUnit(axes[axis].value) &&
        isUnitInterval(axes[axis].confidence) &&
        Array.isArray(axes[axis].sources) &&
        axes[axis].sources.every((s: unknown) => typeof s === 'string'),
    )
  )
    return false;
  if (value.leading_type === null) return value.beebe_archetype_inference === null;
  if (!isFourLetterType(value.leading_type) || !isObject(value.beebe_archetype_inference))
    return false;
  const stack = functionStackFor(value.leading_type);
  const beebe = value.beebe_archetype_inference;
  return BEEBE_ARCHETYPES.every((role, index) => beebe[role] === stack[index]);
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
  for (const entry of value.reflection_entries as unknown[]) {
    if (
      !isObject(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.created_at) ||
      typeof entry.text !== 'string'
    ) {
      return invalid(`${path}.reflection_entries`, 'invalid reflection');
    }
    if (entry.exploration !== undefined && !isSavedExploration(entry.exploration)) {
      return invalid(`${path}.reflection_entries.exploration`, 'invalid exploration');
    }
    if (
      isObject(entry.exploration) &&
      entry.exploration.calibration &&
      (!entry.exploration.read || entry.exploration.feedback !== 'accepted')
    )
      return invalid(
        `${path}.reflection_entries.calibration`,
        'calibration requires an accepted reading',
      );
  }
  // type_profile may be null until first typing; deep posterior shape is checked in wave-2.5.
  if (!isProfile(value.type_profile)) return invalid(`${path}.type_profile`, 'invalid profile');
  if (!isProfile(value.profile_baseline))
    return invalid(`${path}.profile_baseline`, 'invalid profile baseline');
  if ((value.profile_baseline === null) !== (value.type_profile === null))
    return invalid(
      `${path}.profile_baseline`,
      'profile and baseline must both exist or both be null',
    );
  return OK;
}

function validateRelationship(value: unknown, path: string): InscapeSpaceValidationResult {
  if (!isObject(value)) return invalid(path, 'must be an object');
  if (!isNonEmptyString(value.id)) return missing(`${path}.id`);
  if (!isNonEmptyString(value.other_subject_id)) return missing(`${path}.other_subject_id`);
  if (
    !['partner', 'parent', 'child', 'sibling', 'friend', 'coworker', 'mentor', 'other'].includes(
      String(value.nature),
    )
  )
    return invalid(`${path}.nature`, 'unknown relationship kind');
  if (!isObject(value.type_dyad)) return missing(`${path}.type_dyad`);
  if (!Array.isArray(value.communication_logs)) return missing(`${path}.communication_logs`);
  if (!Array.isArray(value.friction_patterns)) return missing(`${path}.friction_patterns`);
  if (typeof value.observation_attested !== 'boolean')
    return missing(`${path}.observation_attested`);
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
    return invalid(
      'self_subject.age_attestation.attested_adult',
      'must be true when the space is adult-attested',
    );
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
  const subjectIds = new Set(space.other_subjects.map((s) => s.id));
  if (space.relationships.some((r) => !subjectIds.has(r.other_subject_id)))
    return invalid('relationships', 'missing subject');
  if (!Array.isArray(space.readings)) return missing('readings');
  const relationIds = new Set(space.relationships.map((r) => r.id));
  const sourceIds = new Set([
    ...space.self_subject.reflection_entries.map((r) => r.id),
    ...space.relationships.flatMap((r) =>
      r.communication_logs.map((log: CommunicationLog) => log.id),
    ),
  ]);
  for (const reading of space.readings) {
    if (!isSavedReading(reading)) return invalid('readings', 'invalid reading');
    if (reading.relationship_id !== null && !relationIds.has(reading.relationship_id))
      return invalid('readings.relationship_id', 'missing relationship');
    if (reading.source_ids.some((id) => !sourceIds.has(id)))
      return invalid('readings.source_ids', 'missing source');
  }

  if (!Array.isArray(space.quarantine)) return missing('quarantine');
  if (!isObject(space.settings)) return missing('settings');
  if (typeof space.settings.local_debug_logging !== 'boolean') {
    return missing('settings.local_debug_logging');
  }
  if (!isNonEmptyString(space.settings.locale)) return missing('settings.locale');
  if (!isInscapeLocale(space.settings.locale)) {
    return invalid('settings.locale', 'must be "en" or "zh"');
  }

  if (!isNonEmptyString(space.created_at)) return missing('created_at');
  if (!isNonEmptyString(space.updated_at)) return missing('updated_at');

  return OK;
}
