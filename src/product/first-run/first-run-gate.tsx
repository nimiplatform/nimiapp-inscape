// Wave-3.1 — first-run 18+ attestation gate (Scenario 1 / IS-PRIV-01). Both
// boxes must be checked before a space is created and persisted. The initial
// 60-item test (the first TypingEpisode) lands in wave-3.2; this gate only
// establishes the adult-attested space.

import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox } from '@nimiplatform/kit/ui';
import { ArrowRight, Leaf } from 'lucide-react';
import { Brand } from '../components/primitives.tsx';
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
    const locale =
      normalizeInscapeLocale(i18n.resolvedLanguage || i18n.language) ?? DEFAULT_INSCAPE_LOCALE;
    void completeFirstRun(new Date().toISOString(), locale).finally(() => setSubmitting(false));
  }

  return (
    <div className="welcome-screen">
      <section className="welcome-story">
        <Brand />
        <div className="welcome-words">
          <span className="eyebrow">{t('Experience.welcomeEyebrow')}</span>
          <h1>
            {t('Experience.welcomeTitle1')}
            <br />
            {t('Experience.welcomeTitle2')}
          </h1>
          <p>{t('Experience.welcomeDescription')}</p>
        </div>
        <small>{t('Experience.welcomeSmall')}</small>
      </section>
      <section className="welcome-gate">
        <div>
          <div className="welcome-language">
            <StandaloneLanguageSwitch />
          </div>
          <span className="round-icon">
            <Leaf size={25} strokeWidth={1.5} />
          </span>
          <h2>{t('Experience.welcomeStart')}</h2>
          <p>{t('Experience.welcomeGateNote')}</p>
          <div className="welcome-attestations">
            <AttestRow checked={adult} onChange={(e) => setAdult(e.target.checked)}>
              {t('FirstRun.adult')}
            </AttestRow>
            <AttestRow checked={understood} onChange={(e) => setUnderstood(e.target.checked)}>
              {t('FirstRun.understood')}
            </AttestRow>
          </div>
          <Button
            type="button"
            tone="primary"
            size="lg"
            fullWidth
            disabled={!ready}
            loading={submitting}
            onClick={onContinue}
          >
            {t('FirstRun.continue')}
            <ArrowRight size={17} />
          </Button>
          <p className="welcome-local-note">{t('FirstRun.localNote')}</p>
        </div>
      </section>
    </div>
  );
}

function AttestRow({
  checked,
  onChange,
  children,
}: {
  readonly checked: boolean;
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly children: ReactNode;
}) {
  const base =
    'flex cursor-pointer items-start gap-3 rounded-[var(--inscape-radius-lg)] border p-4 text-sm leading-relaxed transition-colors';
  const state = checked
    ? 'border-[var(--inscape-brand-primary)] bg-[var(--inscape-brand-soft)]'
    : 'border-[var(--inscape-border-default)] bg-[var(--inscape-surface-card-quiet)] hover:border-[var(--inscape-border-strong)]';
  return (
    <label className={`${base} ${state}`}>
      <Checkbox checked={checked} onChange={onChange} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </label>
  );
}
