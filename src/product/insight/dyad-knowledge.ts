// IS-TYPO — curated dyad dynamics. Authored, authoritative typology content
// keyed by the dominant-function relation (+ same-axis specifics + an
// inferior-grip note), so the dyad insight personalizes KNOWN dynamics instead
// of the LLM deriving everything from scratch. Authored content = less drift,
// more authority. Covers all 256 type pairs via the relation classification.
// Pure data.

import type { DominantRelation } from '../relationship/dyad-analysis.ts';

export interface DyadDynamic {
  readonly resonance: string;
  readonly friction: string;
  readonly bridge: string;
}

export const DOMINANT_RELATION_DYNAMICS: Record<DominantRelation, DyadDynamic> = {
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
};

// Same-axis-opposite specifics, keyed by the shared function letter (T/F/N/S).
export const AXIS_OPPOSITE_DYNAMICS: Record<string, string> = {
  T: 'Ti×Te：都靠思考，但一个求内在逻辑「对」、一个求外在结果「成」；易在「先想透 vs 先做成」上拉扯。',
  F: 'Fi×Fe：都重情感，但一个忠于自己内在价值、一个协调群体和谐；易在「做自己 vs 顾大家」上拉扯。',
  N: 'Ni×Ne：都靠直觉，但一个收敛到单一洞见、一个发散出多种可能；易在「定了吧 vs 再看看」上拉扯。',
  S: 'Si×Se：都重实感，但一个回看既有经验、一个抓当下现场；易在「按章法 vs 临场应变」上拉扯。',
};

export const INFERIOR_GRIP_NOTE =
  '一方的主导功能正是另一方的劣势（阿尼玛）位——你最擅长处恰是对方最脆弱处：既容易彼此吸引、敬佩，也容易无意间戳到对方的痛点。';
