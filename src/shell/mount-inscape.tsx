import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { NimiThemeProvider, NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { NimiAppSessionProvider, type NimiAppSession } from '@nimiplatform/kit/auth/app';
import { App } from './App.js';
import { i18n } from './i18n/index.js';
import { installInscapeGlobalErrorLogging } from './infra/renderer-log.js';
import '../styles.css';

export type InscapePlatform = { readonly kind: 'desktop' } | { readonly kind: 'web' };

export function mountInscape(session: NimiAppSession, platform: InscapePlatform) {
  installInscapeGlobalErrorLogging();
  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <NimiThemeProvider accentPack="nimi-accent" defaultScheme="light">
          <TooltipProvider>
            <NimiAppSessionProvider session={session}>
              <App platform={platform} />
            </NimiAppSessionProvider>
            <NimiToaster />
          </TooltipProvider>
        </NimiThemeProvider>
      </I18nextProvider>
    </React.StrictMode>,
  );
  void session.start();
  return () => {
    session.dispose();
    root.unmount();
  };
}
