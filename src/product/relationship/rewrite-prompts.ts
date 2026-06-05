// IS-PRIV-04 / T1-10 — anti-manipulation Layer 1 (prompt hard-injection) and
// Layer 3 (mandatory output disclaimer). Pure builder.

import type { RelationshipNature } from '../../domain/relationship.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';

export const REWRITE_DISCLAIMER =
  '这些改写仅基于你的视角——对方没有参与此框定。请当作草稿，而非脚本。';

export function buildRewritePrompt(
  draft: string,
  recipientName: string,
  nature: RelationshipNature,
  selfLeadingType: string | null,
): AiPrompt {
  const system = [
    "You are Inscape's communication-rewrite surface.",
    'HARD CONSTRAINTS: never produce manipulation, coercion, PUA tactics, guilt-tripping, gaslighting, or deception.',
    "Favor clarity, honest boundaries, and respect for the recipient's autonomy.",
    'Your job is NOT to help the user get their way — it is to help them communicate cleanly and respectfully.',
    'Produce 2-3 alternative rewrites tuned to the relationship, each clear and boundaried.',
    'Do NOT add pressure, deadlines, ultimatums, or conditions the user did not already state.',
    "Reply in the user's language.",
  ].join(' ');
  const user = `Recipient: ${recipientName} (${nature}). My pattern: ${selfLeadingType ?? 'unknown'}. Draft message: ${draft}`;
  return { system, user };
}
