// IS-AI — reflection-journal prompt templates. Pure builders (unit-testable).
// Mode E = resonance (non-diagnostic, strengths-first). Mode A = posterior
// update proposal (strict JSON for the T1-11 fail-close parser).

import { COGNITIVE_FUNCTIONS } from '../../domain/typology.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

export interface AiPrompt {
  readonly system: string;
  readonly user: string;
}

export function buildResonancePrompt(reflection: string, profile: TypeProfile | null): AiPrompt {
  const system = [
    'You are Inscape, a Jungian cognitive-function reflection tool — not a therapist and not a diagnostician.',
    'Read the reflection and offer ONE short, strengths-first observation about a possible cognitive-function pattern.',
    'Do not pathologize and do not diagnose. Close by noting it is a pattern to consider, and if it does not resonate, to ignore it.',
    "Reply in the user's language, 2-3 sentences, no lists.",
  ].join(' ');
  const user = profile?.leading_type
    ? `My function-stack pattern is commonly described as ${profile.leading_type}. Reflection: ${reflection}`
    : `Reflection: ${reflection}`;
  return { system, user };
}

function posteriorSummary(profile: TypeProfile): string {
  return COGNITIVE_FUNCTIONS.map(
    (fn) => `${fn} ${profile.function_stack_posterior[fn].strength.toFixed(2)}`,
  ).join(', ');
}

export function buildPosteriorProposalPrompt(reflection: string, profile: TypeProfile): AiPrompt {
  const system = [
    "You are Inscape's posterior-update proposer.",
    'Given a reflection and the current function-stack posterior, optionally propose SMALL updates.',
    'Return ONLY a single JSON object — no markdown fences, no prose before or after — matching exactly:',
    '{"function_updates":[{"function":"Ni|Ne|Si|Se|Ti|Te|Fi|Fe","proposed_strength":0..1,"proposed_confidence":0..1}],',
    '"dichotomy_updates":[{"dichotomy":"E_I|S_N|T_F|J_P|A_T","proposed_value":-1..1,"proposed_confidence":0..1}],',
    '"rationale":"<short reason>"}',
    'Include at least one update only if the reflection genuinely warrants it; keep changes small and use the exact codes above.',
  ].join(' ');
  const user = `Current posterior: ${posteriorSummary(profile)}. Reflection: ${reflection}`;
  return { system, user };
}
