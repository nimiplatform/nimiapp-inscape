// IS-IA / IS-AI — Today's read (Mode B). Grounded current-state read +
// what-you-can-do suggestions; ✓/✗ feedback records an ObservationEvent
// (a user-driven signal), 🔍 shows the reflections it was grounded in.

import { useMemo, useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildTodaysReadPrompt } from './today-prompts.ts';

export function TodaysRead() {
  const space = useInscapeStore((s) => s.space);
  const addObservationEvent = useInscapeStore((s) => s.addObservationEvent);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const profile = space?.self_subject.type_profile ?? null;
  const recent = (space?.self_subject.reflection_entries ?? []).slice(-3);

  const [read, setRead] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [feedback, setFeedback] = useState<'right' | 'wrong' | null>(null);

  async function onGenerate() {
    if (working) return;
    setWorking(true);
    setRead(null);
    setError(null);
    setFeedback(null);
    setShowEvidence(false);
    const result = await client.generate(buildTodaysReadPrompt(recent.map((r) => r.text), profile));
    if (result.ok) {
      setRead(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  function onFeedback(kind: 'right' | 'wrong') {
    setFeedback(kind);
    void addObservationEvent(`today-read feedback: ${kind}`, 'ai_read_feedback', new Date().toISOString());
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium">今日解读</h3>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={working}
          className="rounded bg-black/80 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          {working ? '生成中…' : '生成'}
        </button>
      </div>

      {read && (
        <div className="space-y-2 rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          <p className="whitespace-pre-wrap">{read}</p>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={() => onFeedback('right')} className="opacity-70 hover:opacity-100">
              ✓ 准
            </button>
            <button type="button" onClick={() => onFeedback('wrong')} className="opacity-70 hover:opacity-100">
              ✗ 不准
            </button>
            <button type="button" onClick={() => setShowEvidence((v) => !v)} className="opacity-70 hover:opacity-100">
              🔍 证据
            </button>
            {feedback && <span className="opacity-50">已记录反馈</span>}
          </div>
          {showEvidence && (
            <div className="text-xs opacity-70">
              {recent.length ? (
                <ul className="space-y-0.5">
                  {recent.map((r) => (
                    <li key={r.id}>· {r.text}</li>
                  ))}
                </ul>
              ) : (
                <span>无近期反思作为依据。</span>
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}
    </div>
  );
}
