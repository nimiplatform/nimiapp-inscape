import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nimiToast } from '@nimiplatform/kit/ui';
import { Check, Copy, Sparkles } from 'lucide-react';
import { AiError, LoadingRead, ReadFeedback } from '../components/primitives.tsx';
import { ReadingHistory, useReadingHistory } from '../components/reading-history.tsx';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { classifyRewriteContext } from './rewrite-classifier.ts';
import { buildRewritePrompt } from './rewrite-prompts.ts';
import { parseRewriteResult } from '../../domain/rewrite.ts';
import type { RelationshipNature } from '../../domain/relationship.ts';

export function CommunicationRewrite({
  relationshipId,
  recipientName,
  nature,
  onDirtyChange,
}: {
  relationshipId: string;
  recipientName: string;
  nature: RelationshipNature;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const history = useReadingHistory('communication-rewrite', relationshipId);
  const [draft, setDraft] = useState('');
  const [savedInput, setSavedInput] = useState('');
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const dirty = (!!draft.trim() && draft !== savedInput) || history.pending;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    setCopied(null);
  }, [history.record?.id]);
  const result =
    history.record && !history.record.refusal ? parseRewriteResult(history.record.text) : null;

  // @nimi-authority: rule.inscape.privacy.r004
  async function onRewrite() {
    const trimmed = draft.trim();
    if (!trimmed || working || history.pending) return;
    setWorking(true);
    setError(null);
    setCopied(null);
    const reference_type = space?.self_subject.type_profile?.leading_type ?? null;
    try {
      const classification = classifyRewriteContext(trimmed);
      if (!classification.ok) {
        if (
          await history.save({
            evidence: trimmed,
            source_ids: [],
            text: '',
            reference_type: null,
            other_reference_type: null,
            refusal: classification.category,
          })
        )
          setSavedInput(draft);
        return;
      }
      setLoadingAi(true);
      const generated = await client.generate(
        buildRewritePrompt(trimmed, recipientName, nature, reference_type, space?.settings.locale),
      );
      setLoadingAi(false);
      if (!generated.ok) {
        setError(generated.failure.detail);
        return;
      }
      const parsed = parseRewriteResult(generated.text);
      if (!parsed) {
        setError(t('Experience.invalidRewrite'));
        return;
      }
      if (
        await history.save({
          evidence: trimmed,
          source_ids: [],
          text: JSON.stringify(parsed),
          reference_type,
          other_reference_type: null,
          refusal: null,
        })
      )
        setSavedInput(draft);
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  return (
    <div className="rewrite-workshop">
      <h4>{t('CommunicationRewrite.title')}</h4>
      <p className="inline-note">{t('Experience.rewriteDescription')}</p>
      <textarea
        aria-label={t('CommunicationRewrite.title')}
        maxLength={2000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder={t('CommunicationRewrite.placeholder')}
        disabled={working}
      />
      <button
        type="button"
        className="button button-primary"
        disabled={working || history.pending || !draft.trim()}
        onClick={() => void onRewrite()}
      >
        <Sparkles size={15} />
        {t(working ? 'CommunicationRewrite.rewriting' : 'CommunicationRewrite.generate')}
      </button>
      {loadingAi && <LoadingRead />}
      {error && <AiError detail={error} onRetry={() => void onRewrite()} />}
      {history.record && (
        <ReadFeedback
          key={history.record.id}
          record={history.record}
          unsaved={history.pending}
          onDiscard={history.discard}
          onSave={() =>
            void history.retry().then((id) => {
              if (id) setSavedInput(draft);
            })
          }
        >
          {result && (
            <>
              <div className="rewrite-variants">
                {result.variants.map((variant, index) => (
                  <div className="rewrite-variant" key={variant.text}>
                    <div className="variant-heading">
                      <span className="variant-number">0{index + 1}</span>
                      <h5>{variant.tone}</h5>
                      <button
                        className="text-link"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(variant.text)
                            .then(() => setCopied(index))
                            .catch(() => nimiToast.warning(t('Experience.copyFailed')));
                        }}
                      >
                        {copied === index ? <Check size={14} /> : <Copy size={14} />}
                        {t(copied === index ? 'Experience.copied' : 'Experience.copyThisDraft')}
                      </button>
                    </div>
                    <p>{variant.text}</p>
                    <small>{variant.note}</small>
                  </div>
                ))}
              </div>
              <p className="rewrite-disclaimer">{t('CommunicationRewrite.disclaimer')}</p>
            </>
          )}
        </ReadFeedback>
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
