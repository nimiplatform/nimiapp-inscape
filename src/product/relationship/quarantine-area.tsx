// IS-PRIV-03 — under-18 quarantine area. Quarantined subjects are removed from
// all analysis; their raw data is retained verbatim and never processed. The
// user may permanently delete it or leave it quarantined. No guardian-facing
// UI, no minor-mode surface.

import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function QuarantineArea() {
  const space = useInscapeStore((s) => s.space);
  const deleteQuarantineRecord = useInscapeStore((s) => s.deleteQuarantineRecord);
  const records = space?.quarantine ?? [];
  if (records.length === 0) return null;

  return (
    <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
      <h3 className="text-sm font-medium text-amber-800">隔离区</h3>
      <p className="text-xs opacity-70">
        以下主体被判定为未满 18 岁，已从所有分析中移除并永不处理。你可以永久删除，或保留隔离。
      </p>
      <ul className="space-y-1 text-xs">
        {records.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-2">
            <span className="opacity-70">隔离于 {record.quarantined_at}</span>
            <button
              type="button"
              onClick={() => void deleteQuarantineRecord(record.id, new Date().toISOString())}
              className="rounded border border-black/15 px-2 py-0.5"
            >
              永久删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
