import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDyad } from '../src/product/relationship/dyad-analysis.ts';

test('INTP x ENTJ: shared N+T, differ E/I + J/P, same-axis-opposite-attitude', () => {
  const a = analyzeDyad('INTP', 'ENTJ');
  assert.deepEqual([...a.sharedDichotomies].sort(), ['S_N', 'T_F']);
  assert.deepEqual([...a.differingDichotomies].sort(), ['E_I', 'J_P']);
  assert.equal(a.selfDominant, 'Ti');
  assert.equal(a.otherDominant, 'Te');
  assert.equal(a.dominantRelation, 'same_axis_opposite_attitude');
  // each one's dominant sits at the other's opposing (position 5)
  assert.equal(a.selfDominantPositionInOther, 5);
  assert.equal(a.otherDominantPositionInSelf, 5);
});

test('identical types share every dichotomy and the dominant function', () => {
  const a = analyzeDyad('INFJ', 'INFJ');
  assert.equal(a.differingDichotomies.length, 0);
  assert.equal(a.dominantRelation, 'same_function');
  assert.deepEqual([...a.sharedEgoFunctions].sort(), ['Fe', 'Ni', 'Se', 'Ti']);
});

test('cross-axis dominants are classified different_axis', () => {
  const a = analyzeDyad('INTP', 'ESFJ'); // Ti vs Fe
  assert.equal(a.dominantRelation, 'different_axis');
});
