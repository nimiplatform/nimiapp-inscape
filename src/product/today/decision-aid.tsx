// IS-IA / IS-AI — Eight-function decision aid (Mode B variant). Walks the
// user's Beebe stack through a decision, revealing blind spots; never
// prescribes a choice. Requires a type prior.

import { useMemo, useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildDecisionAidPrompt } from './today-prompts.ts';

const MAX_DECISION = 500;

export function DecisionAid() {
  const space = useInscapeStore((s) => s.space);
  const profile = space?.self_subject.type_profile ?? null;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [decision, setDecision] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    const trimmed = decision.trim();
    if (!trimmed || working || !profile) return;
    setWorking(true);
    setOutput(null);
    setError(null);
    const result = await client.generate(buildDecisionAidPrompt(trimmed, profile));
    if (result.ok) {
      setOutput(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">决策辅助 · 八功能</h3>
      {!profile && <p className="text-xs opacity-60">先在「自我」建立类型先验。</p>}
      <textarea
        value={decision}
        maxLength={MAX_DECISION}
        onChange={(e) => setDecision(e.target.value)}
        rows={3}
        placeholder="描述你面临的决策（≤500 字）…"
        className="w-full rounded border border-black/15 p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void onRun()}
        disabled={working || !decision.trim() || !profile}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? '走查中…' : '走查八功能'}
      </button>
      {output && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {output}
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}
    </div>
  );
}
