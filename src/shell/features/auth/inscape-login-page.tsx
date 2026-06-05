import { useMemo } from 'react';
import { DesktopShellAuthPage } from '@nimiplatform/kit/auth';
import '@nimiplatform/kit/auth/styles.css';
import { useAppStore } from '../../app-shell/app-store.js';
import {
  createInscapeDesktopBrowserAuthAdapter,
  createInscapeRuntimeAccountBrowserBroker,
} from './inscape-auth-adapter.js';
import { inscapeTauriOAuthBridge } from '../../bridge/index.js';

export function InscapeLoginPage() {
  const adapter = useMemo(() => createInscapeDesktopBrowserAuthAdapter(), []);
  const runtimeAccountBroker = useMemo(() => createInscapeRuntimeAccountBrowserBroker(), []);
  const webBaseUrl = useAppStore((s) => s.runtimeDefaults?.webBaseUrl || '');

  return (
    <DesktopShellAuthPage
      adapter={adapter}
      session={{
        mode: 'desktop-browser',
        authStatus: 'unauthenticated',
        setAuthSession: (user) => {
          const store = useAppStore.getState();
          if (!user || !user.id) {
            store.clearAuthSession();
            return;
          }
          store.setAuthSession({
            id: String(user.id),
            displayName: String(user.displayName || user.name || ''),
            email: user.email ? String(user.email) : undefined,
            avatarUrl: user.avatarUrl ? String(user.avatarUrl) : undefined,
          });
        },
      }}
      desktopBrowserAuth={{
        baseUrl: webBaseUrl || undefined,
        bridge: inscapeTauriOAuthBridge,
        runtimeAccountBroker,
      }}
      testIds={{
        screen: 'inscape-login-page',
        logoTrigger: 'inscape-login-trigger',
      }}
    />
  );
}
