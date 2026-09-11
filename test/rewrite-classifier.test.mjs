import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRewriteContext } from '../src/product/relationship/rewrite-classifier.ts';

test('allows a normal boundaried draft', () => {
  const r = classifyRewriteContext(
    'Marcus, the timeline worries me — can we walk through it together this week?',
  );
  assert.equal(r.ok, true);
});

test('refuses a money context', () => {
  const r = classifyRewriteContext('you still owe me money from last month');
  assert.equal(r.ok, false);
  assert.equal(r.category, 'money');
});

test('refuses an employment context', () => {
  const r = classifyRewriteContext('I will ask your manager to fire you');
  assert.equal(r.ok, false);
  assert.equal(r.category, 'employment');
});

test('refuses a sexual-consent context', () => {
  const r = classifyRewriteContext('we need to talk about consent');
  assert.equal(r.ok, false);
  assert.equal(r.category, 'sexual_consent');
});

test('refuses decision-pressure / ultimatum (Scenario 6)', () => {
  const r = classifyRewriteContext("if you don't apologize by tomorrow I'm not going to the party");
  assert.equal(r.ok, false);
  assert.equal(r.category, 'decision_pressure');
});

test('refuses a Chinese decision-pressure draft', () => {
  const r = classifyRewriteContext('如果你不道歉，否则我就不去了');
  assert.equal(r.ok, false);
  assert.equal(r.category, 'decision_pressure');
});

test('ordinary scheduling and polite conditions are not decision pressure', () => {
  for (const text of [
    "If you don't mind, could we meet for coffee?",
    'I will send you the photos by tomorrow.',
    "If you don't have time, I can bring dinner.",
    '如果你不方便，我们可以改天。',
  ])
    assert.equal(classifyRewriteContext(text).ok, true, text);
});

test('conditional threats remain guarded without treating every if-clause as a threat', () => {
  for (const text of [
    "If you don't agree, I'll expose your secrets.",
    'You must decide tonight.',
    '如果你不答应，我就曝光你的秘密。',
  ])
    assert.equal(classifyRewriteContext(text).category, 'decision_pressure', text);
});
