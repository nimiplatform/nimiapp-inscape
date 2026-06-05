import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDyad } from '../src/product/relationship/dyad-analysis.ts';
import { dyadHeadline } from '../src/product/relationship/dyad-prompts.ts';
import {
  AXIS_OPPOSITE_DYNAMICS,
  DOMINANT_RELATION_DYNAMICS,
} from '../src/product/insight/dyad-knowledge.ts';

test('curated catalog covers every dominant relation + all four axes', () => {
  for (const relation of ['same_function', 'same_axis_opposite_attitude', 'different_axis']) {
    const dynamic = DOMINANT_RELATION_DYNAMICS[relation];
    assert.ok(dynamic.resonance && dynamic.friction && dynamic.bridge);
  }
  for (const axis of ['T', 'F', 'N', 'S']) {
    assert.ok(AXIS_OPPOSITE_DYNAMICS[axis]);
  }
});

test('INTP × ENTJ headline is the Ti×Te axis dynamic', () => {
  const a = analyzeDyad('INTP', 'ENTJ');
  assert.equal(a.dominantRelation, 'same_axis_opposite_attitude');
  assert.match(dyadHeadline(a), /Ti×Te/);
});

test('INTP × ISFJ headline falls back to the different-axis resonance', () => {
  const a = analyzeDyad('INTP', 'ISFJ');
  assert.equal(a.dominantRelation, 'different_axis');
  assert.match(dyadHeadline(a), /互补/);
});
