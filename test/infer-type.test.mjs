import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInferredType } from '../src/product/relationship/infer-type.ts';

test('parses a valid inferred type', () => {
  const r = parseInferredType(
    JSON.stringify({ type: 'ENTJ', confidence: 0.6, rationale: 'drives decisions' }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.inferred.type, 'ENTJ');
});

test('normalizes a lowercase code', () => {
  const r = parseInferredType(JSON.stringify({ type: 'entp', confidence: 0.5, rationale: 'x' }));
  assert.equal(r.ok, true);
  assert.equal(r.inferred.type, 'ENTP');
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
