// SQLite boot, adult eligibility and the three product faces.

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveRecovery } from '../../product/components/interaction.tsx';
import { useAppStore } from '../app-shell/app-store.js';
import { SqlitePersistenceAdapter } from '../persistence/sqlite-persistence-adapter.ts';
import { hasElectronInvoke } from '@nimiplatform/kit/shell/renderer/bridge';
import type { PersistenceClient } from '../../product/persistence/persistence-client.ts';
import {
  InscapeStoreProvider,
  useInscapeStore,
} from '../../product/state/inscape-store-provider.tsx';
import { InscapeShell } from '../../product/shell/inscape-shell.tsx';
import { FirstRunGate } from '../../product/first-run/first-run-gate.tsx';
import { SpaceRecovery } from '../../product/settings/space-recovery.tsx';
import { AgeReviewDialog } from '../../product/privacy/age-review-dialog.tsx';
import { usePersistedInscapeLocaleSync } from '../../product/settings/language-switch.tsx';

function pickPersistenceClient(): PersistenceClient {
  if (!hasElectronInvoke()) throw new Error('Inscape SQLite requires the Electron Host.');
  return new SqlitePersistenceAdapter();
}

export function ProductArea() {
  const user = useAppStore((s) => s.auth.user);
  if (!user?.id) return null;
  if (!hasElectronInvoke())
    return <UnavailableHost />;
  return <ProductAreaWithPersistence />;
}

function UnavailableHost() {
  const { t } = useTranslation();
  return <CenteredNote text={t('Recovery.hostRequired')} />;
}

function ProductAreaWithPersistence() {
  const client = useMemo(() => pickPersistenceClient(), []);
  return (
    <InscapeStoreProvider client={client}>
      <InscapeBootGate />
      <AgeReviewDialog />
      <SaveRecovery />
    </InscapeStoreProvider>
  );
}

function InscapeBootGate() {
  const { t } = useTranslation();
  const status = useInscapeStore((s) => s.status);
  const processingBlocked = useInscapeStore((s) => s.processingBlocked);
  const initialize = useInscapeStore((s) => s.initialize);
  usePersistedInscapeLocaleSync();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (status === 'quarantined') return <SpaceRecovery quarantined />;
  if (status === 'loading') {
    return <CenteredNote text={t(processingBlocked ? 'AgeGate.processingStopped' : 'Status.loading')} />;
  }
  if (status === 'error') {
    return <SpaceRecovery />;
  }
  if (status === 'first-run') {
    return <FirstRunGate />;
  }
  // @nimi-authority: rule.inscape.data-model.r007
  // Keep unrelated drafts mounted while a confirmed quarantine is being saved.
  return <>
    <div className="inscape-product" hidden={processingBlocked} inert={processingBlocked}>
      <InscapeShell />
    </div>
    {processingBlocked && <CenteredNote text={t('AgeGate.processingStopped')} />}
  </>;
}

function CenteredNote({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-sm opacity-70">{text}</div>
  );
}
