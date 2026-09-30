export type AgeReviewSource = { readonly kind: 'reflection' | 'communication'; readonly id: string };

export interface AgeContextCorrection {
  readonly reason: 'not_current_age';
  readonly text: string;
  readonly reviewed_at: string;
}

export function isAgeContextCorrection(value: unknown, text: string): value is AgeContextCorrection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const context = value as Record<string, unknown>;
  return Object.keys(context).every((key) => ['reason', 'text', 'reviewed_at'].includes(key)) &&
    context.reason === 'not_current_age' && context.text === text &&
    typeof context.reviewed_at === 'string' && context.reviewed_at.endsWith('Z') &&
    Number.isFinite(Date.parse(context.reviewed_at));
}
