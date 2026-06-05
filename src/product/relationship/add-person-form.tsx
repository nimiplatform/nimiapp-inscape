// IS-DATA / IS-PRIV — add an other_person to the relationship graph. Both the
// 18+ confirmation and the observation-framing attestation are required (the
// SQLite CHECKs enforce them too).

import { useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import type { RelationshipNature } from '../../domain/relationship.ts';

const NATURES: ReadonlyArray<{ value: RelationshipNature; label: string }> = [
  { value: 'partner', label: '伴侣' },
  { value: 'parent', label: '父母' },
  { value: 'child', label: '子女' },
  { value: 'sibling', label: '手足' },
  { value: 'friend', label: '朋友' },
  { value: 'coworker', label: '同事' },
  { value: 'mentor', label: '导师' },
  { value: 'other', label: '其他' },
];

export function AddPersonForm() {
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
      <h3 className="text-sm font-medium">添加一个人</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名字或代称"
          className="rounded border border-black/15 px-2 py-1 text-sm"
        />
        <select
          value={nature}
          onChange={(e) => setNature(e.target.value as RelationshipNature)}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        >
          {NATURES.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>我确认此人已满 18 周岁。</span>
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={observation}
          onChange={(e) => setObservation(e.target.checked)}
        />
        <span>我确认这些是我基于成人之间互动的个人观察，而非此人的个人数据档案。</span>
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={onAdd}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        添加
      </button>
    </div>
  );
}
