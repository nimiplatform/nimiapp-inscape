// Wave-3.2 — establish the type prior. Inscape's target user already knows
// their 4-letter code from an online test; entering it seeds the posterior
// (a prior, not a verdict). A full in-app item test is a later alternative.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FOUR_LETTER_TYPES,
  isFourLetterType,
  type FourLetterType,
} from '../../domain/typology.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function InitialTyping() {
  const { t } = useTranslation();
  const setInitialType = useInscapeStore((s) => s.setInitialType);
  const [code, setCode] = useState('');
  const valid = isFourLetterType(code);

  function onCreate() {
    if (!valid) return;
    void setInitialType(code as FourLetterType, new Date().toISOString());
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t('InitialTyping.title')}</h3>
      <p className="text-sm opacity-70">{t('InitialTyping.description')}</p>
      <div className="flex items-center gap-2">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        >
          <option value="">{t('InitialTyping.placeholder')}</option>
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
          {t('InitialTyping.create')}
        </button>
      </div>
    </div>
  );
}
