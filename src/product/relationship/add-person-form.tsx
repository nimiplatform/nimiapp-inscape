// IS-DATA / IS-PRIV — add an other_person to the relationship graph. Both the
// 18+ confirmation and the observation-framing attestation are required (the
// SQLite CHECKs enforce them too).

import { useState } from 'react';
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

export function AddPersonForm() {
  const { t } = useTranslation();
  const addPerson = useInscapeStore((s) => s.addPerson);
  const [name, setName] = useState('');
  const [nature, setNature] = useState<RelationshipNature>('friend');
  const [adult, setAdult] = useState(false);
  const [observation, setObservation] = useState(false);
  const ready = name.trim().length > 0 && adult && observation;

  function onAdd() {
    if (!ready) return;
    void addPerson(name.trim(), nature, new Date().toISOString());
    setName('');
    setNature('friend');
    setAdult(false);
    setObservation(false);
  }

  return (
    <div className="space-y-2 rounded border border-black/10 p-3">
      <h3 className="text-sm font-medium">{t('AddPerson.title')}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('AddPerson.namePlaceholder')}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        />
        <select
          value={nature}
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
        onClick={onAdd}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {t('AddPerson.add')}
      </button>
    </div>
  );
}
