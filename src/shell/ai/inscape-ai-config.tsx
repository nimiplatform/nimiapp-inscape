import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import {
  ModelConfigAIConfigSurface,
  type ModelConfigFormattedError,
  type ModelConfigOverwrite,
} from '@nimiplatform/kit/features/model-config';
import { NimiAccountControl, useNimiAppSession, type NimiAppScope } from '@nimiplatform/kit/auth/app';
import { Button } from '@nimiplatform/kit/ui';

export const INSCAPE_APP_ID = 'nimi.inscape';
export const INSCAPE_TEXT_CAPABILITY = 'text.generate';

// @nimi-authority: rule.inscape.runtime-ai.r002
export async function ensureLocalAIConfig(scope: NimiAppScope): Promise<void> {
  if (scope.signal.aborted) return;
  const current = await scope.client.aiConfig.get();
  if (scope.signal.aborted) return;
  const existing = current.config?.capabilities.find(
    (entry) => entry.capabilityContract === INSCAPE_TEXT_CAPABILITY,
  );
  if (existing?.route.oneofKind === 'local') return;
  const result = await scope.client.aiConfig.overwrite({
    expectedRevision: current.revision,
    capabilities: [
      {
        capabilityContract: INSCAPE_TEXT_CAPABILITY,
        requiredFeatures: [],
        route: { oneofKind: 'local', local: {} },
      },
    ],
  });
  if (result.outcome === 'conflict') throw new Error(result.reasonCode);
}

// @nimi-authority: rule.inscape.runtime-ai.r002
export function InscapeRuntimeSettingsSection({ scope }: { readonly scope: NimiAppScope }) {
  const { t, i18n } = useTranslation();
  const { session, snapshot: sessionSnapshot } = useNimiAppSession();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (scope.signal.aborted) return;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await scope.client.aiConfig.get();
      if (scope.signal.aborted) return;
      setSnapshot(next);
    } catch (error) {
      if (scope.signal.aborted) return;
      setSnapshot(undefined);
      setLoadError(error instanceof Error ? error.message : String(error || 'AIConfig read failed.'));
    } finally {
      if (!scope.signal.aborted) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overwrite = useCallback<ModelConfigOverwrite>(
    async (input) => {
      scope.signal.throwIfAborted();
      const nonLocal = input.capabilities.find((entry) => entry.route.oneofKind !== 'local');
      if (nonLocal) {
        throw new Error(t('Settings.localModelOnlyError'));
      }
      const result = await scope.client.aiConfig.overwrite(input);
      scope.signal.throwIfAborted();
      setSnapshot({ config: result.config, revision: result.revision, effectiveSelections: [] });
      void refresh();
      return result;
    },
    [refresh, scope, t],
  );

  const context = useMemo(
    () => ({
      owner: 'app-ai-config' as const,
      consumer: 'third-party-app' as const,
      appId: INSCAPE_APP_ID,
    }),
    [],
  );

  const formatError = useCallback(
    (error: unknown): ModelConfigFormattedError => ({
      message: t('Settings.aiConfigError'),
      technicalDetail: error instanceof Error ? error.message : String(error || 'Unknown AIConfig error.'),
    }),
    [t],
  );

  const connected = sessionSnapshot.runtime.status === 'connected';

  return (
    <div className="inscape-runtime-settings">
      <div className="inscape-runtime-settings__section">
        <div className="inscape-runtime-settings__header">
          <strong>{t('Settings.connectionTitle')}</strong>
          <small>{t(connected ? 'Settings.connectionActive' : 'Settings.connectionDisconnected')}</small>
        </div>
        <div className="inscape-runtime-settings__controls">
          {!connected && (
            <Button
              tone="secondary"
              size="sm"
              loading={sessionSnapshot.runtime.status === 'connecting'}
              onClick={() => void session.connectRuntime()}
            >
              {t('Settings.reconnect')}
            </Button>
          )}
          <NimiAccountControl language={language} />
        </div>
      </div>
      <div className="inscape-runtime-settings__section">
        <div className="inscape-runtime-settings__header">
          <strong>{t('Settings.localModelTitle')}</strong>
          <small>{t('Settings.localModelNote')}</small>
        </div>
        <ModelConfigAIConfigSurface
          context={context}
          capabilityContracts={[INSCAPE_TEXT_CAPABILITY]}
          allowedRoutes={['local']}
          capabilities={snapshot ? snapshot.config?.capabilities ?? null : undefined}
          revision={snapshot?.revision}
          effectiveSelections={snapshot?.effectiveSelections}
          listOptions={(query) => scope.client.aiConfig.listOptions(query)}
          loading={loading}
          disabled={!connected}
          loadError={loadError}
          onRetry={() => void refresh()}
          onOverwrite={overwrite}
          formatError={formatError}
          language={language === 'zh' ? 'zh-CN' : 'en-US'}
          showTitle={false}
        />
      </div>
    </div>
  );
}
