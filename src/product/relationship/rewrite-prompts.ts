// IS-PRIV-04 / T1-10 — anti-manipulation Layer 1 (prompt hard-injection) and
// Layer 3 (mandatory output disclaimer). Pure builder.

import type { RelationshipNature } from '../../domain/relationship.ts';
import type { InscapeLocale } from '../../domain/locale.ts';
import { DEFAULT_AI_OUTPUT_LOCALE, respondInLocale } from '../insight/prompt-directives.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';

export const REWRITE_DISCLAIMER =
  '这些改写仅基于你的视角——对方没有参与此框定。请当作草稿，而非脚本。';

export function buildRewritePrompt(
  draft: string,
  recipientName: string,
  nature: RelationshipNature,
  selfLeadingType: string | null,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const system = [
    "You are Inscape's communication-rewrite surface.",
    'HARD CONSTRAINTS: never produce manipulation, coercion, PUA tactics, guilt-tripping, gaslighting, or deception.',
    "Favor clarity, honest boundaries, and respect for the recipient's autonomy.",
    'Your job is NOT to help the user get their way — it is to help them communicate cleanly and respectfully.',
    'Produce exactly three concise alternative drafts, each clear and boundaried. Each should sound like a message a person would actually send, under 70 words.',
    'Do NOT add pressure, deadlines, ultimatums, or conditions the user did not already state.',
    'Do not label, diagnose or criticize the recipient. Do not mention missing personality information, internal pattern fields, testing labels, or any technical context. Do not add greetings, recipient names, or sign-offs unless present in the draft.',
    'No preface, lecture, explanation of communication theory, or concluding advice. Preserve the real needs and facts in the draft without adding new emotions or events.',
    'Return ONLY valid JSON, no markdown fences, with exactly this shape:',
    '{"variants":[{"tone":"brief tone label","text":"ready-to-send message only","note":"one short sentence on how the wording differs"}]}. Include exactly three different variants. Use plain text in all fields.',
    respondInLocale(locale),
  ].join(' ');
  const user = JSON.stringify({
    recipient: recipientName,
    relationship: nature,
    ...(selfLeadingType ? { tentativeSelfType: selfLeadingType } : {}),
    draft,
  });
  return { mode: 'communication-rewrite', system, user, temperature: 0.25 };
}
