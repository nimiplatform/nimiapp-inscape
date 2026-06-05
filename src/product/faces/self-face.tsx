// IS-IA — Self face. Type profile is distribution-first (IS-IA-02). Initial
// typing establishes the prior; the evolution timeline lands in wave-3.4.

import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { InitialTyping } from '../self/initial-typing.tsx';
import { TypeProfileView } from '../self/type-profile-view.tsx';
import { SelfMirror } from '../self/self-mirror.tsx';

export function SelfFace() {
  const space = useInscapeStore((s) => s.space);
  const profile = space?.self_subject.type_profile ?? null;
  const reflections = space?.self_subject.reflection_entries ?? [];

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">自我</h2>

      {profile ? <TypeProfileView profile={profile} /> : <InitialTyping />}

      {profile && <SelfMirror profile={profile} />}

      <div>
        <h3 className="mb-2 text-sm font-medium">反思归档</h3>
        {reflections.length === 0 ? (
          <p className="text-sm opacity-60">
            还没有反思条目。在「今日」写下反思后会出现在这里（wave-3.3）。
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {reflections.map((entry) => (
              <li key={entry.id} className="opacity-80">
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
