// IS-PRIV-04 / T1-10 — anti-manipulation Layer 2: keyword classifier. Runs
// BEFORE any AI call and refuses to rewrite in money, employment,
// sexual-consent, or decision-pressure contexts. Heuristic and safety-first:
// it errs toward refusal. Pure + unit-testable.

export type RefusalCategory = 'money' | 'employment' | 'sexual_consent' | 'decision_pressure';

export type RewriteClassification =
  | { readonly ok: true }
  | { readonly ok: false; readonly category: RefusalCategory; readonly reason: string };

const PATTERNS: Record<RefusalCategory, readonly RegExp[]> = {
  money: [
    /\b(loan|repay|owe|owes|debt|salary|wage|payment|invoice|refund|deposit)\b/i,
    /钱|借款|还钱|还款|工资|薪资|付款|欠款|押金|转账/,
  ],
  employment: [
    /\b(fire|fired|layoff|lay off|terminate|hire|raise|promotion|resign|demote|offer letter)\b/i,
    /雇佣|解雇|裁员|辞退|开除|升职|加薪|录用|离职|降职/,
  ],
  sexual_consent: [
    /\b(sexual|consent|hook ?up|sleep with|have sex)\b/i,
    /性行为|性同意|发生关系|上床|约炮/,
  ],
  decision_pressure: [
    /\bif you don'?t\b/i,
    /\bor else\b/i,
    /\bby (tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)/i,
    /\b(ultimatum|deadline)\b/i,
    /如果你不|要不然|否则|不然就|最后通牒|必须在|限你/,
  ],
};

const REASONS: Record<RefusalCategory, string> = {
  money: '这条信息涉及金钱情境，Inscape 不在此类情境下提供改写。',
  employment: '这条信息涉及雇佣 / 职权情境，Inscape 不在此类情境下提供改写。',
  sexual_consent: '这条信息涉及性同意情境，Inscape 不在此类情境下提供改写。',
  decision_pressure:
    '这条信息读起来像在施加决策压力或下最后通牒；改写它可能让施压更容易传达，而这不是这个功能的用途。',
};

export function classifyRewriteContext(draft: string): RewriteClassification {
  for (const category of Object.keys(PATTERNS) as RefusalCategory[]) {
    if (PATTERNS[category].some((pattern) => pattern.test(draft))) {
      return { ok: false, category, reason: REASONS[category] };
    }
  }
  return { ok: true };
}
