import { useTranslation } from 'react-i18next';
import {
  NimiAccountControl,
  NimiAppAccessGate,
  useNimiAppSession,
  type NimiAppSessionSnapshot,
} from '@nimiplatform/kit/auth/app';
import { AmbientBackground } from '@nimiplatform/kit/ui';
import { ShellLayout } from './app-shell/shell-layout.js';
import { ProductArea } from './routes/product-area.js';
import type { InscapePlatform } from './mount-inscape.js';

export function App({ platform }: { readonly platform: InscapePlatform }) {
  const { session } = useNimiAppSession();
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';

  function desktopFallback(snapshot: NimiAppSessionSnapshot) {
    if (snapshot.identity.status === 'checking') {
      return (
        <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            <p className="text-gray-500">{t('Shell.loading')}</p>
          </div>
        </AmbientBackground>
      );
    }

    const accountRequired = snapshot.identity.status === 'signed-out';
    return (
      <AmbientBackground variant="mesh" className="flex h-screen w-screen items-center justify-center">
        <div className="max-w-md space-y-4 px-6 text-center">
          <h1 className="text-xl font-semibold">
            {t(accountRequired ? 'Runtime.accountRequiredTitle' : 'Runtime.unavailableTitle')}
          </h1>
          <p className="text-sm opacity-70">
            {t(accountRequired ? 'Runtime.accountRequiredBody' : 'Runtime.unavailableBody')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
              onClick={() => void session.recheck()}
            >
              {t('Runtime.retry')}
            </button>
            <NimiAccountControl language={language} />
          </div>
          {snapshot.issue && (
            <details className="text-left text-xs opacity-60">
              <summary>{t('Runtime.technicalDetails')}</summary>
              {snapshot.issue.message && <p className="mt-2 break-words">{snapshot.issue.message}</p>}
              {snapshot.issue.reasonCode && <code className="mt-1 block break-words">{snapshot.issue.reasonCode}</code>}
              {snapshot.issue.actionHint && <code className="mt-1 block break-words">{snapshot.issue.actionHint}</code>}
            </details>
          )}
        </div>
      </AmbientBackground>
    );
  }

  return (
    <NimiAppAccessGate
      language={language}
      title={t('Experience.appTitle')}
      fallback={platform.kind === 'desktop' ? desktopFallback : undefined}
    >
      {(scope) => (
        <ShellLayout>
          <ProductArea key={scope.viewKey} scope={scope} platform={platform} />
        </ShellLayout>
      )}
    </NimiAppAccessGate>
  );
}
