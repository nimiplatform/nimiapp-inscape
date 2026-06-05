// IS-AI — dyad insight prompt. The LLM narrates the relationship, but every
// point must be grounded in the deterministic DyadAnalysis facts + the curated
// dyad dynamics (authored knowledge + personalization, not a generic LLM dump).
// Pure builder.

import { FUNCTION_CORE } from '../insight/function-knowledge.ts';
import {
  AXIS_OPPOSITE_DYNAMICS,
  DOMINANT_RELATION_DYNAMICS,
  INFERIOR_GRIP_NOTE,
} from '../insight/dyad-knowledge.ts';
import { RESPOND_IN_CHINESE, USE_EXACT_LABELS } from '../insight/prompt-directives.ts';
import type { AiPrompt } from '../today/reflection-prompts.ts';
import type { DyadAnalysis } from './dyad-analysis.ts';

export function dominantRelationLabel(analysis: DyadAnalysis): string {
  switch (analysis.dominantRelation) {
    case 'same_function':
      return '同一主导功能';
    case 'same_axis_opposite_attitude':
      return '同轴反向（实质共鸣 + 态度/节奏摩擦）';
    default:
      return '不同轴（互补但默契需建立）';
  }
}

function axisOppositeNote(analysis: DyadAnalysis): string {
  return analysis.dominantRelation === 'same_axis_opposite_attitude'
    ? AXIS_OPPOSITE_DYNAMICS[analysis.selfDominant[0]] ?? ''
    : '';
}

function inferiorGripNote(analysis: DyadAnalysis): string {
  return analysis.selfDominantPositionInOther === 4 || analysis.otherDominantPositionInSelf === 4
    ? INFERIOR_GRIP_NOTE
    : '';
}

/** One-line curated headline for the skeleton (shown before generating). */
export function dyadHeadline(analysis: DyadAnalysis): string {
  return axisOppositeNote(analysis) || DOMINANT_RELATION_DYNAMICS[analysis.dominantRelation].resonance;
}

export function buildDyadInsightPrompt(analysis: DyadAnalysis): AiPrompt {
  const facts = [
    `Self type: ${analysis.selfType} (dominant ${analysis.selfDominant} = ${FUNCTION_CORE[analysis.selfDominant]}).`,
    `Other type: ${analysis.otherType} (dominant ${analysis.otherDominant} = ${FUNCTION_CORE[analysis.otherDominant]}).`,
    `Shared dichotomies: ${analysis.sharedDichotomies.join(', ') || 'none'}.`,
    `Differing dichotomies: ${analysis.differingDichotomies.join(', ') || 'none'}.`,
    `Dominant-function relation: ${analysis.dominantRelation}.`,
    `Self's dominant ${analysis.selfDominant} sits at Beebe position ${analysis.selfDominantPositionInOther} in the other's stack; the other's dominant ${analysis.otherDominant} sits at position ${analysis.otherDominantPositionInSelf} in self's stack.`,
    `Shared ego functions: ${analysis.sharedEgoFunctions.join(', ') || 'none'}.`,
  ].join(' ');

  const curated = DOMINANT_RELATION_DYNAMICS[analysis.dominantRelation];
  const axisNote = axisOppositeNote(analysis);
  const inferiorNote = inferiorGripNote(analysis);
  const curatedFacts = [
    `权威动态·共鸣: ${curated.resonance}`,
    `权威动态·摩擦: ${curated.friction}`,
    `权威动态·桥接: ${curated.bridge}`,
    axisNote ? `权威动态·同轴: ${axisNote}` : '',
    inferiorNote ? `权威动态·提示: ${inferiorNote}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const system = [
    'You are Inscape. From the cognitive-function interplay facts of two people, produce a grounded relationship read.',
    'Use EXACTLY these four section headers, in order: 共鸣点 / 摩擦点 / 盲区互补 / 破冰与相处.',
    'Ground every point in the provided facts — do not invent type facts or use sign-of-the-zodiac language.',
    'The 权威动态 facts are CURATED, authoritative typology dynamics: personalize them to these two specific types and do NOT contradict them.',
    'Be two-sided and concrete. Under 破冰与相处, give actionable tips for BOTH directions (how self can reach the other, and vice versa).',
    'These are tendencies, not fate; no pathologizing, no determinism.',
    '2-4 short bullets per section.',
    RESPOND_IN_CHINESE,
    USE_EXACT_LABELS,
  ].join(' ');

  return { system, user: `Facts: ${facts} ${curatedFacts}` };
}
