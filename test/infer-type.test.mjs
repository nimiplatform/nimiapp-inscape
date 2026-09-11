import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInferredType } from '../src/domain/type-suggestion.ts';

test('parses a valid inferred type', () => {
  const r = parseInferredType(
    JSON.stringify({ type: 'ENTJ', confidence: 0.6, rationale: 'drives decisions' }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.inferred.type, 'ENTJ');
});

test('rejects a noncanonical code without silently coercing it', () => {
  const r = parseInferredType(JSON.stringify({ type: 'entp', confidence: 0.5, rationale: 'x' }));
  assert.equal(r.ok, false);
});

test('rejects an unknown type code', () => {
  const r = parseInferredType(JSON.stringify({ type: 'XXXX', confidence: 0.5, rationale: 'x' }));
  assert.equal(r.ok, false);
});

test('rejects invalid JSON', () => {
  const r = parseInferredType('{not json');
  assert.equal(r.ok, false);
  assert.equal(r.failure.kind, 'invalid_json');
});

test('does not fabricate missing or invalid confidence and rationale', () => {
  for (const value of [
    { type: 'INTJ' },
    { type: 'INTJ', confidence: 2, rationale: 'x' },
    { type: 'INTJ', confidence: 0.4 },
    { type: 'INTJ', confidence: 0.4, rationale: 'x', extra: true },
  ])
    assert.equal(parseInferredType(JSON.stringify(value)).ok, false);
});
