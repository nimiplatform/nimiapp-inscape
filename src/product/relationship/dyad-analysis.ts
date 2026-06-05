// IS-TYPO — deterministic dyad analysis. Given two types, compute the
// cognitive-function-stack interplay (shared/differing axes, dominant-function
// relation, where each dominant sits in the other's Beebe stack, shared ego
// functions). This is the curated knowledge that GROUNDS the LLM narrative —
// the insight is derived from the stacks, not invented by the model. Pure +
// unit-testable.

import {
  DICHOTOMIES,
  functionStackFor,
  type CognitiveFunction,
  type Dichotomy,
  type FourLetterType,
} from '../../domain/typology.ts';

export type DominantRelation =
  | 'same_function'
  | 'same_axis_opposite_attitude'
  | 'different_axis';

export interface DyadAnalysis {
  readonly selfType: FourLetterType;
  readonly otherType: FourLetterType;
  readonly sharedDichotomies: readonly Dichotomy[];
  readonly differingDichotomies: readonly Dichotomy[];
  readonly selfDominant: CognitiveFunction;
  readonly otherDominant: CognitiveFunction;
  readonly dominantRelation: DominantRelation;
  /** 1-8: where self's dominant sits in the other's Beebe stack. */
  readonly selfDominantPositionInOther: number;
  /** 1-8: where the other's dominant sits in self's Beebe stack. */
  readonly otherDominantPositionInSelf: number;
  /** Functions present in both top-4 (ego) stacks. */
  readonly sharedEgoFunctions: readonly CognitiveFunction[];
}

function dichotomyPole(type: FourLetterType, dichotomy: Dichotomy): string | null {
  switch (dichotomy) {
    case 'E_I':
      return type[0];
    case 'S_N':
      return type[1];
    case 'T_F':
      return type[2];
    case 'J_P':
      return type[3];
    default:
      return null; // A_T is not encoded in the 4-letter code
  }
}

function functionAxis(fn: CognitiveFunction): string {
  return fn[0]; // N | S | T | F
}

export function analyzeDyad(selfType: FourLetterType, otherType: FourLetterType): DyadAnalysis {
  const selfStack = functionStackFor(selfType);
  const otherStack = functionStackFor(otherType);

  const shared: Dichotomy[] = [];
  const differing: Dichotomy[] = [];
  for (const dichotomy of DICHOTOMIES) {
    const a = dichotomyPole(selfType, dichotomy);
    const b = dichotomyPole(otherType, dichotomy);
    if (a === null || b === null) continue;
    (a === b ? shared : differing).push(dichotomy);
  }

  const selfDominant = selfStack[0];
  const otherDominant = otherStack[0];
  let dominantRelation: DominantRelation;
  if (selfDominant === otherDominant) {
    dominantRelation = 'same_function';
  } else if (functionAxis(selfDominant) === functionAxis(otherDominant)) {
    dominantRelation = 'same_axis_opposite_attitude';
  } else {
    dominantRelation = 'different_axis';
  }

  const selfEgo = selfStack.slice(0, 4);
  const otherEgo = otherStack.slice(0, 4);
  const sharedEgoFunctions = selfEgo.filter((fn) => otherEgo.includes(fn));

  return {
    selfType,
    otherType,
    sharedDichotomies: shared,
    differingDichotomies: differing,
    selfDominant,
    otherDominant,
    dominantRelation,
    selfDominantPositionInOther: otherStack.indexOf(selfDominant) + 1,
    otherDominantPositionInSelf: selfStack.indexOf(otherDominant) + 1,
    sharedEgoFunctions,
  };
}
