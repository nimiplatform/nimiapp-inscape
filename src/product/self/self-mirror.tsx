// IS-IA / IS-AI — the self "mirror": turns the distribution into a recognizable
// narrative (你的引擎 / 盲区与劣势 / 压力之下 / 成长边), grounded in the Beebe
// stack + curated function semantics.

import { useMemo, useState } from 'react';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { analyzeSelf } from './self-analysis.ts';
import { buildSelfMirrorPrompt } from './self-prompts.ts';
import { FUNCTION_CORE } from '../insight/function-knowledge.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

export function SelfMirror({ profile }: { profile: TypeProfile }) {
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const [mirror, setMirror] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = analyzeSelf(profile);

  async function onGenerate() {
    if (!analysis || working) return;
    setWorking(true);
    setMirror(null);
    setError(null);
    const result = await client.generate(buildSelfMirrorPrompt(analysis));
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
        <h3 className="text-sm font-medium">自我镜子</h3>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={working}
          className="rounded bg-black/80 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          {working ? '生成中…' : '生成'}
        </button>
      </div>
      <ul className="space-y-0.5 text-xs opacity-70">
        <li>
          引擎：{analysis.hero}（{FUNCTION_CORE[analysis.hero]}）+ {analysis.parent}
        </li>
        <li>
          成长 / 压力边：{analysis.inferior}（{FUNCTION_CORE[analysis.inferior]}）
        </li>
      </ul>
      {mirror && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {mirror}
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}
    </div>
  );
}
