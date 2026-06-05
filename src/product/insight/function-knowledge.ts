// IS-TYPO — curated typology knowledge. One-line "core drive" per cognitive
// function + Beebe archetype labels. This is the hand-authored content that
// gives the LLM grounded semantics (not just function codes) for self-mirror
// and dyad insight. Pure data.

import type { BeebeArchetype, CognitiveFunction } from '../../domain/typology.ts';

export const FUNCTION_CORE: Record<CognitiveFunction, string> = {
  Ni: '收敛式洞察——看见长期走向与底层模式',
  Ne: '发散式联想——看见可能性与潜在选项',
  Si: '具体经验的精确记忆与稳定参照',
  Se: '当下感官的敏锐与即时行动',
  Ti: '内在逻辑自洽——要把道理想「对」',
  Te: '外部效率与结果——要把事推「成」',
  Fi: '内在价值真诚——忠于自己在乎的',
  Fe: '群体和谐——协调他人的感受与氛围',
};

export const ARCHETYPE_LABEL: Record<BeebeArchetype, string> = {
  hero: '英雄（主导）',
  parent: '父母（辅助）',
  child: '儿童（第三）',
  anima: '劣势（阿尼玛）',
  opposing: '对立',
  senex: '老人',
  trickster: '欺骗者',
  demon: '恶魔',
};
