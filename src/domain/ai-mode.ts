export const STRUCTURED_AI_MODES = [
  'today-read',
  'self-mirror',
  'dyad-insight',
  'type-suggestion',
  'communication-rewrite',
  'friction-analysis',
  'reflection-resonance',
  'inner-roundtable',
  'profile-calibration',
] as const;

export type StructuredAiMode = (typeof STRUCTURED_AI_MODES)[number];

export function isStructuredAiMode(value: unknown): value is StructuredAiMode {
  return typeof value === 'string' && (STRUCTURED_AI_MODES as readonly string[]).includes(value);
}
