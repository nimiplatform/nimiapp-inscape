// Wave-3.2 — establish the type prior. Inscape's target user already knows
// their 4-letter code from an online test; entering it seeds the posterior
// (a prior, not a verdict). A full in-app item test is a later alternative.

import { useState } from 'react';
import {
  FOUR_LETTER_TYPES,
  isFourLetterType,
  type FourLetterType,
} from '../../domain/typology.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function InitialTyping() {
  const setInitialType = useInscapeStore((s) => s.setInitialType);
  const [code, setCode] = useState('');
  const valid = isFourLetterType(code);

  function onCreate() {
    if (!valid) return;
    void setInitialType(code as FourLetterType, new Date().toISOString());
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">建立你的类型先验</h3>
      <p className="text-sm opacity-70">
        如果你已经测过 16 型并知道自己的 4 字母代码，先填它作为先验；反思会持续修正分布。
      </p>
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
          onClick={onCreate}
          className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          建立
        </button>
      </div>
    </div>
  );
}
