// IS-AI — self-mirror prompt. Grounded in the deterministic SelfAnalysis +
// curated FUNCTION_CORE semantics. Recognizable and a little provocative, never
// a verdict. Pure builder.

import { FUNCTION_CORE } from '../insight/function-knowledge.ts';
import { RESPOND_IN_CHINESE, USE_EXACT_LABELS } from '../insight/prompt-directives.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';
import type { SelfAnalysis } from './self-analysis.ts';

export function buildSelfMirrorPrompt(analysis: SelfAnalysis): AiPrompt {
  const facts = [
    `Leading type: ${analysis.leadingType}.`,
    `Hero (dominant) ${analysis.hero} = ${FUNCTION_CORE[analysis.hero]}.`,
    `Parent (auxiliary) ${analysis.parent} = ${FUNCTION_CORE[analysis.parent]}.`,
    `Inferior / anima ${analysis.inferior} = ${FUNCTION_CORE[analysis.inferior]} — this is BOTH the stress/grip point AND the primary growth edge; the 成长边 section must be about developing ${analysis.inferior}.`,
    `Demon ${analysis.demon} = ${FUNCTION_CORE[analysis.demon]} — the deepest, least-developed shadow, NOT the day-to-day growth target; do not frame 成长边 around ${analysis.demon}.`,
    `Currently loudest function in recent signals: ${analysis.loudest}.`,
  ].join(' ');
  const system = [
    'You are Inscape. Produce a self-mirror: a recognizable, slightly provocative read of how this person operates,',
    'grounded in their cognitive-function stack. Use EXACTLY these section headers, in order:',
    '你的引擎 / 盲区与劣势 / 压力之下 / 成长边.',
    'Ground every point in the provided function facts. No flattery, no pathologizing, no determinism —',
    'tendencies a person can recognize, not a verdict — 2-3 short sentences per section.',
    RESPOND_IN_CHINESE,
    USE_EXACT_LABELS,
  ].join(' ');
  return { system, user: `Facts: ${facts}` };
}
