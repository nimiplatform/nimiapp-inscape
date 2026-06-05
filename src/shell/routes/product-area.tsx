// Wave-1 placeholder product area. The real Today / Relationship / Self faces
// (and the InscapeStoreProvider + persistence wiring) land in wave-2 / wave-3.
// For now this confirms the authenticated shell renders.

import { useAppStore } from '../app-shell/app-store.js';

export function ProductArea() {
  const user = useAppStore((s) => s.auth.user);
  if (!user?.id) return null;

  return (
    <div className="inscape-app__placeholder">
      <h1>心相 · Inscape</h1>
      <p>Signed in as {user.displayName || user.id}.</p>
      <p>Wave-1 shell baseline. Today / Relationship / Self land in later waves.</p>
    </div>
  );
}
