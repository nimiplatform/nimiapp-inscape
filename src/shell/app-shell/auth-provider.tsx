import { useEffect } from 'react';
import { AmbientBackground } from '@nimiplatform/kit/ui';
import { getPlatformClient } from '@nimiplatform/sdk';
import { useAppStore } from './app-store.js';
import { runInscapeBootstrap } from '../infra/inscape-bootstrap.js';
import { InscapeLoginPage } from '../features/auth/inscape-login-page.js';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authStatus = useAppStore((s) => s.auth.status);
  const bootstrapReady = useAppStore((s) => s.bootstrapReady);
  const bootstrapError = useAppStore((s) => s.bootstrapError);

  useEffect(() => {
    void runInscapeBootstrap();
  }, []);

  useEffect(() => {
    if (authStatus !== 'unauthenticated') return;
    try {
      getPlatformClient().realm.clearAuth();
    } catch {
      // Platform client may not be ready yet
    }
  }, [authStatus]);

  if (bootstrapError) {
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">{bootstrapError}</p>
        </div>
      </AmbientBackground>
    );
  }

  if (!bootstrapReady || authStatus === 'bootstrapping') {
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </AmbientBackground>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <InscapeLoginPage />;
  }

  return <>{children}</>;
}
