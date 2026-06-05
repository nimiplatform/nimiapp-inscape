import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTodaysReadPrompt,
  buildDecisionAidPrompt,
} from '../src/product/today/today-prompts.ts';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';

test("today's read prompt forbids predictions/horoscopes and grounds in reflections", () => {
  const prompt = buildTodaysReadPrompt(['busy meeting day', 'no time to think'], null);
  assert.match(prompt.system, /not a fortune teller|no predictions|no horoscopes/i);
  assert.match(prompt.user, /busy meeting day/);
});

test('decision aid prompt walks the eight functions in Beebe order, no prescription', () => {
  const profile = seedTypeProfileFromType('INTJ', '2026-06-05T00:00:00Z');
  const prompt = buildDecisionAidPrompt('take the job?', profile);
  assert.match(prompt.system, /eight Jungian cognitive functions/i);
  assert.match(prompt.system, /do NOT\s+prescribe|not prescribe/i);
  assert.match(prompt.user, /hero:Ni/); // INTJ hero is Ni
  assert.match(prompt.user, /take the job\?/);
});
