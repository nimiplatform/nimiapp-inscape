// IS-AI — Mode B prompt builders for the Today face. Pure (unit-testable).
// Today's read = grounded current-state read (not prediction/horoscope).
// Decision aid = the eight cognitive functions walked through a decision in
// the user's Beebe stack order, revealing blind spots (not prescription).

import type { InscapeLocale } from '../../domain/locale.ts';
import { functionCore } from '../insight/function-knowledge.ts';
import {
  DEFAULT_AI_OUTPUT_LOCALE,
  respondInLocale,
  useExactLabelsDirective,
} from '../insight/prompt-directives.ts';
import { analyzeSelf } from '../self/self-analysis.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';
import type { AiPrompt } from './reflection-prompts.ts';

export function buildTodaysReadPrompt(
  recentReflections: readonly string[],
  profile: TypeProfile | null,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const core = functionCore(locale);
  const system = [
    'You are Inscape, a Jungian cognitive-function reflection tool — not a fortune teller and not a horoscope.',
    "Give a short read of the user's current state, grounded ONLY in their recent reflections and function-stack pattern.",
    'Then give 2-3 concrete "what you can do" suggestions. No predictions, no horoscopes, no pathologizing.',
    'Use warm everyday language and describe a possible connecting need, not a personality diagnosis. Do not use function codes in the response, infer hidden motives, or describe any function or ability as missing, deficient, depleted, or lacking. A preference is not an impairment.',
    'End with a one-line confidence note reflecting how much recent input there is.',
    'Under 120 words.',
    respondInLocale(locale),
    useExactLabelsDirective(locale),
  ].join(' ');
  const reflections = recentReflections.length
    ? recentReflections.map((entry, index) => `(${index + 1}) ${entry}`).join(' ')
    : '(no recent reflections)';
  const analysis = profile ? analyzeSelf(profile) : null;
  const pattern = analysis
    ? `Optional reference perspectives: Hero ${analysis.hero} = ${core[analysis.hero]}; auxiliary ${analysis.parent} = ${core[analysis.parent]}. These references are not evidence of the user's current state or ability. Ground the read in the actual notes.`
    : 'No type prior yet.';
  return { mode: 'today-read', system, user: `${pattern} Recent reflections: ${reflections}` };
}
