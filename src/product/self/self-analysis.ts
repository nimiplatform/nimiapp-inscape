// IS-TYPO — deterministic self analysis: the Beebe ego positions (hero /
// parent / child / inferior) + demon from the leading type, plus the currently
// loudest function from the posterior. Grounds the self-mirror narrative. Pure.

import {
  COGNITIVE_FUNCTIONS,
  functionStackFor,
  type CognitiveFunction,
  type FourLetterType,
} from '../../domain/typology.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

export interface SelfAnalysis {
  readonly leadingType: FourLetterType;
  readonly hero: CognitiveFunction;
  readonly parent: CognitiveFunction;
  readonly child: CognitiveFunction;
  /** Inferior (anima) — the growth + stress (grip) edge. */
  readonly inferior: CognitiveFunction;
  readonly demon: CognitiveFunction;
  /** Highest current posterior strength (may differ from the hero). */
  readonly loudest: CognitiveFunction;
}

export function analyzeSelf(profile: TypeProfile): SelfAnalysis | null {
  if (!profile.leading_type) return null;
  const stack = functionStackFor(profile.leading_type);
  const loudest = [...COGNITIVE_FUNCTIONS].sort(
    (a, b) => profile.function_stack_posterior[b].strength - profile.function_stack_posterior[a].strength,
  )[0];
  return {
    leadingType: profile.leading_type,
    hero: stack[0],
    parent: stack[1],
    child: stack[2],
    inferior: stack[3],
    demon: stack[7],
    loudest,
  };
}
