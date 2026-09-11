// IS-AI — reflection-journal prompt templates. Pure builders (unit-testable).
// Mode E = resonance (non-diagnostic, strengths-first). Mode A = posterior
// update proposal (strict JSON for the T1-11 fail-close parser).

import { COGNITIVE_FUNCTIONS } from '../../domain/typology.ts';
import type { InscapeLocale } from '../../domain/locale.ts';
import { DEFAULT_AI_OUTPUT_LOCALE } from '../insight/prompt-directives.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';
import type { StructuredAiMode } from '../../domain/ai-mode.ts';
import { MAX_REFLECTION_CHANGE } from '../inference/ai-proposal-parser.ts';

export interface AiPrompt {
  readonly mode: StructuredAiMode;
  readonly system: string;
  readonly user: string;
  readonly temperature?: number;
}

function posteriorSummary(profile: TypeProfile): string {
  return COGNITIVE_FUNCTIONS.map(
    (fn) => `${fn} ${profile.function_stack_posterior[fn].strength.toFixed(2)}`,
  ).join(', ');
}

// @nimi-authority: rule.inscape.inference.r004
export function buildPosteriorProposalPrompt(
  reflection: string,
  profile: TypeProfile,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const system = [
    "You are Inscape's posterior-update proposer.",
    'Given a reflection and the current function-stack posterior, optionally propose SMALL updates.',
    'Return ONLY a single JSON object — no markdown fences, no prose before or after — matching exactly:',
    '{"function_updates":[{"function":"Fe","proposed_strength":0.28,"proposed_confidence":0.4}],"axis_updates":[],"reason":"A short reason for this small change."}',
    'The example is a shape, not a recommendation. Choose only warranted targets. Function codes: Ni, Ne, Si, Se, Ti, Te, Fi, Fe. Strength and confidence are numbers in [0,1]. An axis update has exactly axis, proposed_value (number in [-1,1]), and proposed_confidence. Always include both update arrays; either may be empty.',
    'Include at least one update only if the reflection genuinely warrants it; keep changes small and use the exact codes above.',
    `Values are ABSOLUTE proposed values, NOT deltas. Every proposed strength, signed axis value, and confidence must stay within ${MAX_REFLECTION_CHANGE.toFixed(2)} of its supplied current value. Preserve confidence when one reflection is insufficient to improve it.`,
    'Axis polarities: E_I -1=E,+1=I; S_N -1=S,+1=N; T_F -1=T,+1=F; J_P -1=J,+1=P. Do not update A_T from a single reflection.',
    'An increased leaning requires an increased numeric value toward that pole. For example, current Fe=0.25 and more Fe could become 0.28, NOT 0.03 or 0.20; current T_F=0.60 and more F could become 0.65, NOT 0.05 or 0.10. The reason must describe the same direction as the numeric change.',
    locale === 'zh'
      ? 'The reason value must be written in 简体中文.'
      : 'The reason value must be written in English.',
  ].join(' ');
  const user = JSON.stringify({
    functionSummary: posteriorSummary(profile),
    currentFunctions: profile.function_stack_posterior,
    currentAxes: profile.dichotomy_distribution,
    reflection,
  });
  return { mode: 'profile-calibration', system, user, temperature: 0.1 };
}
