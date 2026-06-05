// IS-TYPO core — the canonical Jungian-typology reference data.
//
// The function stack is the authority. The 4-letter codes are a parenthetical
// legibility aid only (IS-TYPO / T1-09 MBTI® trademark boundary): Inscape does
// not claim MBTI® authorization and treats the code as a label, not the model.
//
// This module is pure data + helpers (mirrors the spec table
// function-stack-positions.yaml). No runtime, no I/O.

/** The eight Jungian cognitive functions. */
export const COGNITIVE_FUNCTIONS = [
  'Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe',
] as const;
export type CognitiveFunction = (typeof COGNITIVE_FUNCTIONS)[number];

/** Dichotomy axes. A_T (assertive/turbulent) is carried but is not a function axis. */
export const DICHOTOMIES = ['E_I', 'S_N', 'T_F', 'J_P', 'A_T'] as const;
export type Dichotomy = (typeof DICHOTOMIES)[number];

/**
 * The eight Beebe archetype positions, in canonical order:
 * 1 hero (dominant), 2 parent (auxiliary), 3 child (tertiary),
 * 4 anima (inferior), then the shadow: 5 opposing, 6 senex, 7 trickster, 8 demon.
 */
export const BEEBE_ARCHETYPES = [
  'hero', 'parent', 'child', 'anima', 'opposing', 'senex', 'trickster', 'demon',
] as const;
export type BeebeArchetype = (typeof BEEBE_ARCHETYPES)[number];

/** The 16 four-letter codes (legibility labels). */
export const FOUR_LETTER_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
export type FourLetterType = (typeof FOUR_LETTER_TYPES)[number];

/** A full Beebe 8-function stack, ordered hero → demon. */
export type FunctionStack = readonly [
  CognitiveFunction, CognitiveFunction, CognitiveFunction, CognitiveFunction,
  CognitiveFunction, CognitiveFunction, CognitiveFunction, CognitiveFunction,
];

/**
 * Canonical Beebe 8-function stack per type. Positions 1–4 are the ego
 * (hero/parent/child/anima); positions 5–8 are the attitude-flipped shadow
 * (opposing/senex/trickster/demon).
 */
export const FUNCTION_STACK_POSITIONS: Readonly<Record<FourLetterType, FunctionStack>> = {
  INTJ: ['Ni', 'Te', 'Fi', 'Se', 'Ne', 'Ti', 'Fe', 'Si'],
  INTP: ['Ti', 'Ne', 'Si', 'Fe', 'Te', 'Ni', 'Se', 'Fi'],
  ENTJ: ['Te', 'Ni', 'Se', 'Fi', 'Ti', 'Ne', 'Si', 'Fe'],
  ENTP: ['Ne', 'Ti', 'Fe', 'Si', 'Ni', 'Te', 'Fi', 'Se'],
  INFJ: ['Ni', 'Fe', 'Ti', 'Se', 'Ne', 'Fi', 'Te', 'Si'],
  INFP: ['Fi', 'Ne', 'Si', 'Te', 'Fe', 'Ni', 'Se', 'Ti'],
  ENFJ: ['Fe', 'Ni', 'Se', 'Ti', 'Fi', 'Ne', 'Si', 'Te'],
  ENFP: ['Ne', 'Fi', 'Te', 'Si', 'Ni', 'Fe', 'Ti', 'Se'],
  ISTJ: ['Si', 'Te', 'Fi', 'Ne', 'Se', 'Ti', 'Fe', 'Ni'],
  ISFJ: ['Si', 'Fe', 'Ti', 'Ne', 'Se', 'Fi', 'Te', 'Ni'],
  ESTJ: ['Te', 'Si', 'Ne', 'Fi', 'Ti', 'Se', 'Ni', 'Fe'],
  ESFJ: ['Fe', 'Si', 'Ne', 'Ti', 'Fi', 'Se', 'Ni', 'Te'],
  ISTP: ['Ti', 'Se', 'Ni', 'Fe', 'Te', 'Si', 'Ne', 'Fi'],
  ISFP: ['Fi', 'Se', 'Ni', 'Te', 'Fe', 'Si', 'Ne', 'Ti'],
  ESTP: ['Se', 'Ti', 'Fe', 'Ni', 'Si', 'Te', 'Fi', 'Ne'],
  ESFP: ['Se', 'Fi', 'Te', 'Ni', 'Si', 'Fe', 'Ti', 'Ne'],
};

/** The Beebe stack (hero → demon) for a type. */
export function functionStackFor(type: FourLetterType): FunctionStack {
  return FUNCTION_STACK_POSITIONS[type];
}

/** The function occupying a given Beebe archetype position for a type. */
export function functionAtArchetype(
  type: FourLetterType,
  archetype: BeebeArchetype,
): CognitiveFunction {
  return FUNCTION_STACK_POSITIONS[type][BEEBE_ARCHETYPES.indexOf(archetype)];
}

/** The dominant (hero) function for a type. */
export function dominantFunction(type: FourLetterType): CognitiveFunction {
  return FUNCTION_STACK_POSITIONS[type][0];
}

/** The inferior (anima, position 4) function for a type. */
export function inferiorFunction(type: FourLetterType): CognitiveFunction {
  return FUNCTION_STACK_POSITIONS[type][3];
}

export function isCognitiveFunction(value: unknown): value is CognitiveFunction {
  return typeof value === 'string' && (COGNITIVE_FUNCTIONS as readonly string[]).includes(value);
}

export function isFourLetterType(value: unknown): value is FourLetterType {
  return typeof value === 'string' && (FOUR_LETTER_TYPES as readonly string[]).includes(value);
}
