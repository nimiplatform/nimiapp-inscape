// IS-DATA — InscapeSpace: the single local data root (persisted as the SQLite
// snapshot today; relational tables land in wave-2.4). Wave-2 entity model.

import type { AgeAttestation, Subject } from './subject.ts';
import type { Relationship } from './relationship.ts';

export const INSCAPE_SPACE_SCHEMA_VERSION = 1;

export interface InscapeSettings {
  /** Opt-in local-only debug log (Scenario 12). Never network telemetry. */
  readonly local_debug_logging: boolean;
  readonly locale: string;
}

/**
 * Under-18 actual-knowledge quarantine (IS-PRIV fail-close). When a subject is
 * found to be under 18, its rows are removed from analysis into this region and
 * never processed; the user may permanently delete them.
 */
export interface QuarantineRecord {
  readonly id: string;
  readonly quarantined_at: string;
  readonly reason: 'under_18_actual_knowledge';
  /** The removed subject's raw data, retained verbatim and never AI-processed. */
  readonly payload_json: string;
}

export interface InscapeSpace {
  readonly schema_version: number;
  /** Top-level 18+ gate (mirrors self_subject.age_attestation; DB CHECK enforces). */
  readonly attested_adult: boolean;
  readonly self_subject: Subject;
  readonly other_subjects: readonly Subject[];
  readonly relationships: readonly Relationship[];
  readonly quarantine: readonly QuarantineRecord[];
  readonly settings: InscapeSettings;
  readonly created_at: string;
  readonly updated_at: string;
}

function emptySelfSubject(now: string, attestedAdult: boolean): Subject {
  const age_attestation: AgeAttestation = {
    attested_adult: attestedAdult,
    attested_at: now,
    attestation_method: 'first_run_checkbox',
  };
  return {
    id: 'self',
    kind: 'self',
    display_name: '',
    age_attestation,
    type_profile: null,
    typing_episodes: [],
    observation_events: [],
    reflection_entries: [],
  };
}

export function createEmptyInscapeSpace(now: string, attestedAdult: boolean): InscapeSpace {
  return {
    schema_version: INSCAPE_SPACE_SCHEMA_VERSION,
    attested_adult: attestedAdult,
    self_subject: emptySelfSubject(now, attestedAdult),
    other_subjects: [],
    relationships: [],
    quarantine: [],
    settings: { local_debug_logging: false, locale: 'en' },
    created_at: now,
    updated_at: now,
  };
}
