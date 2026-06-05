// IS-AI / IS-INFER — infer an other-person's 4-letter type from a short
// description (Mode A). Strict JSON + fail-close parse (the type field must be
// a valid code; a bad guess is dropped, not coerced). Pure.

import { isFourLetterType, type FourLetterType } from '../../domain/typology.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';

export interface InferredType {
  readonly type: FourLetterType;
  readonly confidence: number;
  readonly rationale: string;
}

export type InferTypeResult =
  | { ok: true; inferred: InferredType }
  | { ok: false; failure: { kind: 'invalid_json' | 'schema_violation'; detail: string } };

export function buildInferTypePrompt(description: string): AiPrompt {
  const system = [
    'You are Inscape. From a short description of a person, infer the single most likely Jungian 16-type 4-letter code.',
    'Return ONLY a single JSON object — no markdown, no prose — matching:',
    '{"type":"<one of the 16 uppercase codes>","confidence":0..1,"rationale":"<short>"}.',
    'Keep confidence modest for thin descriptions. Do not invent codes outside the 16.',
  ].join(' ');
  return { system, user: `Description: ${description}` };
}

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
      failure: { kind: 'invalid_json', detail: error instanceof Error ? error.message : String(error) },
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return violation('inferred type must be a JSON object');
  }
  const record = parsed as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.toUpperCase() : '';
  if (!isFourLetterType(type)) {
    return violation(`unknown type: ${String(record.type)}`);
  }
  const confidence =
    typeof record.confidence === 'number' && record.confidence >= 0 && record.confidence <= 1
      ? record.confidence
      : 0.4;
  const rationale = typeof record.rationale === 'string' ? record.rationale : '';
  return { ok: true, inferred: { type: type as FourLetterType, confidence, rationale } };
}
