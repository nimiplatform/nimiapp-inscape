// IS-DATA / IS-PRIV — add an other_person to the relationship graph. Both the
// 18+ confirmation and the observation-framing attestation are required (the
// SQLite CHECKs enforce them too).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import type { RelationshipNature } from '../../domain/relationship.ts';

const NATURES: readonly RelationshipNature[] = [
  'partner',
  'parent',
  'child',
  'sibling',
  'friend',
  'coworker',
  'mentor',
  'other',
];

export function AddPersonForm({
  onAdded,
  onDirtyChange,
}: {
  onAdded?: (relationshipId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const addPerson = useInscapeStore((s) => s.addPerson);
  const [name, setName] = useState('');
  const [nature, setNature] = useState<RelationshipNature>('friend');
  const [adult, setAdult] = useState(false);
  const [observation, setObservation] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = !!name.trim() || nature !== 'friend' || adult || observation;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const ready = name.trim().length > 0 && adult && observation && !saving;

  async function onAdd() {
    if (!ready) return;
    setSaving(true);
    const id = await addPerson(name.trim(), nature, new Date().toISOString());
    if (!id) {
      setSaving(false);
      return;
    }
    setName('');
    setNature('friend');
    setAdult(false);
    setObservation(false);
    setSaving(false);
    onAdded?.(id);
  }

  return (
    <div className="product-form space-y-4">
      <h3 className="text-sm font-medium">{t('AddPerson.title')}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          aria-label={t('AddPerson.namePlaceholder')}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('AddPerson.namePlaceholder')}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        />
        <select
          value={nature}
          aria-label={t('Repair.relationshipKind')}
          onChange={(e) => setNature(e.target.value as RelationshipNature)}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        >
          {NATURES.map((n) => (
            <option key={n} value={n}>
              {t(`RelationshipNature.${n}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>{t('AddPerson.adult')}</span>
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={observation}
          onChange={(e) => setObservation(e.target.checked)}
        />
        <span>{t('AddPerson.observation')}</span>
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={() => void onAdd()}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {t('AddPerson.add')}
      </button>
    </div>
  );
}
