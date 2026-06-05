// Wave-1 placeholder product area. The real Today / Relationship / Self faces
// (and the InscapeStoreProvider + persistence wiring) land in wave-2 / wave-3.
// For now this confirms the authenticated shell renders and carries the wave-1
// live smoke: one fail-close text.generate round-trip.

import { useState } from 'react';
import { useAppStore } from '../app-shell/app-store.js';
import { createInscapeRuntimeAiClient } from '../ai/inscape-runtime-ai-client.ts';

type SmokeState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; text: string }
  | { status: 'fail'; detail: string };

export function ProductArea() {
  const user = useAppStore((s) => s.auth.user);
  const [smoke, setSmoke] = useState<SmokeState>({ status: 'idle' });
  if (!user?.id) return null;

  async function runAiSmoke() {
    setSmoke({ status: 'running' });
    const client = createInscapeRuntimeAiClient();
    const result = await client.generate({
      system: 'You are Inscape, a Jungian-typology reflection tool. Reply in one short sentence.',
      user: 'Say hello and name one cognitive function.',
    });
    setSmoke(
      result.ok
        ? { status: 'ok', text: result.text }
        : { status: 'fail', detail: `${result.failure.kind}: ${result.failure.detail}` },
    );
  }

  return (
    <div className="inscape-app__placeholder">
      <h1>心相 · Inscape</h1>
      <p>Signed in as {user.displayName || user.id}.</p>
      <p>Wave-1 shell baseline. Today / Relationship / Self land in later waves.</p>
      <button type="button" onClick={() => void runAiSmoke()} disabled={smoke.status === 'running'}>
        {smoke.status === 'running' ? 'Generating…' : 'Test AI (text.generate)'}
      </button>
      {smoke.status === 'ok' && <p>AI ✓ {smoke.text}</p>}
      {smoke.status === 'fail' && <p>AI ✗ {smoke.detail}</p>}
    </div>
  );
}
