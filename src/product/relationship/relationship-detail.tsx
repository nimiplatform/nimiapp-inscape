// IS-IA / IS-AI — relationship detail: paste conversation snippets (user-driven
// only) and run a Mode D friction read (two-sided). Communication rewrite
// (Mode C, 4-layer anti-manipulation) lands in wave-4.

import { useMemo, useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildFrictionPrompt } from './relationship-prompts.ts';
import { CommunicationRewrite } from './communication-rewrite.tsx';
import type { Relationship } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';

export function RelationshipDetail({
  relationship,
  other,
}: {
  relationship: Relationship;
  other: Subject | undefined;
}) {
  const addCommunicationLog = useInscapeStore((s) => s.addCommunicationLog);
  const quarantineOtherSubject = useInscapeStore((s) => s.quarantineOtherSubject);
  const space = useInscapeStore((s) => s.space);
  const selfLeading = space?.self_subject.type_profile?.leading_type ?? null;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [snippet, setSnippet] = useState('');
  const [friction, setFriction] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmQuarantine, setConfirmQuarantine] = useState(false);

  function onAddSnippet() {
    const trimmed = snippet.trim();
    if (!trimmed) return;
    void addCommunicationLog(relationship.id, trimmed, new Date().toISOString());
    setSnippet('');
  }

  async function onAnalyze() {
    if (working || relationship.communication_logs.length === 0) return;
    setWorking(true);
    setFriction(null);
    setError(null);
    const result = await client.generate(
      buildFrictionPrompt(
        relationship.communication_logs.map((l) => l.snippet),
        selfLeading,
        relationship.nature,
      ),
    );
    if (result.ok) {
      setFriction(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  return (
    <div className="space-y-2 rounded border border-black/10 p-3">
      <h4 className="text-sm font-medium">
        {other?.display_name ?? '（未知）'} · {relationship.nature}
      </h4>
      <div className="flex gap-2">
        <input
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
          placeholder="粘贴一段对话片段…"
          className="flex-1 rounded border border-black/15 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onAddSnippet}
          disabled={!snippet.trim()}
          className="rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-40"
        >
          添加片段
        </button>
      </div>
      <p className="text-xs opacity-60">已收集 {relationship.communication_logs.length} 段片段。</p>
      <button
        type="button"
        onClick={() => void onAnalyze()}
        disabled={working || relationship.communication_logs.length === 0}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? '分析中…' : '分析摩擦模式'}
      </button>
      {friction && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {friction}
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}

      <div className="border-t border-black/10 pt-3">
        <CommunicationRewrite
          recipientName={other?.display_name ?? '（未知）'}
          nature={relationship.nature}
        />
      </div>

      <div className="border-t border-black/10 pt-3">
        {confirmQuarantine ? (
          <div className="space-y-1 text-xs">
            <p className="text-amber-700">
              确认此人未满 18 岁？该主体将立即从所有分析中移除并移入隔离区（IS-PRIV-03）。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void quarantineOtherSubject(relationship.other_subject_id, new Date().toISOString())
                }
                className="rounded bg-amber-600 px-2 py-1 text-white"
              >
                确认隔离
              </button>
              <button
                type="button"
                onClick={() => setConfirmQuarantine(false)}
                className="rounded border border-black/15 px-2 py-1"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmQuarantine(true)}
            className="text-xs text-amber-700 hover:underline"
          >
            标记此人未满 18 岁
          </button>
        )}
      </div>
    </div>
  );
}
