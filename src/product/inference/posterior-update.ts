// IS-INFER — apply a validated (T1-11-parsed) posterior-update proposal to a
// TypeProfile. Pure + immutable. The proposal carries proposed absolute values
// (not deltas); only the targeted functions / dichotomies are replaced. The
// user must have accepted the proposal before this runs (Scenario 3).

import type {
  DichotomyValue,
  FunctionStrength,
  TypeProfile,
} from '../../domain/type-profile.ts';
import type { PosteriorUpdateProposal } from './ai-proposal-parser.ts';

export function applyPosteriorUpdate(
  profile: TypeProfile,
  proposal: PosteriorUpdateProposal,
  now: string,
  sourceId: string,
): TypeProfile {
  const functionPosterior = { ...profile.function_stack_posterior } as Record<string, FunctionStrength>;
  for (const update of proposal.function_updates) {
    functionPosterior[update.function] = {
      strength: update.proposed_strength,
      confidence: update.proposed_confidence,
    };
  }

  const dichotomyDistribution = { ...profile.dichotomy_distribution } as Record<string, DichotomyValue>;
  for (const update of proposal.dichotomy_updates) {
    const previous = dichotomyDistribution[update.dichotomy];
    const sources = previous ? [...previous.sources, sourceId] : [sourceId];
    dichotomyDistribution[update.dichotomy] = {
      value: update.proposed_value,
      confidence: update.proposed_confidence,
      sources,
    };
  }

  return {
    ...profile,
    function_stack_posterior: functionPosterior as TypeProfile['function_stack_posterior'],
    dichotomy_distribution: dichotomyDistribution as TypeProfile['dichotomy_distribution'],
    updated_at: now,
  };
}
