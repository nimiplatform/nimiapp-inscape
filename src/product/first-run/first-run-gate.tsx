// Wave-3.1 — first-run 18+ attestation gate (Scenario 1 / IS-PRIV-01). Both
// boxes must be checked before a space is created and persisted. The initial
// 60-item test (the first TypingEpisode) lands in wave-3.2; this gate only
// establishes the adult-attested space.

import { useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function FirstRunGate() {
  const completeFirstRun = useInscapeStore((s) => s.completeFirstRun);
  const [adult, setAdult] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ready = adult && understood && !submitting;

  function onContinue() {
    setSubmitting(true);
    void completeFirstRun(new Date().toISOString());
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-5 p-8">
      <h1 className="text-xl font-semibold">心相 · Inscape</h1>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>我已年满 18 周岁。</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span>我理解 Inscape 不是心理诊断工具；如有心理困扰我会寻求专业帮助。</span>
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={onContinue}
        className="self-start rounded bg-black/80 px-4 py-2 text-white disabled:opacity-40"
      >
        继续
      </button>
    </div>
  );
}
