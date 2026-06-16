// IS-IA / IS-AI — the self "mirror": turns the distribution into a recognizable
// narrative (你的引擎 / 盲区与劣势 / 压力之下 / 成长边), grounded in the Beebe
// stack + curated function semantics.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { analyzeSelf } from './self-analysis.ts';
import { buildSelfMirrorPrompt } from './self-prompts.ts';
import { functionCore } from '../insight/function-knowledge.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

export function SelfMirror({ profile }: { profile: TypeProfile }) {
  const { t } = useTranslation();
  const locale = useInscapeStore((s) => s.space?.settings.locale);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const [mirror, setMirror] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = analyzeSelf(profile);
  const core = functionCore(locale);

  async function onGenerate() {
    if (!analysis || working) return;
    setWorking(true);
    setMirror(null);
    setError(null);
    const result = await client.generate(buildSelfMirrorPrompt(analysis, locale));
    if (result.ok) {
      setMirror(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  if (!analysis) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium">{t('SelfMirror.title')}</h3>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={working}
          className="rounded bg-black/80 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          {working ? t('Common.generating') : t('Common.generate')}
        </button>
      </div>
      <ul className="space-y-0.5 text-xs opacity-70">
        <li>
          {t('SelfMirror.engine', {
            hero: analysis.hero,
            heroCore: core[analysis.hero],
            parent: analysis.parent,
          })}
        </li>
        <li>
          {t('SelfMirror.growthEdge', {
            inferior: analysis.inferior,
            inferiorCore: core[analysis.inferior],
          })}
        </li>
      </ul>
      {mirror && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {mirror}
        </div>
      )}
      {error && <p className="text-xs opacity-60">{t('Common.aiUnavailable', { error })}</p>}
    </div>
  );
}
