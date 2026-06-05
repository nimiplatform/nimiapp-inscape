// IS-AI — Mode B prompt builders for the Today face. Pure (unit-testable).
// Today's read = grounded current-state read (not prediction/horoscope).
// Decision aid = the eight cognitive functions walked through a decision in
// the user's Beebe stack order, revealing blind spots (not prescription).

import { BEEBE_ARCHETYPES } from '../../domain/typology.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';
import type { AiPrompt } from './reflection-prompts.ts';

export function buildTodaysReadPrompt(
  recentReflections: readonly string[],
  profile: TypeProfile | null,
): AiPrompt {
  const system = [
    'You are Inscape, a Jungian cognitive-function reflection tool — not a fortune teller and not a horoscope.',
    "Give a short read of the user's current state, grounded ONLY in their recent reflections and function-stack pattern.",
    'Then give 2-3 concrete "what you can do" suggestions. No predictions, no horoscopes, no pathologizing.',
    'End with a one-line confidence note reflecting how much recent input there is.',
    "Reply in the user's language, under 120 words.",
  ].join(' ');
  const reflections = recentReflections.length
    ? recentReflections.map((entry, index) => `(${index + 1}) ${entry}`).join(' ')
    : '(no recent reflections)';
  const pattern = profile?.leading_type
    ? `Pattern commonly described as ${profile.leading_type}.`
    : 'No type prior yet.';
  return { system, user: `${pattern} Recent reflections: ${reflections}` };
}

export function buildDecisionAidPrompt(decision: string, profile: TypeProfile): AiPrompt {
  const stackOrder = BEEBE_ARCHETYPES.map(
    (archetype) => `${archetype}:${profile.beebe_archetype_inference[archetype]}`,
  ).join(', ');
  const system = [
    "You are Inscape. Walk the eight Jungian cognitive functions through the user's decision,",
    'each giving its short voice. Use the Beebe stack order: hero, parent, child, inferior (anima),',
    'then the shadow — opposing, senex, trickster, demon. Reveal blind spots; be two-sided; do NOT',
    "prescribe a choice. One short line per function. Reply in the user's language.",
  ].join(' ');
  return { system, user: `My Beebe stack: ${stackOrder}. Decision: ${decision}` };
}
