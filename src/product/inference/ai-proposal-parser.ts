// IS-INFER / T1-11 — fail-close parser for the Mode-A posterior-update proposal.
//
// The AI proposes a posterior update as JSON. This parser validates it against a
// strict schema. On ANY violation the WHOLE proposal is dropped — no partial
// merge, no fabricated value, no retry-into-success (Scenario 12). The caller
// surfaces nothing to the user on failure; only an opt-in local debug log.

import {
  DICHOTOMIES,
  isCognitiveFunction,
  type CognitiveFunction,
  type Dichotomy,
} from '../../domain/typology.ts';
import { isSignedUnit, isUnitInterval } from '../../domain/type-profile.ts';

export interface FunctionPosteriorProposal {
  readonly function: CognitiveFunction;
  readonly proposed_strength: number; // [0, 1]
  readonly proposed_confidence: number; // [0, 1]
}

export interface DichotomyPosteriorProposal {
  readonly dichotomy: Dichotomy;
  readonly proposed_value: number; // [-1, 1]
  readonly proposed_confidence: number; // [0, 1]
}

export interface PosteriorUpdateProposal {
  readonly function_updates: readonly FunctionPosteriorProposal[];
  readonly dichotomy_updates: readonly DichotomyPosteriorProposal[];
  readonly rationale: string;
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
      failure: { kind: 'invalid_json', detail: error instanceof Error ? error.message : String(error) },
    };
  }
  if (!isObject(parsed)) return violation('proposal must be a JSON object');

  const fnRaw = parsed.function_updates;
  const dichRaw = parsed.dichotomy_updates;
  if (fnRaw !== undefined && !Array.isArray(fnRaw)) return violation('function_updates must be an array');
  if (dichRaw !== undefined && !Array.isArray(dichRaw)) return violation('dichotomy_updates must be an array');

  const function_updates: FunctionPosteriorProposal[] = [];
  for (const item of Array.isArray(fnRaw) ? fnRaw : []) {
    if (!isObject(item)) return violation('function_updates entry must be an object');
    if (!isCognitiveFunction(item.function)) {
      return violation(`unknown cognitive function: ${String(item.function)}`);
    }
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

  const dichotomy_updates: DichotomyPosteriorProposal[] = [];
  for (const item of Array.isArray(dichRaw) ? dichRaw : []) {
    if (!isObject(item)) return violation('dichotomy_updates entry must be an object');
    if (!isDichotomy(item.dichotomy)) return violation(`unknown dichotomy: ${String(item.dichotomy)}`);
    if (!isSignedUnit(item.proposed_value)) {
      return violation(`proposed_value out of range for ${item.dichotomy}`);
    }
    if (!isUnitInterval(item.proposed_confidence)) {
      return violation(`proposed_confidence out of range for ${item.dichotomy}`);
    }
    dichotomy_updates.push({
      dichotomy: item.dichotomy,
      proposed_value: item.proposed_value,
      proposed_confidence: item.proposed_confidence,
    });
  }

  if (function_updates.length === 0 && dichotomy_updates.length === 0) {
    return violation('proposal contains no posterior updates');
  }
  if (typeof parsed.rationale !== 'string' || parsed.rationale.length === 0) {
    return violation('proposal rationale must be a non-empty string');
  }

  return { ok: true, proposal: { function_updates, dichotomy_updates, rationale: parsed.rationale } };
}
