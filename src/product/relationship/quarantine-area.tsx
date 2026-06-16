// IS-PRIV-03 — under-18 quarantine area. Quarantined subjects are removed from
// all analysis; their raw data is retained verbatim and never processed. The
// user may permanently delete it or leave it quarantined. No guardian-facing
// UI, no minor-mode surface.

import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function QuarantineArea() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const deleteQuarantineRecord = useInscapeStore((s) => s.deleteQuarantineRecord);
  const records = space?.quarantine ?? [];
  if (records.length === 0) return null;

  return (
    <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
      <h3 className="text-sm font-medium text-amber-800">{t('Quarantine.title')}</h3>
      <p className="text-xs opacity-70">{t('Quarantine.description')}</p>
      <ul className="space-y-1 text-xs">
        {records.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-2">
            <span className="opacity-70">
              {t('Quarantine.quarantinedAt', { time: record.quarantined_at })}
            </span>
            <button
              type="button"
              onClick={() => void deleteQuarantineRecord(record.id, new Date().toISOString())}
              className="rounded border border-black/15 px-2 py-0.5"
            >
              {t('Quarantine.delete')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
