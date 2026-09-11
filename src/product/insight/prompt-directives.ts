// IS-AI — shared output directives for insight prompts. Live testing surfaced
// two failure modes: the model drifting away from the selected UI language and
// occasionally renaming the type/function (INTJ for INTP, Fi for Fe). These
// directives pin output language and label fidelity to the grounded facts.

import type { InscapeLocale } from '../../domain/locale.ts';

export const DEFAULT_AI_OUTPUT_LOCALE: InscapeLocale = 'zh';

export const RESPOND_IN_CHINESE = '务必用简体中文回答。';

export function respondInLocale(locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE): string {
  return locale === 'zh' ? RESPOND_IN_CHINESE : 'Respond in clear, natural English.';
}

export const USE_EXACT_LABELS =
  '只使用本次所给事实中的类型代码与功能标签，不得新增、替换或自行重新推导。类型和功能栈是用户选择的参考，不代表已经被证实的人格、能力或当前状态。';

export function useExactLabelsDirective(locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE): string {
  return locale === 'zh'
    ? USE_EXACT_LABELS
    : 'Use exactly the supplied type codes and function labels; do not introduce, substitute, or re-infer them. Types and stacks are user-chosen reference maps, not verified personal traits, abilities, or current states.';
}
