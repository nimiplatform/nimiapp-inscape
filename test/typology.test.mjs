import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COGNITIVE_FUNCTIONS,
  FOUR_LETTER_TYPES,
  functionStackFor,
  dominantFunction,
  inferiorFunction,
  functionAtArchetype,
} from '../src/domain/typology.ts';

// Attitude flip used to derive the Beebe shadow (positions 5–8) from the ego (1–4).
const FLIP = { Ni: 'Ne', Ne: 'Ni', Si: 'Se', Se: 'Si', Ti: 'Te', Te: 'Ti', Fi: 'Fe', Fe: 'Fi' };

test('there are 16 types and 8 functions', () => {
  assert.equal(FOUR_LETTER_TYPES.length, 16);
  assert.equal(COGNITIVE_FUNCTIONS.length, 8);
});

test('each type stack is a permutation of all 8 functions', () => {
  for (const t of FOUR_LETTER_TYPES) {
    const stack = functionStackFor(t);
    assert.equal(stack.length, 8, `${t} stack length`);
    assert.deepEqual([...stack].sort(), [...COGNITIVE_FUNCTIONS].sort(), `${t} permutation`);
  }
});

test('shadow (positions 5-8) is the attitude-flip of the ego (1-4)', () => {
  for (const t of FOUR_LETTER_TYPES) {
    const s = functionStackFor(t);
    for (let i = 0; i < 4; i++) {
      assert.equal(s[i + 4], FLIP[s[i]], `${t} position ${i + 1} shadow flip`);
    }
  }
});

test('archetype helpers resolve hero / anima / demon', () => {
  assert.equal(dominantFunction('INTJ'), 'Ni');
  assert.equal(inferiorFunction('INTJ'), 'Se');
  assert.equal(functionAtArchetype('INTJ', 'demon'), 'Si');
  assert.equal(functionAtArchetype('ENFP', 'hero'), 'Ne');
});
