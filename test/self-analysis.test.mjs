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

test('self-mirror remains grounded in user notes without a type prior or shadow-pathology prompts', async () => {
  const { buildSelfMirrorPrompt } = await import('../src/product/self/self-prompts.ts');
  const prompt = buildSelfMirrorPrompt(null, 'en', ['I want to rest and also try a new class.']);
  assert.deepEqual(JSON.parse(prompt.user).observations, [
    'I want to rest and also try a new class.',
  ]);
  assert.deepEqual(JSON.parse(prompt.user).optionalLenses, []);
  assert.doesNotMatch(prompt.user, /demon|inferior|weakness|grip/);
  assert.match(prompt.system, /not a personality assessment/);
});
