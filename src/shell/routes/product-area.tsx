// Desktop SQLite / Web Runtime-storage boot, adult eligibility and the three product faces.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NimiAccountControl, type NimiAppScope } from '@nimiplatform/kit/auth/app';
import { hasElectronInvoke } from '@nimiplatform/kit/shell/renderer/bridge';
import { SaveRecovery } from '../../product/components/interaction.tsx';
import { SqlitePersistenceAdapter } from '../persistence/sqlite-persistence-adapter.ts';
import { RuntimeStoragePersistenceAdapter } from '../persistence/runtime-storage-persistence-adapter.ts';
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
import { InscapeSettingsProvider } from '../../product/settings/settings-context.tsx';
import { ensureLocalAIConfig, InscapeRuntimeSettingsSection } from '../ai/inscape-ai-config.tsx';
import { setInscapeNimiClient } from '../infra/inscape-nimi-client.ts';
import { describeError, logRendererEvent } from '../infra/renderer-log.ts';
import type { InscapePlatform } from '../mount-inscape.tsx';

function createPersistenceClient(scope: NimiAppScope, platform: InscapePlatform): PersistenceClient {
  if (platform.kind === 'web') {
    return new RuntimeStoragePersistenceAdapter(scope);
  }
  if (!hasElectronInvoke()) throw new Error('Inscape SQLite requires the Electron Host.');
  return new SqlitePersistenceAdapter();
}

export function ProductArea({
  scope,
  platform,
}: {
  readonly scope: NimiAppScope;
  readonly platform: InscapePlatform;
}) {
  if (platform.kind === 'desktop' && !hasElectronInvoke()) {
    return <UnavailableHost />;
  }
  return <ProductAreaWithPersistence scope={scope} platform={platform} />;
}

function UnavailableHost() {
  const { t } = useTranslation();
  return <CenteredNote text={t('Recovery.hostRequired')} />;
}

function ProductAreaWithPersistence({
  scope,
  platform,
}: {
  readonly scope: NimiAppScope;
  readonly platform: InscapePlatform;
}) {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  useEffect(() => {
    setInscapeNimiClient(scope.client);
    void ensureLocalAIConfig(scope).catch((error) => {
      if (scope.signal.aborted) return;
      logRendererEvent({
        level: 'warn',
        area: 'ai-config',
        message: 'action:ensure-local-ai-config-deferred',
        details: { error: describeError(error) },
      });
    });
    return () => {
      setInscapeNimiClient(null);
    };
  }, [scope]);

  const persistenceClient = useMemo(
    () => createPersistenceClient(scope, platform),
    [scope, platform],
  );
  const getAiClient = useCallback(() => {
    scope.signal.throwIfAborted();
    return scope.client;
  }, [scope]);

  const settingsControls = useMemo(
    () => ({
      open: settingsOpen,
      setOpen: setSettingsOpen,
      openSettings,
      isWeb: platform.kind === 'web',
      runtimeSettingsSlot: <InscapeRuntimeSettingsSection scope={scope} />,
      accountControlSlot:
        platform.kind === 'web' ? <NimiAccountControl language={language} /> : undefined,
    }),
    [settingsOpen, openSettings, platform.kind, scope, language],
  );

  return (
    <InscapeSettingsProvider value={settingsControls}>
      <InscapeStoreProvider
        client={persistenceClient}
        getAiClient={getAiClient}
        aiSignal={scope.signal}
      >
        <InscapeBootGate />
        <AgeReviewDialog />
        <SaveRecovery />
      </InscapeStoreProvider>
    </InscapeSettingsProvider>
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
