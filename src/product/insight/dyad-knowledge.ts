// IS-TYPO — curated dyad dynamics. Authored, authoritative typology content
// keyed by the dominant-function relation (+ same-axis specifics + an
// inferior-grip note), so the dyad insight personalizes KNOWN dynamics instead
// of the LLM deriving everything from scratch. Authored content = less drift,
// more authority. Covers all 256 type pairs via the relation classification.
// Pure data.

import type { DominantRelation } from '../relationship/dyad-analysis.ts';
import type { InscapeLocale } from '../../domain/locale.ts';

export interface DyadDynamic {
  readonly resonance: string;
  readonly friction: string;
  readonly bridge: string;
}

const DOMINANT_RELATION_DYNAMICS_BY_LOCALE: Record<InscapeLocale, Record<DominantRelation, DyadDynamic>> = {
  zh: {
  same_function: {
    resonance: '同一主导功能：你们用同一种核心方式理解世界，「被秒懂」来得很快。',
    friction: '太像反而会在同一条赛道竞争，并一起忽略你们共同的盲区（共享的劣势没人补）。',
    bridge: '有意识地分工，并主动引入第三视角补你们都看不到的那一面。',
  },
  same_axis_opposite_attitude: {
    resonance: '同轴反向：你们在乎的是同一件事（同一功能轴），抽象层面天然共鸣。',
    friction: '方向相反——一个向内一个向外；常因「闭合/推进 vs 开放/探索」的节奏互相觉得对方急或慢。',
    bridge: '先点破「我们要的其实是同一个东西」，再就节奏定一个共同约定（例如「探索到某点再拍板」）。',
  },
  different_axis: {
    resonance: '不同轴：各擅一域，能力上天然互补。',
    friction: '默契需要翻译——你看重的维度对方未必自动看见，容易各说各话。',
    bridge: '把你的视角翻成对方的语言（给经验、给结果、或给可能性），别假设对方自动懂。',
  },
  },
  en: {
    same_function: {
      resonance: 'Same dominant function: you use the same core way of understanding the world, so being understood can arrive quickly.',
      friction: 'Similarity can become competition on the same track, while both of you miss the blind spot you share.',
      bridge: 'Divide roles deliberately and bring in a third perspective for what neither of you naturally sees.',
    },
    same_axis_opposite_attitude: {
      resonance: 'Same axis, opposite attitude: you care about the same underlying thing, so the abstract resonance is real.',
      friction: 'The direction differs, inward versus outward; pacing conflicts often show up as one side feeling rushed and the other feeling stalled.',
      bridge: 'Name that you are protecting the same underlying concern, then agree on rhythm, such as exploring to a threshold before deciding.',
    },
    different_axis: {
      resonance: 'Different axis: each side is strong in a different domain, so the capacity mix can be naturally complementary.',
      friction: 'Rapport needs translation; what one side values may not be automatically visible to the other.',
      bridge: 'Translate your perspective into the other persons language: experience, results, or possibilities. Do not assume they automatically get it.',
    },
  },
};

// Same-axis-opposite specifics, keyed by the shared function letter (T/F/N/S).
const AXIS_OPPOSITE_DYNAMICS_BY_LOCALE: Record<InscapeLocale, Record<string, string>> = {
  zh: {
  T: 'Ti×Te：都靠思考，但一个求内在逻辑「对」、一个求外在结果「成」；易在「先想透 vs 先做成」上拉扯。',
  F: 'Fi×Fe：都重情感，但一个忠于自己内在价值、一个协调群体和谐；易在「做自己 vs 顾大家」上拉扯。',
  N: 'Ni×Ne：都靠直觉，但一个收敛到单一洞见、一个发散出多种可能；易在「定了吧 vs 再看看」上拉扯。',
  S: 'Si×Se：都重实感，但一个回看既有经验、一个抓当下现场；易在「按章法 vs 临场应变」上拉扯。',
  },
  en: {
    T: 'Ti×Te: both rely on thinking, but one seeks internal logical correctness while the other seeks external results; friction often appears as think it through first versus make it work first.',
    F: 'Fi×Fe: both prioritize feeling, but one is loyal to inner values while the other coordinates group harmony; friction often appears as be true to myself versus take care of everyone.',
    N: 'Ni×Ne: both rely on intuition, but one converges on a single insight while the other opens more possibilities; friction often appears as decide already versus keep exploring.',
    S: 'Si×Se: both value concrete reality, but one references prior experience while the other responds to the live moment; friction often appears as follow the known method versus improvise now.',
  },
};

const INFERIOR_GRIP_NOTE_BY_LOCALE: Record<InscapeLocale, string> = {
  zh: '一方的主导功能正是另一方的劣势（阿尼玛）位——你最擅长处恰是对方最脆弱处：既容易彼此吸引、敬佩，也容易无意间戳到对方的痛点。',
  en: 'One persons dominant function sits in the other persons inferior/anima position. The place where one is most capable is also where the other is most vulnerable, which can create attraction, admiration, and accidental pressure on a tender point.',
};

export const DOMINANT_RELATION_DYNAMICS: Record<DominantRelation, DyadDynamic> =
  DOMINANT_RELATION_DYNAMICS_BY_LOCALE.zh;

export const AXIS_OPPOSITE_DYNAMICS: Record<string, string> =
  AXIS_OPPOSITE_DYNAMICS_BY_LOCALE.zh;

export const INFERIOR_GRIP_NOTE = INFERIOR_GRIP_NOTE_BY_LOCALE.zh;

export function dominantRelationDynamics(
  locale: InscapeLocale = 'zh',
): Record<DominantRelation, DyadDynamic> {
  return DOMINANT_RELATION_DYNAMICS_BY_LOCALE[locale];
}

export function axisOppositeDynamics(locale: InscapeLocale = 'zh'): Record<string, string> {
  return AXIS_OPPOSITE_DYNAMICS_BY_LOCALE[locale];
}

export function inferiorGripNote(locale: InscapeLocale = 'zh'): string {
  return INFERIOR_GRIP_NOTE_BY_LOCALE[locale];
}
