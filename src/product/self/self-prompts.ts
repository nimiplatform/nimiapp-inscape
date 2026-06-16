// IS-AI — self-mirror prompt. Grounded in the deterministic SelfAnalysis +
// curated FUNCTION_CORE semantics. Recognizable and a little provocative, never
// a verdict. Pure builder.

import type { InscapeLocale } from '../../domain/locale.ts';
import { functionCore } from '../insight/function-knowledge.ts';
import {
  DEFAULT_AI_OUTPUT_LOCALE,
  respondInLocale,
  useExactLabelsDirective,
} from '../insight/prompt-directives.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';
import type { SelfAnalysis } from './self-analysis.ts';

const SECTION_HEADERS: Record<InscapeLocale, string> = {
  zh: '你的引擎 / 盲区与劣势 / 压力之下 / 成长边.',
  en: 'Your engine / Blind spots and weak points / Under stress / Growth edge.',
};

export function buildSelfMirrorPrompt(
  analysis: SelfAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const core = functionCore(locale);
  const facts = [
    `Leading type: ${analysis.leadingType}.`,
    `Hero (dominant) ${analysis.hero} = ${core[analysis.hero]}.`,
    `Parent (auxiliary) ${analysis.parent} = ${core[analysis.parent]}.`,
    `Inferior / anima ${analysis.inferior} = ${core[analysis.inferior]} — this is BOTH the stress/grip point AND the primary growth edge; the Growth edge section must be about developing ${analysis.inferior}.`,
    `Demon ${analysis.demon} = ${core[analysis.demon]} — the deepest, least-developed shadow, NOT the day-to-day growth target; do not frame Growth edge around ${analysis.demon}.`,
    `Currently loudest function in recent signals: ${analysis.loudest}.`,
  ].join(' ');
  const system = [
    'You are Inscape. Produce a self-mirror: a recognizable, slightly provocative read of how this person operates,',
    'grounded in their cognitive-function stack. Use EXACTLY these section headers, in order:',
    SECTION_HEADERS[locale],
    'Ground every point in the provided function facts. No flattery, no pathologizing, no determinism —',
    'tendencies a person can recognize, not a verdict — 2-3 short sentences per section.',
    respondInLocale(locale),
    useExactLabelsDirective(locale),
  ].join(' ');
  return { system, user: `Facts: ${facts}` };
}
