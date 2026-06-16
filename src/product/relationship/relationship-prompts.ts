// IS-AI — Mode D friction prompt. Two-sided: surfaces a function mismatch as
// one possible read of a pattern, never blaming either party. Pure builder.

import type { InscapeLocale } from '../../domain/locale.ts';
import {
  DEFAULT_AI_OUTPUT_LOCALE,
  respondInLocale,
  useExactLabelsDirective,
} from '../insight/prompt-directives.ts';
import type { RelationshipNature } from '../../domain/relationship.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';

export function buildFrictionPrompt(
  snippets: readonly string[],
  selfLeadingType: string | null,
  nature: RelationshipNature,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const system = [
    'You are Inscape. From the user-pasted conversation snippets, surface ONE recurring friction pattern',
    'as a cognitive-function mismatch. Be two-sided: blame neither party. Frame it as one possible read',
    'of a pattern, not a judgment of either person. Under 100 words.',
    respondInLocale(locale),
    useExactLabelsDirective(locale),
  ].join(' ');
  const self = selfLeadingType ?? 'unknown';
  const joined = snippets.map((snippet, index) => `(${index + 1}) ${snippet}`).join(' ');
  return {
    system,
    user: `My pattern: ${self}. Relationship: ${nature}. Conversation snippets (user-pasted): ${joined}`,
  };
}
