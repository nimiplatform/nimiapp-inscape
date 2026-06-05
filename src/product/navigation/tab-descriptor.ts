// IS-IA-01 — exactly three primary faces. No fourth tab, no agent capsule.

export type FaceId = 'today' | 'relationship' | 'self';

export interface FaceDescriptor {
  readonly id: FaceId;
  readonly label: string;
  readonly hint: string;
}

export const FACES: readonly FaceDescriptor[] = [
  { id: 'today', label: '今日', hint: 'Today' },
  { id: 'relationship', label: '关系', hint: 'Relationship' },
  { id: 'self', label: '自我', hint: 'Self' },
];
