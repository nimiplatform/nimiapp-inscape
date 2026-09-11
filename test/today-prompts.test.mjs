import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTodaysReadPrompt } from '../src/product/today/today-prompts.ts';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';

test("today's read prompt forbids predictions/horoscopes and grounds in reflections", () => {
  const prompt = buildTodaysReadPrompt(['busy meeting day', 'no time to think'], null);
  assert.match(prompt.system, /not a fortune teller|no predictions|no horoscopes/i);
  assert.match(prompt.user, /busy meeting day/);
});

test("today's read grounds in the function stack when a profile exists", () => {
  const prompt = buildTodaysReadPrompt([], seedTypeProfileFromType('INTP', '2026-06-05T00:00:00Z'));
  assert.match(prompt.user, /Hero Ti/);
  assert.doesNotMatch(prompt.user, /inferior\/grip/);
  assert.match(prompt.system, /preference is not an impairment/);
});

test("today's read can explicitly request English output", () => {
  const prompt = buildTodaysReadPrompt(['busy meeting day'], null, 'en');
  assert.match(prompt.system, /Respond in clear, natural English/);
});
