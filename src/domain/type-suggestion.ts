import { isFourLetterType, type FourLetterType } from './typology.ts';
export interface InferredType {
  readonly type: FourLetterType;
  readonly confidence: number;
  readonly rationale: string;
}

export type InferTypeResult =
  | { ok: true; inferred: InferredType }
  | { ok: false; failure: { kind: 'invalid_json' | 'schema_violation'; detail: string } };

function violation(detail: string): InferTypeResult {
  return { ok: false, failure: { kind: 'schema_violation', detail } };
}

export function parseInferredType(raw: string): InferTypeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      failure: {
        kind: 'invalid_json',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return violation('inferred type must be a JSON object');
  }
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !['type', 'confidence', 'rationale'].includes(key)) ||
    !isFourLetterType(record.type)
  )
    return violation('unknown type or extra field');
  if (
    typeof record.confidence !== 'number' ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1
  )
    return violation('invalid confidence');
  if (typeof record.rationale !== 'string' || !record.rationale.trim())
    return violation('missing rationale');
  return {
    ok: true,
    inferred: { type: record.type, confidence: record.confidence, rationale: record.rationale },
  };
}
