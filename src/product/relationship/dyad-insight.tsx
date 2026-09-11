import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, HeartHandshake, Sparkles } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { analyzeDyad } from './dyad-analysis.ts';
import { buildDyadInsightPrompt, dyadHeadline } from './dyad-prompts.ts';
import { buildInferTypePrompt } from './infer-type.ts';
import { parseInferredType } from '../../domain/type-suggestion.ts';
import type { FourLetterType } from '../../domain/typology.ts';
import type { Relationship } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';
import { AiError, LoadingRead, ReadFeedback } from '../components/primitives.tsx';
import { ReadingHistory, useReadingHistory } from '../components/reading-history.tsx';
import { TypeReferenceControl } from '../components/record-editors.tsx';

export function DyadInsight({
  relationship,
  other,
  onDirtyChange,
}: {
  relationship: Relationship;
  other: Subject | undefined;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const feedback = useInscapeStore((s) => s.setReadingFeedback);
  const setType = useInscapeStore((s) => s.setOtherSubjectType);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const selfType = space?.self_subject.type_profile?.leading_type ?? null;
  const otherType = other?.type_profile?.leading_type ?? null;
  const locale = space?.settings.locale;
  const history = useReadingHistory('dyad-insight', relationship.id);
  const suggestions = useReadingHistory('type-suggestion', relationship.id);
  const [description, setDescription] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'infer' | 'generate'>('generate');
  const dirty =
    (!!description.trim() && description !== savedDescription) ||
    history.pending ||
    suggestions.pending;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const analysis = selfType && otherType ? analyzeDyad(selfType, otherType) : null;
  const suggestion = suggestions.record ? parseInferredType(suggestions.record.text) : null;
  async function assign(type: FourLetterType | null, readingId?: string) {
    if (working) return false;
    setWorking(true);
    try {
      return await setType(
        relationship.other_subject_id,
        type,
        new Date().toISOString(),
        readingId,
      );
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  async function infer() {
    if (working || suggestions.pending || !description.trim()) return;
    setWorking(true);
    setError(null);
    setLastAction('infer');
    const evidence = description.trim();
    try {
      setLoadingAi(true);
      const result = await client.generate(buildInferTypePrompt(evidence, locale));
      setLoadingAi(false);
      if (!result.ok) {
        setError(result.failure.detail);
        return;
      }
      const parsed = parseInferredType(result.text);
      if (!parsed.ok) {
        setError(t('DyadInsight.inferFailed'));
        return;
      }
      if (
        await suggestions.save({
          text: JSON.stringify(parsed.inferred),
          evidence,
          source_ids: [],
          reference_type: null,
          other_reference_type: null,
          refusal: null,
        })
      )
        setSavedDescription(description);
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  async function generate() {
    if (!analysis || working || history.pending) return;
    setWorking(true);
    setError(null);
    setLastAction('generate');
    try {
      const logs = relationship.communication_logs.slice(-10);
      const prompt = buildDyadInsightPrompt(
        analysis,
        locale,
        logs.map((log) => log.snippet),
      );
      setLoadingAi(true);
      const result = await client.generate(prompt);
      setLoadingAi(false);
      if (result.ok)
        await history.save({
          text: result.text,
          evidence: logs.length
            ? logs.map((log) => log.snippet).join('\n\n')
            : t('Repair.pairReference', { self: selfType, other: otherType }),
          source_ids: logs.map((log) => log.id),
          reference_type: selfType,
          other_reference_type: otherType,
          refusal: null,
        });
      else setError(result.failure.detail);
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  return (
    <div className="dyad-workshop">
      {!selfType && (
        <div className="inline-callout">
          <HeartHandshake size={24} />
          <p>
            {t(
              space?.self_subject.type_profile
                ? 'Repair.dyadNeedsClarity'
                : 'Experience.dyadNoSelf',
            )}
          </p>
        </div>
      )}
      <div className="record-tools">
        <TypeReferenceControl value={otherType} onSave={assign} />
      </div>
      <details className="type-suggestion-workshop">
        <summary>{t('Experience.aTentativeLens')}</summary>
        <p className="inline-note">{t('Experience.otherTypeNote')}</p>
        <div className="product-form">
          <label className="field-label" htmlFor={'describe-' + other?.id}>
            {t('DyadInsight.inferHint')}
          </label>
          <textarea
            id={'describe-' + other?.id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t('DyadInsight.descriptionPlaceholder')}
            disabled={working}
          />
          <button
            className="button button-secondary"
            disabled={working || suggestions.pending || !description.trim()}
            onClick={() => void infer()}
          >
            <Sparkles size={15} />
            {t('DyadInsight.infer')}
          </button>
        </div>
        {suggestions.record && suggestion?.ok && (
          <ReadFeedback
            key={suggestions.record.id}
            record={suggestions.record}
            unsaved={suggestions.pending}
            onDiscard={suggestions.discard}
            onSave={() =>
              void suggestions.retry().then((id) => {
                if (id) setSavedDescription(description);
              })
            }
          >
            <div className="calibration-card">
              <h3>{t('Experience.otherSuggestion', { type: suggestion.inferred.type })}</h3>
              <p>{suggestion.inferred.rationale}</p>
              <p>{t('Experience.otherSuggestionNote')}</p>
              <button
                className="button button-secondary"
                disabled={working || suggestions.pending}
                aria-pressed={suggestions.record.feedback === 'rejected'}
                onClick={() =>
                  void feedback(
                    suggestions.record!.id,
                    suggestions.record!.feedback === 'rejected' ? null : 'rejected',
                    new Date().toISOString(),
                  )
                }
              >
                {t('Experience.keepAsIs')}
              </button>
              <button
                className="button button-primary"
                disabled={working || suggestions.pending || otherType === suggestion.inferred.type}
                onClick={() => void assign(suggestion.inferred.type, suggestions.record!.id)}
              >
                <Check size={15} />
                {t(
                  otherType === suggestion.inferred.type
                    ? 'Repair.currentReference'
                    : 'Experience.acceptTentatively',
                )}
              </button>
            </div>
          </ReadFeedback>
        )}
        {!suggestions.pending && (
          <ReadingHistory
            readings={suggestions.readings}
            selectedId={suggestions.record?.id}
            onSelect={suggestions.select}
          />
        )}
      </details>
      {analysis && (
        <>
          <div className="dyad-summary">
            <div className="dyad-type">
              <span>{t('Experience.you')}</span>
              <strong>{selfType}</strong>
              <small>
                {analysis.selfDominant} · {t('Functions.' + analysis.selfDominant + '.name')}
              </small>
            </div>
            <HeartHandshake size={32} strokeWidth={1.4} />
            <div className="dyad-type">
              <span>{other?.display_name}</span>
              <strong>{otherType}</strong>
              <small>
                {analysis.otherDominant} · {t('Functions.' + analysis.otherDominant + '.name')}
              </small>
            </div>
            <p>{dyadHeadline(analysis, locale)}</p>
          </div>
          <button
            className="button button-primary"
            disabled={working || history.pending}
            onClick={() => void generate()}
          >
            <Sparkles size={15} />
            {t('DyadInsight.generate')}
          </button>
        </>
      )}
      {loadingAi && <LoadingRead />}
      {error && (
        <AiError
          detail={error}
          onRetry={() => void (lastAction === 'infer' ? infer() : generate())}
        />
      )}
      {history.record && (
        <ReadFeedback
          key={history.record.id}
          record={history.record}
          unsaved={history.pending}
          onDiscard={history.discard}
          onSave={() => void history.retry()}
        />
      )}
      {!history.pending && (
        <ReadingHistory
          readings={history.readings}
          selectedId={history.record?.id}
          onSelect={history.select}
        />
      )}
    </div>
  );
}
