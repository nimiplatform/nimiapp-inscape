// IS-DATA — Subject and its user-driven signal records.
//
// Every signal here is user-driven (test answers, reflection text, accept/reject
// on AI reads). No passive monitoring, no system/calendar/other-app reads
// (IS-PRIV hard constraint).

import type { TypeProfile } from './type-profile.ts';

export type SubjectKind = 'self' | 'other_person';

export type AttestationMethod =
  | 'first_run_checkbox'
  | 'other_person_checkbox'
  | 're_declaration';

/** 18+ attestation (IS-PRIV / T1-04). A subject is only analysed while adult-attested. */
export interface AgeAttestation {
  readonly attested_adult: boolean;
  readonly attested_at: string;
  readonly attestation_method: AttestationMethod;
}

export type TypingEpisodeSource = 'test_submission' | 'ai_inference' | 'user_calibration';

export interface TypingEpisode {
  readonly id: string;
  readonly source: TypingEpisodeSource;
  readonly created_at: string;
  readonly summary: string;
}

export type ObservationSource = 'self_report' | 'reflection' | 'ai_read_feedback';

export interface ObservationEvent {
  readonly id: string;
  readonly source: ObservationSource;
  readonly created_at: string;
  readonly note: string;
}

export interface ReflectionEntry {
  readonly id: string;
  readonly created_at: string;
  readonly text: string;
}

export interface Subject {
  readonly id: string;
  readonly kind: SubjectKind;
  readonly display_name: string;
  readonly age_attestation: AgeAttestation;
  /** Null until the first TypingEpisode produces a posterior. */
  readonly type_profile: TypeProfile | null;
  readonly typing_episodes: readonly TypingEpisode[];
  readonly observation_events: readonly ObservationEvent[];
  readonly reflection_entries: readonly ReflectionEntry[];
}
