import { useEffect, useMemo, useState } from 'react';
import { SegmentedControl, nimiToast } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_INSCAPE_LOCALE,
  INSCAPE_LOCALES,
  normalizeInscapeLocale,
  type InscapeLocale,
} from '../../domain/locale.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

function useLanguageItems(disabled: boolean) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      INSCAPE_LOCALES.map((locale) => ({
        value: locale,
        label: t(`Language.short.${locale}`),
        disabled,
      })),
    [disabled, t],
  );
}

function currentI18nLocale(language: string | undefined): InscapeLocale {
  return normalizeInscapeLocale(language) ?? DEFAULT_INSCAPE_LOCALE;
}

export function usePersistedInscapeLocaleSync() {
  const { i18n } = useTranslation();
  const locale = useInscapeStore((s) => s.space?.settings.locale ?? null);

  useEffect(() => {
    if (!locale) return;
    const active = currentI18nLocale(i18n.resolvedLanguage || i18n.language);
    if (active === locale) return;
    void i18n.changeLanguage(locale);
  }, [i18n, locale]);
}

export function StandaloneLanguageSwitch({ className }: { readonly className?: string }) {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState(false);
  const value = currentI18nLocale(i18n.resolvedLanguage || i18n.language);
  const items = useLanguageItems(pending);

  async function changeLanguage(next: string) {
    const locale = normalizeInscapeLocale(next);
    if (!locale || locale === value || pending) return;
    setPending(true);
    await i18n.changeLanguage(locale);
    setPending(false);
  }

  return (
    <SegmentedControl
      ariaLabel={t('Language.ariaLabel')}
      size="sm"
      value={value}
      onValueChange={(next: string) => {
        void changeLanguage(next);
      }}
      items={items}
      className={className}
    />
  );
}

export function PersistedLanguageSwitch({ className }: { readonly className?: string }) {
  const { t, i18n } = useTranslation();
  const locale = useInscapeStore((s) => s.space?.settings.locale ?? DEFAULT_INSCAPE_LOCALE);
  const setLocale = useInscapeStore((s) => s.setLocale);
  const [saving, setSaving] = useState(false);
  const items = useLanguageItems(saving);

  async function changeLanguage(next: string) {
    const normalized = normalizeInscapeLocale(next);
    if (!normalized || normalized === locale || saving) return;
    setSaving(true);
    const saved = await setLocale(normalized, new Date().toISOString());
    setSaving(false);
    if (!saved) {
      nimiToast.danger(t('Language.persistFailed'));
      return;
    }
    await i18n.changeLanguage(normalized);
  }

  return (
    <SegmentedControl
      ariaLabel={t('Language.ariaLabel')}
      size="sm"
      value={locale}
      onValueChange={(next: string) => {
        void changeLanguage(next);
      }}
      items={items}
      className={className}
    />
  );
}
