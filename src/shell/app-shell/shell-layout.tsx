import type { ReactNode } from 'react';
import { AmbientBackground } from '@nimiplatform/kit/ui';

// The integrated top bar (brand + tabs + account) lives inside the
// product surface (InscapeShell). ShellLayout is the auth-aware frame
// that hosts the ambient background and any non-product chrome.

export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AmbientBackground variant="mesh" className="inscape-app">
      <main className="inscape-app__body inscape-app__body--integrated">{children}</main>
    </AmbientBackground>
  );
}
