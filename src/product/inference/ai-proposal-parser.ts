// IS-INFER / T1-11 — fail-close parser for the Mode-A posterior-update proposal.
//
// The AI proposes a posterior update as JSON. This parser validates it against a
// strict schema. On ANY violation the WHOLE proposal is dropped — no partial
// merge, no fabricated value, no retry-into-success (Scenario 12). The caller
// explains that no calibration is available and preserves the current profile.

import {
  DICHOTOMIES,
  isCognitiveFunction,
  type CognitiveFunction,
  type Dichotomy,
} from '../../domain/typology.ts';
import { isSignedUnit, isUnitInterval, type TypeProfile } from '../../domain/type-profile.ts';

export const MAX_REFLECTION_CHANGE = 0.1;

export interface FunctionPosteriorProposal {
  readonly function: CognitiveFunction;
  readonly proposed_strength: number; // [0, 1]
  readonly proposed_confidence: number; // [0, 1]
}

export interface AxisPosteriorProposal {
  readonly axis: Dichotomy;
  readonly proposed_value: number; // [-1, 1]
  readonly proposed_confidence: number; // [0, 1]
}

export interface PosteriorUpdateProposal {
  readonly function_updates: readonly FunctionPosteriorProposal[];
  readonly axis_updates: readonly AxisPosteriorProposal[];
  readonly reason: string;
}

/** The immutable in-memory evidence used to request a calibration. */
export interface ReflectionProposalContext {
  readonly profile: TypeProfile;
  readonly baseline: TypeProfile;
}

export type ProposalParseFailure =
  | { kind: 'invalid_json'; detail: string }
  | { kind: 'schema_violation'; detail: string };

export type ProposalParseResult =
  | { ok: true; proposal: PosteriorUpdateProposal }
  | { ok: false; failure: ProposalParseFailure };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDichotomy(value: unknown): value is Dichotomy {
  return typeof value === 'string' && (DICHOTOMIES as readonly string[]).includes(value);
}

function violation(detail: string): ProposalParseResult {
  return { ok: false, failure: { kind: 'schema_violation', detail } };
}

export function parsePosteriorUpdateProposal(raw: string): ProposalParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      failure: {
        kind: 'invalid_json',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  if (!isObject(parsed)) return violation('proposal must be a JSON object');
  if (
    Object.keys(parsed).some((key) => !['function_updates', 'axis_updates', 'reason'].includes(key))
  )
    return violation('unexpected proposal field');

  const fnRaw = parsed.function_updates;
  const dichRaw = parsed.axis_updates;
  if (!Array.isArray(fnRaw)) return violation('function_updates must be an array');
  if (!Array.isArray(dichRaw)) return violation('axis_updates must be an array');

  const function_updates: FunctionPosteriorProposal[] = [];
  const seenFunctions = new Set<string>();
  for (const item of fnRaw) {
    if (!isObject(item)) return violation('function_updates entry must be an object');
    if (!isCognitiveFunction(item.function)) {
      return violation(`unknown cognitive function: ${String(item.function)}`);
    }
    if (
      seenFunctions.has(item.function) ||
      Object.keys(item).some(
        (key) => !['function', 'proposed_strength', 'proposed_confidence'].includes(key),
      )
    )
      return violation('duplicate or unexpected function update');
    seenFunctions.add(item.function);
    if (!isUnitInterval(item.proposed_strength)) {
      return violation(`proposed_strength out of range for ${item.function}`);
    }
    if (!isUnitInterval(item.proposed_confidence)) {
      return violation(`proposed_confidence out of range for ${item.function}`);
    }
    function_updates.push({
      function: item.function,
      proposed_strength: item.proposed_strength,
      proposed_confidence: item.proposed_confidence,
    });
  }

  const axis_updates: AxisPosteriorProposal[] = [];
  const seenDichotomies = new Set<string>();
  for (const item of dichRaw) {
    if (!isObject(item)) return violation('axis_updates entry must be an object');
    if (!isDichotomy(item.axis)) return violation(`unknown dichotomy: ${String(item.axis)}`);
    if (
      seenDichotomies.has(item.axis) ||
      Object.keys(item).some(
        (key) => !['axis', 'proposed_value', 'proposed_confidence'].includes(key),
      )
    )
      return violation('duplicate or unexpected dichotomy update');
    seenDichotomies.add(item.axis);
    if (!isSignedUnit(item.proposed_value)) {
      return violation(`proposed_value out of range for ${item.axis}`);
    }
    if (!isUnitInterval(item.proposed_confidence)) {
      return violation(`proposed_confidence out of range for ${item.axis}`);
    }
    axis_updates.push({
      axis: item.axis,
      proposed_value: item.proposed_value,
      proposed_confidence: item.proposed_confidence,
    });
  }

  if (function_updates.length === 0 && axis_updates.length === 0) {
    return violation('proposal contains no posterior updates');
  }
  if (
    typeof parsed.reason !== 'string' ||
    parsed.reason.length === 0 ||
    parsed.reason.length > 4000
  ) {
    return violation('proposal reason must be a non-empty string');
  }

  return {
    ok: true,
    proposal: { function_updates, axis_updates, reason: parsed.reason },
  };
}

// @nimi-authority: rule.inscape.inference.r004
export function isBoundedReflectionProposal(
  proposal: PosteriorUpdateProposal,
  profile: TypeProfile,
): boolean {
  const within = (next: number, previous: number) =>
    Math.abs(next - previous) <= MAX_REFLECTION_CHANGE + 1e-9;
  return (
    proposal.function_updates.every((item) => {
      const current = profile.function_stack_posterior[item.function];
      return (
        within(item.proposed_strength, current.strength) &&
        within(item.proposed_confidence, current.confidence)
      );
    }) &&
    proposal.axis_updates.every((item) => {
      const current = profile.dichotomy_distribution[item.axis];
      return (
        within(item.proposed_value, current.value) &&
        within(item.proposed_confidence, current.confidence)
      );
    })
  );
}
