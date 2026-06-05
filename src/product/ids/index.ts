// W-c01 — id factories.
//
// Single admitted strategy: ULID. Each entity gets a named factory so
// call sites read intentfully and so future per-entity policy changes
// (e.g. a different prefix or a different shape) localize here.

import { newUlid, type NewUlidOptions } from './ulid.ts';

export { newUlid, isUlid, ULID_PATTERN, ULID_LENGTH, ULID_ALPHABET } from './ulid.ts';
export type { NewUlidOptions } from './ulid.ts';

export function newConcernTagId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newEventMemoryId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newPlanItemId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newReadingId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newConversationId(options?: NewUlidOptions): string {
  return newUlid(options);
}

export function newConversationTurnId(options?: NewUlidOptions): string {
  return newUlid(options);
}
