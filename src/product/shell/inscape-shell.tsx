// Wave-3.1 — the integrated product shell: brand + three-face tab bar + the
// active face. No agent capsule, no notification bell, no background AI
// (IS-PROD-07).

import { useState } from 'react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { FACES, type FaceId } from '../navigation/tab-descriptor.ts';
import { TodayFace } from '../faces/today-face.tsx';
import { RelationshipFace } from '../faces/relationship-face.tsx';
import { SelfFace } from '../faces/self-face.tsx';

export function InscapeShell() {
  // Onboarding aha: a user with no type prior lands on Self to set it and meet
  // the mirror first, rather than an empty Today.
  const hasType = useInscapeStore((s) => Boolean(s.space?.self_subject.type_profile));
  const [active, setActive] = useState<FaceId>(hasType ? 'today' : 'self');
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 border-b border-black/10 px-6 py-3">
        <span className="font-semibold">心相 · Inscape</span>
        <nav className="flex gap-1" aria-label="faces">
          {FACES.map((face) => (
            <button
              key={face.id}
              type="button"
              onClick={() => setActive(face.id)}
              aria-current={active === face.id ? 'page' : undefined}
              className={
                active === face.id
                  ? 'rounded px-3 py-1 bg-black/10 font-medium'
                  : 'rounded px-3 py-1 opacity-70 hover:opacity-100'
              }
            >
              {face.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {active === 'today' && <TodayFace />}
        {active === 'relationship' && <RelationshipFace />}
        {active === 'self' && <SelfFace />}
      </main>
    </div>
  );
}
