// Wave-3.1 — first-run 18+ attestation gate (Scenario 1 / IS-PRIV-01). Both
// boxes must be checked before a space is created and persisted. The initial
// 60-item test (the first TypingEpisode) lands in wave-3.2; this gate only
// establishes the adult-attested space.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeInscapeLocale, DEFAULT_INSCAPE_LOCALE } from '../../domain/locale.ts';
import { StandaloneLanguageSwitch } from '../settings/language-switch.tsx';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function FirstRunGate() {
  const { t, i18n } = useTranslation();
  const completeFirstRun = useInscapeStore((s) => s.completeFirstRun);
  const [adult, setAdult] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ready = adult && understood && !submitting;

  function onContinue() {
    setSubmitting(true);
    const locale = normalizeInscapeLocale(i18n.resolvedLanguage || i18n.language) ?? DEFAULT_INSCAPE_LOCALE;
    void completeFirstRun(new Date().toISOString(), locale);
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-5 p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('App.brand')}</h1>
        <StandaloneLanguageSwitch />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>{t('FirstRun.adult')}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span>{t('FirstRun.understood')}</span>
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={onContinue}
        className="self-start rounded bg-black/80 px-4 py-2 text-white disabled:opacity-40"
      >
        {t('FirstRun.continue')}
      </button>
    </div>
  );
}
