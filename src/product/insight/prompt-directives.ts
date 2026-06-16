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
  '严格使用所给事实中的类型代码与功能标签（例如 INTP、Fe），不得替换为其它类型或功能，也不要自行重新推导。';

export function useExactLabelsDirective(locale: InscapeLocale = DEFAULT_AI_OUTPUT_LOCALE): string {
  return locale === 'zh'
    ? USE_EXACT_LABELS
    : 'Use exactly the type codes and function labels in the provided facts (for example INTP, Fe); do not substitute other types or functions, and do not re-infer them.';
}
