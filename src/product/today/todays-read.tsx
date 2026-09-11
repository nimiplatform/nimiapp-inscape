import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildTodaysReadPrompt } from './today-prompts.ts';
import { AiError, LoadingRead, ReadFeedback } from '../components/primitives.tsx';
import { ReadingHistory, useReadingHistory } from '../components/reading-history.tsx';

export function TodaysRead() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const history = useReadingHistory('today-read');
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = (space?.self_subject.reflection_entries ?? []).slice(-3);
  async function generate() {
    if (working || history.pending || !recent.length) return;
    setWorking(true);
    setError(null);
    try {
      setLoadingAi(true);
      const result = await client.generate(
        buildTodaysReadPrompt(
          recent.map((r) => r.text),
          space?.self_subject.type_profile ?? null,
          space?.settings.locale,
        ),
      );
      setLoadingAi(false);
      if (result.ok)
        await history.save({
          text: result.text,
          evidence: recent.map((r) => r.text).join('\n\n'),
          source_ids: recent.map((r) => r.id),
          reference_type: space?.self_subject.type_profile?.leading_type ?? null,
          refusal: null,
          other_reference_type: null,
        });
      else setError(result.failure.detail);
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  return (
    <div className="today-read">
      <p className="inline-note">{t('Experience.todayReadNote')}</p>
      <button
        className="button button-secondary"
        onClick={() => void generate()}
        disabled={working || history.pending || !recent.length}
      >
        <Sparkles size={15} />
        {t('Experience.todayReadAction')}
      </button>
      {loadingAi && <LoadingRead />}
      {error && <AiError detail={error} onRetry={() => void generate()} />}
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
