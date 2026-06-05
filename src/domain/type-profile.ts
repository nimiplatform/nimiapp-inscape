// IS-TYPO — TypeProfile: type as a moving probability distribution, never a
// fixed label (the product's anti-fixation core). All values are posteriors
// updated only by user-driven signals (test, reflection, accept/reject).

import type {
  BeebeArchetype,
  CognitiveFunction,
  Dichotomy,
  FourLetterType,
} from './typology.ts';

/** Confidence in [0, 1]. */
export type Confidence = number;

/** A dichotomy posterior: signed lean in [-1, 1] (e.g. E_I: -1 = E, +1 = I). */
export interface DichotomyValue {
  /** Signed position in [-1, 1]. */
  readonly value: number;
  readonly confidence: Confidence;
  /** Signal sources contributing to this value (e.g. 'initial_test', 'reflection:<id>'). */
  readonly sources: readonly string[];
}

export type DichotomyDistribution = Readonly<Record<Dichotomy, DichotomyValue>>;

/** Per-function posterior strength in [0, 1] with its confidence. */
export interface FunctionStrength {
  /** Strength in [0, 1]. */
  readonly strength: number;
  readonly confidence: Confidence;
}

export type FunctionStackPosterior = Readonly<Record<CognitiveFunction, FunctionStrength>>;

/** Inferred archetype → function mapping for the subject (8 Beebe positions). */
export type BeebeArchetypeInference = Readonly<Record<BeebeArchetype, CognitiveFunction>>;

export interface TypeProfile {
  readonly dichotomy_distribution: DichotomyDistribution;
  readonly function_stack_posterior: FunctionStackPosterior;
  readonly beebe_archetype_inference: BeebeArchetypeInference;
  /**
   * Most-likely 4-letter code — a legibility label derived from the posterior,
   * NEVER rendered as "your type is X" hero text (IS-IA type-label suppression).
   * Null until the posterior is confident enough to name one.
   */
  readonly leading_type: FourLetterType | null;
  readonly updated_at: string;
}

export function isUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isSignedUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
}
