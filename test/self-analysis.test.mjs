import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSelf } from '../src/product/self/self-analysis.ts';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';

test('analyzeSelf derives the Beebe ego positions + demon for INTP', () => {
  const a = analyzeSelf(seedTypeProfileFromType('INTP', '2026-06-05T00:00:00Z'));
  assert.equal(a.hero, 'Ti');
  assert.equal(a.parent, 'Ne');
  assert.equal(a.child, 'Si');
  assert.equal(a.inferior, 'Fe'); // anima — the growth + stress edge
  assert.equal(a.demon, 'Fi');
  assert.equal(a.loudest, 'Ti'); // seed makes the hero loudest
});
