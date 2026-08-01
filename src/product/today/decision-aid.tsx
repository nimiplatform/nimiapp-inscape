// IS-IA / IS-AI — Eight-function decision aid (Mode B variant). Walks the
// user's Beebe stack through a decision, revealing blind spots; never
// prescribes a choice. Requires a type prior.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nimiToast } from '@nimiplatform/kit/ui';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildDecisionAidPrompt } from './today-prompts.ts';

const MAX_DECISION = 500;

export function DecisionAid() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const profile = space?.self_subject.type_profile ?? null;
  const locale = space?.settings.locale;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [decision, setDecision] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function onRun() {
    const trimmed = decision.trim();
    if (!trimmed || working || !profile) return;
    setWorking(true);
    setOutput(null);
    const result = await client.generate(buildDecisionAidPrompt(trimmed, profile, locale));
    if (result.ok) {
      setOutput(result.text);
    } else {
      nimiToast.danger(
        t('Common.aiUnavailable', { error: `${result.failure.kind}: ${result.failure.detail}` }),
      );
    }
    setWorking(false);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t('DecisionAid.title')}</h3>
      {!profile && <p className="text-xs opacity-60">{t('DecisionAid.needsProfile')}</p>}
      <textarea
        value={decision}
        maxLength={MAX_DECISION}
        onChange={(e) => setDecision(e.target.value)}
        rows={3}
        placeholder={t('DecisionAid.placeholder')}
        className="w-full rounded border border-black/15 p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void onRun()}
        disabled={working || !decision.trim() || !profile}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? t('DecisionAid.running') : t('DecisionAid.run')}
      </button>
      {output && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {output}
        </div>
      )}
    </div>
  );
}
