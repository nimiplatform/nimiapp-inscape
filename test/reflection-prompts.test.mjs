import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResonancePrompt,
  buildPosteriorProposalPrompt,
} from '../src/product/today/reflection-prompts.ts';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';

test('resonance prompt is explicitly non-diagnostic', () => {
  const prompt = buildResonancePrompt('felt scattered today', null);
  assert.match(prompt.system, /not a therapist|not a diagnostician|do not diagnose/i);
  assert.match(prompt.user, /felt scattered today/);
});

test('posterior proposal prompt demands strict JSON with the exact codes', () => {
  const profile = seedTypeProfileFromType('INTJ', '2026-06-05T00:00:00Z');
  const prompt = buildPosteriorProposalPrompt('reflection text', profile);
  assert.match(prompt.system, /ONLY a single JSON object/);
  assert.match(prompt.system, /function_updates/);
  assert.match(prompt.system, /dichotomy_updates/);
  // current posterior is summarized into the user message
  assert.match(prompt.user, /Ni /);
});
