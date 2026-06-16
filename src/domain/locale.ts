export const INSCAPE_LOCALES = ['en', 'zh'] as const;

export type InscapeLocale = (typeof INSCAPE_LOCALES)[number];

export const DEFAULT_INSCAPE_LOCALE: InscapeLocale = 'en';

export function isInscapeLocale(value: unknown): value is InscapeLocale {
  return typeof value === 'string' && (INSCAPE_LOCALES as readonly string[]).includes(value);
}

export function normalizeInscapeLocale(value: string | null | undefined): InscapeLocale | null {
  const normalized = value?.trim().replace('_', '-').toLowerCase();
  if (!normalized) return null;
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh';
  return null;
}
