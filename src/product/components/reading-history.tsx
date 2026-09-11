import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewReading, ReadingMode, SavedReading } from '../../domain/reading.ts';
import { newUlid } from '../ids/index.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { localDate, useUnsavedWarning } from './interaction.tsx';

export function useReadingHistory(mode: ReadingMode, relationshipId: string | null = null) {
  const space = useInscapeStore((s) => s.space);
  const add = useInscapeStore((s) => s.addReading);
  const [selected, select] = useState<string | null>(null);
  const [pending, setPending] = useState<SavedReading | null>(null);
  const readings = (space?.readings ?? []).filter(
    (r) => r.mode === mode && r.relationship_id === relationshipId,
  );
  const record = pending ?? readings.find((r) => r.id === selected) ?? readings.at(-1) ?? null;
  useEffect(() => {
    if (!pending || !space) return;
    const sources = new Map([
      ...space.self_subject.reflection_entries.map((e) => [e.id, e.text] as const),
      ...space.relationships.flatMap((r) =>
        r.communication_logs.map((e) => [e.id, e.snippet] as const),
      ),
    ]);
    if (
      (pending.relationship_id &&
        !space.relationships.some((r) => r.id === pending.relationship_id)) ||
      pending.source_ids.some((id) => !sources.has(id)) ||
      (pending.source_ids.length &&
        ['today-read', 'friction-analysis', 'dyad-insight', 'self-mirror'].includes(pending.mode) &&
        pending.source_ids.map((id) => sources.get(id)).join('\n\n') !== pending.evidence)
    )
      setPending(null);
  }, [space, pending]);
  useUnsavedWarning(!!pending);
  async function persist(record: SavedReading) {
    const savedId = await add(record, record.created_at);
    if (savedId) {
      setPending(null);
      select(savedId);
    }
    return savedId;
  }
  async function save(reading: Omit<NewReading, 'mode' | 'relationship_id'>) {
    const now = new Date().toISOString();
    const record: SavedReading = {
      ...reading,
      id: newUlid(),
      mode,
      relationship_id: relationshipId,
      created_at: now,
      feedback: null,
    };
    setPending(record);
    return persist(record);
  }
  return {
    readings,
    record,
    pending: !!pending,
    select,
    discard: () => setPending(null),
    save,
    retry: () => (pending ? persist(pending) : Promise.resolve('')),
  };
}

export function ReadingHistory({
  readings,
  selectedId,
  onSelect,
}: {
  readings: readonly SavedReading[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  if (!readings.length) return null;
  return (
    <details className="reading-history">
      <summary>{t('Repair.readingHistory', { count: readings.length })}</summary>
      <div className="reading-history-list">
        {[...readings].reverse().map((r) => (
          <button key={r.id} aria-pressed={r.id === selectedId} onClick={() => onSelect(r.id)}>
            <span>
              {localDate(r.created_at, i18n.language)}
              {r.refusal ? ' · ' + t('Repair.refusedLabel') : ''}
            </span>
            <small>
              {(r.evidence || r.text).slice(0, 90)}
              {r.feedback
                ? ' · ' +
                  t(r.feedback === 'accepted' ? 'Experience.accepted' : 'Experience.rejected')
                : ''}
            </small>
          </button>
        ))}
      </div>
    </details>
  );
}
