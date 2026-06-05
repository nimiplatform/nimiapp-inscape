// IS-PRIV-04 / T1-10 — communication rewrite with the 4-layer anti-manipulation
// defence: (1) prompt hard-injection, (2) keyword classifier refusing before
// any AI call, (3) mandatory one-sided disclaimer on every output, (4) a
// session rewrite history the user can review. Full RewriteHistoryCorpus
// persistence is an Extended-layer addition.

import { useMemo, useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import {
  classifyRewriteContext,
  type RefusalCategory,
} from './rewrite-classifier.ts';
import { buildRewritePrompt, REWRITE_DISCLAIMER } from './rewrite-prompts.ts';
import type { RelationshipNature } from '../../domain/relationship.ts';

type Refusal = { category: RefusalCategory; reason: string };

export function CommunicationRewrite({
  recipientName,
  nature,
}: {
  recipientName: string;
  nature: RelationshipNature;
}) {
  const space = useInscapeStore((s) => s.space);
  const selfLeading = space?.self_subject.type_profile?.leading_type ?? null;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [rewrites, setRewrites] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly string[]>([]);

  async function onRewrite() {
    const trimmed = draft.trim();
    if (!trimmed || working) return;
    setWorking(true);
    setRefusal(null);
    setRewrites(null);
    setError(null);

    // Layer 2: classify BEFORE any AI call. Refused contexts never reach the model.
    const classification = classifyRewriteContext(trimmed);
    if (!classification.ok) {
      setRefusal({ category: classification.category, reason: classification.reason });
      setWorking(false);
      return;
    }

    // Layer 1: hard-injected anti-manipulation prompt.
    const result = await client.generate(buildRewritePrompt(trimmed, recipientName, nature, selfLeading));
    if (result.ok) {
      setRewrites(result.text);
      setHistory((h) => [trimmed, ...h].slice(0, 10)); // Layer 4 (session)
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">沟通改写</h4>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="粘贴你打算发送的草稿…"
        className="w-full rounded border border-black/15 p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void onRewrite()}
        disabled={working || !draft.trim()}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? '改写中…' : '生成改写'}
      </button>

      {refusal && (
        <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p>{refusal.reason}</p>
          <p className="opacity-70">
            试试「今日」的反思日记：这条信息想要保护的是什么？Inscape 可以帮你看清底层的读法，但不会帮你写施压信息。
          </p>
        </div>
      )}

      {rewrites && (
        <div className="space-y-2 rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          <p className="whitespace-pre-wrap">{rewrites}</p>
          {/* Layer 3: mandatory disclaimer on every output. */}
          <p className="border-t border-black/10 pt-2 text-xs opacity-70">{REWRITE_DISCLAIMER}</p>
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}

      {history.length > 0 && (
        <details className="text-xs opacity-70">
          <summary>本次会话的改写历史（{history.length}）</summary>
          <ul className="mt-1 space-y-0.5">
            {history.map((draftText, index) => (
              <li key={`${index}-${draftText.slice(0, 8)}`}>· {draftText}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
