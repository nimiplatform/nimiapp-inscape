import { useEffect } from 'react';
import { AmbientBackground } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './app-store.js';
import { runInscapeBootstrap } from '../infra/inscape-bootstrap.js';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const authStatus = useAppStore((s) => s.auth.status);
  const bootstrapReady = useAppStore((s) => s.bootstrapReady);
  const bootstrapError = useAppStore((s) => s.bootstrapError);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);

  useEffect(() => {
    void runInscapeBootstrap();
  }, []);

  if (bootstrapError) {
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="max-w-md space-y-4 px-6 text-center">
          <h1 className="text-xl font-semibold">{t('Runtime.unavailableTitle')}</h1>
          <p className="text-sm opacity-70">{t('Runtime.unavailableBody')}</p>
          <button
            type="button"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
            onClick={() => void runInscapeBootstrap({ force: true })}
          >
            {t('Runtime.retry')}
          </button>
          <details className="text-left text-xs opacity-60">
            <summary>{t('Runtime.technicalDetails')}</summary>
            <p className="mt-2 break-words">{runtimeStatus?.reasonCode || bootstrapError}</p>
          </details>
        </div>
      </AmbientBackground>
    );
  }

  if (!bootstrapReady || authStatus === 'bootstrapping') {
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500">{t('Shell.loading')}</p>
        </div>
      </AmbientBackground>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="max-w-md space-y-3 px-6 text-center">
          <h1 className="text-xl font-semibold">{t('Runtime.accountRequiredTitle')}</h1>
          <p className="text-sm opacity-70">{t('Runtime.accountRequiredBody')}</p>
          {runtimeStatus?.retryable ? (
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
              onClick={() => void runInscapeBootstrap({ force: true })}
            >
              {t('Runtime.retry')}
            </button>
          ) : null}
        </div>
      </AmbientBackground>
    );
  }

  return <>{children}</>;
}
