// IS-AI — Mode D friction prompt. Two-sided: surfaces a function mismatch as
// one possible read of a pattern, never blaming either party. Pure builder.

import { RESPOND_IN_CHINESE, USE_EXACT_LABELS } from '../insight/prompt-directives.ts';
import type { RelationshipNature } from '../../domain/relationship.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';

export function buildFrictionPrompt(
  snippets: readonly string[],
  selfLeadingType: string | null,
  nature: RelationshipNature,
): AiPrompt {
  const system = [
    'You are Inscape. From the user-pasted conversation snippets, surface ONE recurring friction pattern',
    'as a cognitive-function mismatch. Be two-sided: blame neither party. Frame it as one possible read',
    'of a pattern, not a judgment of either person. Under 100 words.',
    RESPOND_IN_CHINESE,
    USE_EXACT_LABELS,
  ].join(' ');
  const self = selfLeadingType ?? 'unknown';
  const joined = snippets.map((snippet, index) => `(${index + 1}) ${snippet}`).join(' ');
  return {
    system,
    user: `My pattern: ${self}. Relationship: ${nature}. Conversation snippets (user-pasted): ${joined}`,
  };
}
