// IS-AI — dyad insight prompt. The LLM narrates the relationship, but every
// point must be grounded in the deterministic DyadAnalysis facts + the curated
// dyad dynamics (authored knowledge + personalization, not a generic LLM dump).
// Pure builder.

import type { InscapeLocale } from '../../domain/locale.ts';
import { functionCore } from '../insight/function-knowledge.ts';
import {
  axisOppositeDynamics,
  dominantRelationDynamics,
  inferiorGripNote as localizedInferiorGripNote,
} from '../insight/dyad-knowledge.ts';
import {
  DEFAULT_AI_OUTPUT_LOCALE,
  respondInLocale,
  useExactLabelsDirective,
} from '../insight/prompt-directives.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';
import type { DyadAnalysis } from './dyad-analysis.ts';

export function dominantRelationLabel(
  analysis: DyadAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): string {
  if (locale === 'en') {
    switch (analysis.dominantRelation) {
      case 'same_function':
        return 'same dominant function';
      case 'same_axis_opposite_attitude':
        return 'same axis, opposite attitude (substantive resonance + attitude/rhythm friction)';
      default:
        return 'different axis (complementary, but rapport must be built)';
    }
  }
  switch (analysis.dominantRelation) {
    case 'same_function':
      return '同一主导功能';
    case 'same_axis_opposite_attitude':
      return '同轴反向（实质共鸣 + 态度/节奏摩擦）';
    default:
      return '不同轴（互补但默契需建立）';
  }
}

function axisOppositeNote(
  analysis: DyadAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): string {
  return analysis.dominantRelation === 'same_axis_opposite_attitude'
    ? axisOppositeDynamics(locale)[analysis.selfDominant[0]] ?? ''
    : '';
}

function inferiorGripNote(
  analysis: DyadAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): string {
  return analysis.selfDominantPositionInOther === 4 || analysis.otherDominantPositionInSelf === 4
    ? localizedInferiorGripNote(locale)
    : '';
}

/** One-line curated headline for the skeleton (shown before generating). */
export function dyadHeadline(
  analysis: DyadAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): string {
  return axisOppositeNote(analysis, locale) || dominantRelationDynamics(locale)[analysis.dominantRelation].resonance;
}

const SECTION_HEADERS: Record<InscapeLocale, string> = {
  zh: '共鸣点 / 摩擦点 / 盲区互补 / 破冰与相处.',
  en: 'Resonance / Friction / Blind-spot complement / How to break the ice and relate.',
};

export function buildDyadInsightPrompt(
  analysis: DyadAnalysis,
  locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE,
): AiPrompt {
  const core = functionCore(locale);
  const facts = [
    `Self type: ${analysis.selfType} (dominant ${analysis.selfDominant} = ${core[analysis.selfDominant]}).`,
    `Other type: ${analysis.otherType} (dominant ${analysis.otherDominant} = ${core[analysis.otherDominant]}).`,
    `Shared dichotomies: ${analysis.sharedDichotomies.join(', ') || 'none'}.`,
    `Differing dichotomies: ${analysis.differingDichotomies.join(', ') || 'none'}.`,
    `Dominant-function relation: ${analysis.dominantRelation}.`,
    `Self's dominant ${analysis.selfDominant} sits at Beebe position ${analysis.selfDominantPositionInOther} in the other's stack; the other's dominant ${analysis.otherDominant} sits at position ${analysis.otherDominantPositionInSelf} in self's stack.`,
    `Shared ego functions: ${analysis.sharedEgoFunctions.join(', ') || 'none'}.`,
  ].join(' ');

  const curated = dominantRelationDynamics(locale)[analysis.dominantRelation];
  const axisNote = axisOppositeNote(analysis, locale);
  const inferiorNote = inferiorGripNote(analysis, locale);
  const curatedFacts = [
    `${locale === 'zh' ? '权威动态·共鸣' : 'Curated dynamic - resonance'}: ${curated.resonance}`,
    `${locale === 'zh' ? '权威动态·摩擦' : 'Curated dynamic - friction'}: ${curated.friction}`,
    `${locale === 'zh' ? '权威动态·桥接' : 'Curated dynamic - bridge'}: ${curated.bridge}`,
    axisNote ? `${locale === 'zh' ? '权威动态·同轴' : 'Curated dynamic - same axis'}: ${axisNote}` : '',
    inferiorNote ? `${locale === 'zh' ? '权威动态·提示' : 'Curated dynamic - note'}: ${inferiorNote}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const system = [
    'You are Inscape. From the cognitive-function interplay facts of two people, produce a grounded relationship read.',
    `Use EXACTLY these four section headers, in order: ${SECTION_HEADERS[locale]}`,
    'Ground every point in the provided facts — do not invent type facts or use sign-of-the-zodiac language.',
    'The curated dynamic facts are authoritative typology dynamics: personalize them to these two specific types and do NOT contradict them.',
    locale === 'zh'
      ? 'Be two-sided and concrete. Under 破冰与相处, give actionable tips for BOTH directions (how self can reach the other, and vice versa).'
      : 'Be two-sided and concrete. Under How to break the ice and relate, give actionable tips for BOTH directions (how self can reach the other, and vice versa).',
    'These are tendencies, not fate; no pathologizing, no determinism.',
    '2-4 short bullets per section.',
    respondInLocale(locale),
    useExactLabelsDirective(locale),
  ].join(' ');

  return { system, user: `Facts: ${facts} ${curatedFacts}` };
}
