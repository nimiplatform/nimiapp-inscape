// IS-DATA — Relationship between the self subject and an other_person subject.
//
// A Relationship records the user's own observations, NOT the other person's
// personal data file (IS-PRIV other-person attestation framing). Communication
// logs are user-pasted snippets only — never passive capture.

import type { FourLetterType } from './typology.ts';
import type { AgeContextCorrection } from './age-context.ts';

export type RelationshipNature =
  | 'partner'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'friend'
  | 'coworker'
  | 'mentor'
  | 'other';

export interface TypeDyad {
  readonly self_type: FourLetterType | null;
  readonly other_type: FourLetterType | null;
}

export interface CommunicationLog {
  readonly id: string;
  readonly created_at: string;
  /** User-pasted snippet only. */
  readonly snippet: string;
  readonly age_context?: AgeContextCorrection;
}

export interface Relationship {
  readonly id: string;
  /** References a Subject with kind 'other_person' in InscapeSpace.other_subjects. */
  readonly other_subject_id: string;
  readonly nature: RelationshipNature;
  readonly type_dyad: TypeDyad;
  readonly communication_logs: readonly CommunicationLog[];
  /** "My observations, based on adult-to-adult interaction" attestation checkbox. */
  readonly observation_attested: boolean;
}
