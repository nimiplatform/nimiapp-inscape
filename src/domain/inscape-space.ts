// Wave-1 minimal InscapeSpace. The full IS-DATA model — Subject,
// TypingEpisode, ObservationEvent, Relationship, Reading, Reflection, and the
// under-18 quarantine region — lands in wave-2. This placeholder carries only
// the fields the persistence seam needs so the runtime / auth / persist
// baseline can be exercised end to end.

export const INSCAPE_SPACE_SCHEMA_VERSION = 1;

export interface InscapeSpace {
  readonly schema_version: number;
  /**
   * Locked 18+ posture: the space is only ever persisted once the adult
   * attestation is recorded. Enforced again at the SQLite layer
   * (CHECK (attested_adult = 1)).
   */
  readonly attested_adult: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export function createEmptyInscapeSpace(now: string, attestedAdult: boolean): InscapeSpace {
  return {
    schema_version: INSCAPE_SPACE_SCHEMA_VERSION,
    attested_adult: attestedAdult,
    created_at: now,
    updated_at: now,
  };
}
