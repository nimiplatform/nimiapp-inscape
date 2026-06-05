// IS-IA / IS-AI — the "你 × Ta" dyad insight surface. The headline relational
// value: assign the other person a type, then read how the two function stacks
// interact (共鸣 / 摩擦 / 互补 / 破冰). The deterministic skeleton is shown
// directly; the narrative is LLM, grounded in that skeleton.

import { useMemo, useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { analyzeDyad } from './dyad-analysis.ts';
import { buildDyadInsightPrompt, dominantRelationLabel, dyadHeadline } from './dyad-prompts.ts';
import { buildInferTypePrompt, parseInferredType } from './infer-type.ts';
import {
  FOUR_LETTER_TYPES,
  isFourLetterType,
  type FourLetterType,
} from '../../domain/typology.ts';
import type { Relationship } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';

export function DyadInsight({
  relationship,
  other,
}: {
  relationship: Relationship;
  other: Subject | undefined;
}) {
  const space = useInscapeStore((s) => s.space);
  const setOtherSubjectType = useInscapeStore((s) => s.setOtherSubjectType);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const selfType = space?.self_subject.type_profile?.leading_type ?? null;
  const otherType = other?.type_profile?.leading_type ?? null;

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = selfType && otherType ? analyzeDyad(selfType, otherType) : null;

  async function onGenerate() {
    if (!analysis || working) return;
    setWorking(true);
    setInsight(null);
    setError(null);
    const result = await client.generate(buildDyadInsightPrompt(analysis));
    if (result.ok) {
      setInsight(result.text);
    } else {
      setError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setWorking(false);
  }

  async function onInfer() {
    const trimmed = description.trim();
    if (!trimmed || inferring) return;
    setInferring(true);
    setInferError(null);
    const result = await client.generate(buildInferTypePrompt(trimmed));
    if (result.ok) {
      const parsed = parseInferredType(result.text);
      if (parsed.ok) {
        void setOtherSubjectType(
          relationship.other_subject_id,
          parsed.inferred.type,
          new Date().toISOString(),
        );
      } else {
        setInferError('未能从描述中可靠推断类型，请直接选择代码。');
      }
    } else {
      setInferError(`${result.failure.kind}: ${result.failure.detail}`);
    }
    setInferring(false);
  }

  if (!selfType) {
    return <p className="text-xs opacity-60">先在「自我」建立你的类型，才能看你们的相处洞察。</p>;
  }

  if (!otherType || !analysis) {
    const valid = isFourLetterType(code);
    return (
      <div className="space-y-2">
        <p className="text-sm">给 {other?.display_name ?? '对方'} 一个类型，解锁「你 × Ta」相处洞察：</p>
        <div className="flex items-center gap-2">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded border border-black/15 px-2 py-1 text-sm"
          >
            <option value="">选择 4 字母代码…</option>
            {FOUR_LETTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              valid &&
              void setOtherSubjectType(
                relationship.other_subject_id,
                code as FourLetterType,
                new Date().toISOString(),
              )
            }
            className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            设定
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs opacity-70">不知道 ta 的代码？用几句话描述，让 Inscape 推断：</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="ta 是个什么样的人？（例如：常推动快速决策，逻辑强，喜欢主导）"
            className="w-full rounded border border-black/15 p-2 text-sm"
          />
          <button
            type="button"
            disabled={inferring || !description.trim()}
            onClick={() => void onInfer()}
            className="rounded border border-black/15 px-3 py-1 text-sm disabled:opacity-40"
          >
            {inferring ? '推断中…' : '用描述推断'}
          </button>
          {inferError && <p className="text-xs opacity-60">{inferError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">
        你（{selfType}）× Ta（{otherType}）
      </h4>
      <ul className="space-y-0.5 text-xs opacity-70">
        <li>
          共享维度：{analysis.sharedDichotomies.join('、') || '无'}；差异维度：
          {analysis.differingDichotomies.join('、') || '无'}
        </li>
        <li>
          主导：你 {analysis.selfDominant} / ta {analysis.otherDominant}（{dominantRelationLabel(analysis)}）
        </li>
        <li>动态：{dyadHeadline(analysis)}</li>
        {analysis.sharedEgoFunctions.length > 0 && (
          <li>共享自我功能：{analysis.sharedEgoFunctions.join('、')}</li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={working}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? '生成中…' : '生成相处洞察'}
      </button>
      {insight && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {insight}
        </div>
      )}
      {error && <p className="text-xs opacity-60">AI 暂不可用（{error}）。</p>}
    </div>
  );
}
