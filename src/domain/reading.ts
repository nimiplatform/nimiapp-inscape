import { parseRewriteResult } from './rewrite.ts';
import { parseInferredType } from './type-suggestion.ts';
import type { FourLetterType } from './typology.ts';
import { isFourLetterType } from './typology.ts';
import type { StructuredAiMode } from './ai-mode.ts';

export type ReadingMode = Exclude<
  StructuredAiMode,
  'reflection-resonance' | 'inner-roundtable' | 'profile-calibration'
>;
export type ResonanceFeedback = 'accepted' | 'rejected' | null;
export type RefusalCategory = 'money' | 'employment' | 'sexual_consent' | 'decision_pressure';
export interface SavedReading {
  readonly id: string;
  readonly mode: ReadingMode;
  readonly created_at: string;
  readonly relationship_id: string | null;
  readonly source_ids: readonly string[];
  readonly evidence: string;
  readonly text: string;
  readonly reference_type: FourLetterType | null;
  readonly other_reference_type: FourLetterType | null;
  readonly feedback: ResonanceFeedback;
  readonly refusal: RefusalCategory | null;
}
export type NewReading = Omit<SavedReading, 'id' | 'created_at' | 'feedback'> & {
  readonly id?: string;
};

export function isSavedReading(value: unknown): value is SavedReading {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    r.refusal === null &&
    r.mode === 'communication-rewrite' &&
    (typeof r.text !== 'string' || !parseRewriteResult(r.text))
  )
    return false;
  if (r.mode === 'type-suggestion' && (typeof r.text !== 'string' || !parseInferredType(r.text).ok))
    return false;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    [
      'today-read',
      'self-mirror',
      'dyad-insight',
      'type-suggestion',
      'communication-rewrite',
      'friction-analysis',
    ].includes(String(r.mode)) &&
    typeof r.created_at === 'string' &&
    /^\d{4}-\d\d-\d\dT.*Z$/.test(r.created_at) &&
    (r.relationship_id === null || typeof r.relationship_id === 'string') &&
    Array.isArray(r.source_ids) &&
    r.source_ids.every((id) => typeof id === 'string') &&
    typeof r.evidence === 'string' &&
    typeof r.text === 'string' &&
    (r.reference_type === null || isFourLetterType(r.reference_type)) &&
    (r.other_reference_type === null || isFourLetterType(r.other_reference_type)) &&
    (r.feedback === null || r.feedback === 'accepted' || r.feedback === 'rejected') &&
    (r.refusal === null
      ? r.text.trim().length > 0
      : r.mode === 'communication-rewrite' &&
        r.feedback === null &&
        r.text === '' &&
        ['money', 'employment', 'sexual_consent', 'decision_pressure'].includes(String(r.refusal)))
  );
}
