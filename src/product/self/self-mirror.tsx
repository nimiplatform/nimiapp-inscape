import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Sparkles } from 'lucide-react';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { analyzeSelf } from './self-analysis.ts';
import { buildSelfMirrorPrompt } from './self-prompts.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';
import { ReadingHistory, useReadingHistory } from '../components/reading-history.tsx';
import { AiError, LoadingRead, ReadFeedback } from '../components/primitives.tsx';

export function SelfMirror({ profile }: { profile: TypeProfile | null }) {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const locale = space?.settings.locale;
  const recent = (space?.self_subject.reflection_entries ?? []).slice(-3);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const history = useReadingHistory('self-mirror');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const analysis = profile ? analyzeSelf(profile) : null;
  async function generate() {
    if (!recent.length || working || history.pending) return;
    setWorking(true);
    setError(null);
    const prompt = buildSelfMirrorPrompt(
      analysis,
      locale,
      recent.map((entry) => entry.text),
    );
    setLoadingAi(true);
    const result = await client.generate(prompt);
    setLoadingAi(false);
    if (result.ok)
      await history.save({
        text: result.text,
        evidence: recent.map((entry) => entry.text).join('\n\n'),
        source_ids: recent.map((entry) => entry.id),
        reference_type: profile?.leading_type ?? null,
        refusal: null,
        other_reference_type: null,
      });
    else setError(result.failure.detail);
    setWorking(false);
    setLoadingAi(false);
  }
  if (!profile && !recent.length && !history.record) return null;
  return (
    <div className="mirror-section">
      <div className="feature-section-heading">
        <span className="round-icon">
          <Fingerprint size={23} />
        </span>
        <div>
          <h2>{t('Experience.selfMirrorTitle')}</h2>
          <p>{t('Experience.selfMirrorDescription')}</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => void generate()}
          disabled={working || history.pending || !recent.length}
        >
          <Sparkles size={15} />
          {t('Experience.mirrorAction')}
        </button>
      </div>
      {loadingAi && <LoadingRead />}
      {error && <AiError detail={error} onRetry={() => void generate()} />}
      {!recent.length && <p className="inline-note">{t('Repair.mirrorNeedsNotes')}</p>}
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
