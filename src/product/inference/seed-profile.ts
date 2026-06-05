// IS-INFER — deterministic seed TypeProfile from a 4-letter type. This is the
// simplest initial-test output: the type's Beebe stack seeds the function
// posterior (hero strongest → demon weakest) and the dichotomy distribution.
// It is a prior with moderate confidence, not a verdict — subsequent reflection
// signals refine it (anti-fixation).

import {
  BEEBE_ARCHETYPES,
  COGNITIVE_FUNCTIONS,
  DICHOTOMIES,
  functionStackFor,
  type BeebeArchetype,
  type CognitiveFunction,
  type Dichotomy,
  type FourLetterType,
} from '../../domain/typology.ts';
import type {
  BeebeArchetypeInference,
  DichotomyDistribution,
  DichotomyValue,
  FunctionStackPosterior,
  FunctionStrength,
  TypeProfile,
} from '../../domain/type-profile.ts';

const SEED_STRENGTHS = [0.85, 0.62, 0.45, 0.3, 0.25, 0.2, 0.15, 0.1] as const;
const SEED_FUNCTION_CONFIDENCE = 0.4;
const SEED_DICHOTOMY_MAGNITUDE = 0.6;
const SEED_DICHOTOMY_CONFIDENCE = 0.4;

// Negative pole letter per function-bearing dichotomy (DichotomyValue convention:
// E_I → -1 = E, +1 = I). A_T is not encoded in the 4-letter code.
const DICHOTOMY_NEGATIVE_POLE: Record<Exclude<Dichotomy, 'A_T'>, string> = {
  E_I: 'E',
  S_N: 'S',
  T_F: 'T',
  J_P: 'J',
};

function axisLetter(type: FourLetterType, dichotomy: Dichotomy): string | null {
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
      return null;
  }
}

export function seedTypeProfileFromType(type: FourLetterType, now: string): TypeProfile {
  const stack = functionStackFor(type);

  const functions = {} as Record<CognitiveFunction, FunctionStrength>;
  for (const fn of COGNITIVE_FUNCTIONS) {
    functions[fn] = { strength: 0, confidence: 0 };
  }
  stack.forEach((fn, index) => {
    functions[fn] = { strength: SEED_STRENGTHS[index], confidence: SEED_FUNCTION_CONFIDENCE };
  });

  const dichotomies = {} as Record<Dichotomy, DichotomyValue>;
  for (const dichotomy of DICHOTOMIES) {
    const letter = axisLetter(type, dichotomy);
    if (letter === null) {
      dichotomies[dichotomy] = { value: 0, confidence: 0.1, sources: [] };
      continue;
    }
    const negativePole = DICHOTOMY_NEGATIVE_POLE[dichotomy as Exclude<Dichotomy, 'A_T'>];
    dichotomies[dichotomy] = {
      value: letter === negativePole ? -SEED_DICHOTOMY_MAGNITUDE : SEED_DICHOTOMY_MAGNITUDE,
      confidence: SEED_DICHOTOMY_CONFIDENCE,
      sources: ['initial_test'],
    };
  }

  const archetypes = {} as Record<BeebeArchetype, CognitiveFunction>;
  BEEBE_ARCHETYPES.forEach((archetype, index) => {
    archetypes[archetype] = stack[index];
  });

  return {
    dichotomy_distribution: dichotomies as DichotomyDistribution,
    function_stack_posterior: functions as FunctionStackPosterior,
    beebe_archetype_inference: archetypes as BeebeArchetypeInference,
    leading_type: type,
    updated_at: now,
  };
}
