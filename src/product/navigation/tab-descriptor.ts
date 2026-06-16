// IS-IA-01 — exactly three primary faces. No fourth tab, no agent capsule.

export type FaceId = 'today' | 'relationship' | 'self';

export interface FaceDescriptor {
  readonly id: FaceId;
}

export const FACES: readonly FaceDescriptor[] = [
  { id: 'today' },
  { id: 'relationship' },
  { id: 'self' },
];
