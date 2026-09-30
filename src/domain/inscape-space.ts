// IS-DATA — the single local SQLite data root.

import type { AgeAttestation, Subject } from './subject.ts';
import type { Relationship } from './relationship.ts';
import { DEFAULT_INSCAPE_LOCALE, type InscapeLocale } from './locale.ts';
import type { SavedReading } from './reading.ts';

export const INSCAPE_SPACE_SCHEMA_VERSION = 3;

export interface InscapeSettings {
  /** Opt-in local-only debug log (Scenario 12). Never network telemetry. */
  readonly local_debug_logging: boolean;
  readonly locale: InscapeLocale;
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

interface InscapeSpaceBase {
  readonly schema_version: number;
  /** Historical adult attestation; active subject rows also require the DB gate. */
  readonly attested_adult: boolean;
  readonly other_subjects: readonly Subject[];
  readonly relationships: readonly Relationship[];
  readonly readings: readonly SavedReading[];
  readonly quarantine: readonly QuarantineRecord[];
  readonly settings: InscapeSettings;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ActiveInscapeSpace extends InscapeSpaceBase {
  readonly self_subject: Subject;
}

// @nimi-authority: rule.inscape.privacy.r003
export interface QuarantinedInscapeSpace extends InscapeSpaceBase {
  readonly self_subject: null;
  readonly other_subjects: readonly [];
  readonly relationships: readonly [];
  readonly readings: readonly [];
}

export type InscapeSpace = ActiveInscapeSpace | QuarantinedInscapeSpace;

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
    profile_baseline: null,
    typing_episodes: [],
    reflection_entries: [],
  };
}

export function createEmptyInscapeSpace(
  now: string,
  attestedAdult: boolean,
  locale: InscapeLocale = DEFAULT_INSCAPE_LOCALE,
): ActiveInscapeSpace {
  return {
    schema_version: INSCAPE_SPACE_SCHEMA_VERSION,
    attested_adult: attestedAdult,
    self_subject: emptySelfSubject(now, attestedAdult),
    other_subjects: [],
    relationships: [],
    readings: [],
    quarantine: [],
    settings: { local_debug_logging: false, locale },
    created_at: now,
    updated_at: now,
  };
}
