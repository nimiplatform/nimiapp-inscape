import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPosteriorProposalPrompt } from '../src/product/today/reflection-prompts.ts';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';

test('posterior proposal prompt demands strict JSON with the exact codes', () => {
  const profile = seedTypeProfileFromType('INTJ', '2026-06-05T00:00:00Z');
  const prompt = buildPosteriorProposalPrompt('reflection text', profile);
  assert.match(prompt.system, /ONLY a single JSON object/);
  assert.match(prompt.system, /function_updates/);
  assert.match(prompt.system, /axis_updates/);
  // current posterior is summarized into the user message
  assert.match(prompt.user, /Ni /);
});

test('posterior proposal prompt localizes reason language', () => {
  const profile = seedTypeProfileFromType('INTJ', '2026-06-05T00:00:00Z');
  const prompt = buildPosteriorProposalPrompt('reflection text', profile, 'en');
  assert.match(prompt.system, /reason value must be written in English/);
});

test('calibration receives the current signed axes and confidences, not just function strengths', () => {
  const profile = seedTypeProfileFromType('INFP', '2026-09-11T00:00:00Z');
  const prompt = buildPosteriorProposalPrompt('I worry about turning a friend down.', profile);
  const data = JSON.parse(prompt.user);
  assert.equal(data.currentFunctions.Fe.strength, 0.25);
  assert.equal(data.currentFunctions.Fe.confidence, 0.4);
  assert.equal(data.currentAxes.T_F.value, 0.6);
  assert.match(prompt.system, /ABSOLUTE proposed values, NOT deltas/);
  assert.match(prompt.system, /T_F -1=T,\+1=F/);
});
