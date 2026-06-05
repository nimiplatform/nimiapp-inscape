// IS-DATA — id factories. Single admitted strategy: ULID. Named per entity so
// call sites read intentfully and future per-entity policy localizes here.

import { newUlid, type NewUlidOptions } from './ulid.ts';

export { newUlid, isUlid, ULID_PATTERN, ULID_LENGTH, ULID_ALPHABET } from './ulid.ts';
export type { NewUlidOptions } from './ulid.ts';

export function newSubjectId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newTypingEpisodeId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newObservationEventId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newReflectionEntryId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newRelationshipId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newCommunicationLogId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newFrictionPatternId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newQuarantineId(options?: NewUlidOptions): string {
  return newUlid(options);
}
