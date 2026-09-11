import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { ConfirmDialog, localDate } from '../components/interaction.tsx';

export function QuarantineArea() {
  const { t, i18n } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const remove = useInscapeStore((s) => s.deleteQuarantineRecord);
  const [selected, setSelected] = useState<string | null>(null);
  const records = space?.quarantine ?? [];
  if (!records.length) return null;
  return (
    <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
      <h3 className="text-sm font-medium">{t('Quarantine.title')}</h3>
      <p className="text-xs">{t('Quarantine.description')}</p>
      <ul className="space-y-2 text-xs">
        {records.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-2">
            <span>
              {t('Quarantine.quarantinedAt', {
                time: localDate(record.quarantined_at, i18n.language),
              })}
            </span>
            <button className="button button-secondary" onClick={() => setSelected(record.id)}>
              {t('Quarantine.delete')}
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!selected}
        title={t('Quarantine.delete')}
        description={t('Repair.deleteQuarantineBody')}
        confirmLabel={t('Repair.deletePermanently')}
        onCancel={() => setSelected(null)}
        onConfirm={() => (selected ? remove(selected, new Date().toISOString()) : false)}
      />
    </div>
  );
}
