// IS-IA / IS-AI — the "你 × Ta" dyad insight surface. The headline relational
// value: assign the other person a type, then read how the two function stacks
// interact (共鸣 / 摩擦 / 互补 / 破冰). The deterministic skeleton is shown
// directly; the narrative is LLM, grounded in that skeleton.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { analyzeDyad } from './dyad-analysis.ts';
import { buildDyadInsightPrompt, dominantRelationLabel, dyadHeadline } from './dyad-prompts.ts';
import { buildInferTypePrompt, parseInferredType } from './infer-type.ts';
import {
  FOUR_LETTER_TYPES,
  isFourLetterType,
  type FourLetterType,
} from '../../domain/typology.ts';
import type { Relationship } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';

export function DyadInsight({
  relationship,
  other,
}: {
  relationship: Relationship;
  other: Subject | undefined;
}) {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const setOtherSubjectType = useInscapeStore((s) => s.setOtherSubjectType);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const selfType = space?.self_subject.type_profile?.leading_type ?? null;
  const locale = space?.settings.locale;
  const otherType = other?.type_profile?.leading_type ?? null;

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = selfType && otherType ? analyzeDyad(selfType, otherType) : null;

  async function onGenerate() {
    if (!analysis || working) return;
    setWorking(true);
    setInsight(null);
    setError(null);
    const result = await client.generate(buildDyadInsightPrompt(analysis, locale));
    if (result.ok) {
      setInsight(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  async function onInfer() {
    const trimmed = description.trim();
    if (!trimmed || inferring) return;
    setInferring(true);
    setInferError(null);
    const result = await client.generate(buildInferTypePrompt(trimmed, locale));
    if (result.ok) {
      const parsed = parseInferredType(result.text);
      if (parsed.ok) {
        void setOtherSubjectType(
          relationship.other_subject_id,
          parsed.inferred.type,
          new Date().toISOString(),
        );
      } else {
        setInferError(t('DyadInsight.inferFailed'));
      }
    } else {
      setInferError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setInferring(false);
  }

  if (!selfType) {
    return <p className="text-xs opacity-60">{t('DyadInsight.needsSelfType')}</p>;
  }

  if (!otherType || !analysis) {
    const valid = isFourLetterType(code);
    const otherName = other?.display_name ?? t('DyadInsight.otherFallback');
    return (
      <div className="space-y-2">
        <p className="text-sm">{t('DyadInsight.assignType', { name: otherName })}</p>
        <div className="flex items-center gap-2">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded border border-black/15 px-2 py-1 text-sm"
          >
            <option value="">{t('DyadInsight.selectType')}</option>
            {FOUR_LETTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              valid &&
              void setOtherSubjectType(
                relationship.other_subject_id,
                code as FourLetterType,
                new Date().toISOString(),
              )
            }
            className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            {t('DyadInsight.set')}
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs opacity-70">{t('DyadInsight.inferHint')}</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t('DyadInsight.descriptionPlaceholder')}
            className="w-full rounded border border-black/15 p-2 text-sm"
          />
          <button
            type="button"
            disabled={inferring || !description.trim()}
            onClick={() => void onInfer()}
            className="rounded border border-black/15 px-3 py-1 text-sm disabled:opacity-40"
          >
            {inferring ? t('DyadInsight.inferring') : t('DyadInsight.infer')}
          </button>
          {inferError && <p className="text-xs opacity-60">{inferError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">
        {t('DyadInsight.headline', { selfType, otherType })}
      </h4>
      <ul className="space-y-0.5 text-xs opacity-70">
        <li>
          {t('DyadInsight.sharedDifferent', {
            shared: analysis.sharedDichotomies.join(t('Common.listSeparator')) || t('Common.none'),
            different: analysis.differingDichotomies.join(t('Common.listSeparator')) || t('Common.none'),
          })}
        </li>
        <li>
          {t('DyadInsight.dominant', {
            selfDominant: analysis.selfDominant,
            otherDominant: analysis.otherDominant,
            relation: dominantRelationLabel(analysis, locale),
          })}
        </li>
        <li>{t('DyadInsight.dynamic', { headline: dyadHeadline(analysis, locale) })}</li>
        {analysis.sharedEgoFunctions.length > 0 && (
          <li>
            {t('DyadInsight.sharedEgo', {
              functions: analysis.sharedEgoFunctions.join(t('Common.listSeparator')),
            })}
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={working}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? t('Common.generating') : t('DyadInsight.generate')}
      </button>
      {insight && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {insight}
        </div>
      )}
      {error && <p className="text-xs opacity-60">{t('Common.aiUnavailable', { error })}</p>}
    </div>
  );
}
