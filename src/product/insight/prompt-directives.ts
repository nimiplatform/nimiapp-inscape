// IS-AI — shared output directives for insight prompts. Live testing surfaced
// two failure modes: the model drifting to English (despite "reply in the
// user's language"), and occasionally renaming the type/function (INTJ for
// INTP, Fi for Fe). These directives pin the output language and the label
// fidelity to the grounded facts. (Locale-driven language is a future i18n
// step; the product is Chinese-first today.)

export const RESPOND_IN_CHINESE = '务必用简体中文回答。';

export const USE_EXACT_LABELS =
  '严格使用所给事实中的类型代码与功能标签（例如 INTP、Fe），不得替换为其它类型或功能，也不要自行重新推导。';
