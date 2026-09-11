// Wave-3.1 — IA shell. Wires the InscapeStore to SQLite persistence, the
// first-run 18+ gate, and the three-face navigation. The five value-prop
// surfaces and AI modes A–E land in wave-3.2..3.4.

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveRecovery } from '../../product/components/interaction.tsx';
import { useAppStore } from '../app-shell/app-store.js';
import { RuntimeAppStoragePersistenceAdapter } from '../persistence/runtime-app-storage-adapter.ts';
import { hasElectronInvoke } from '@nimiplatform/kit/shell/renderer/bridge';
import type { PersistenceClient } from '../../product/persistence/persistence-client.ts';
import {
  InscapeStoreProvider,
  useInscapeStore,
} from '../../product/state/inscape-store-provider.tsx';
import { InscapeShell } from '../../product/shell/inscape-shell.tsx';
import { FirstRunGate } from '../../product/first-run/first-run-gate.tsx';
import { usePersistedInscapeLocaleSync } from '../../product/settings/language-switch.tsx';

function pickPersistenceClient(): PersistenceClient {
  if (!hasElectronInvoke()) throw new Error('Inscape SQLite requires the Electron Host.');
  return new RuntimeAppStoragePersistenceAdapter();
}

export function ProductArea() {
  const user = useAppStore((s) => s.auth.user);
  if (!user?.id) return null;
  if (!hasElectronInvoke())
    return <CenteredNote text="Inscape local data is unavailable outside the Electron Host." />;
  return <ProductAreaWithPersistence />;
}

function ProductAreaWithPersistence() {
  const client = useMemo(() => pickPersistenceClient(), []);
  return (
    <InscapeStoreProvider client={client}>
      <InscapeBootGate />
      <SaveRecovery />
    </InscapeStoreProvider>
  );
}

function InscapeBootGate() {
  const { t } = useTranslation();
  const status = useInscapeStore((s) => s.status);
  const error = useInscapeStore((s) => s.error);
  const initialize = useInscapeStore((s) => s.initialize);
  usePersistedInscapeLocaleSync();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (status === 'loading') {
    return <CenteredNote text={t('Status.loading')} />;
  }
  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p role="alert">{t('Repair.loadFailure')}</p>
        <button className="button button-primary" onClick={() => void initialize()}>
          {t('Runtime.retry')}
        </button>
        <details className="technical-note">
          <summary>{t('Runtime.technicalDetails')}</summary>
          <p>{error}</p>
        </details>
      </div>
    );
  }
  if (status === 'first-run') {
    return <FirstRunGate />;
  }
  return <InscapeShell />;
}

function CenteredNote({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-sm opacity-70">{text}</div>
  );
}
