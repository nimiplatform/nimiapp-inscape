import { createNimiClient } from '@nimiplatform/sdk';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { createNimiLocalAppStandardShellSurface } from '@nimiplatform/kit/shell/renderer/bridge';
import { useAppStore } from '../app-shell/app-store.ts';
import { describeError, logRendererEvent } from './renderer-log.ts';
import { hasInscapeNimiClient, setInscapeNimiClient } from './inscape-nimi-client.ts';

let bootstrapPromise: Promise<void> | null = null;

export type InscapeAuthUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};

export async function runInscapeBootstrap(options: { force?: boolean } = {}): Promise<void> {
  if (bootstrapPromise && !options.force) return bootstrapPromise;
  if (options.force) bootstrapPromise = null;
  bootstrapPromise = bootstrap().finally(() => {
    if (!useAppStore.getState().bootstrapReady) bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export async function ensureInscapeRuntimeClientReady(): Promise<void> {
  if (!useAppStore.getState().bootstrapReady) await runInscapeBootstrap();
  if (!hasInscapeNimiClient()) throw new Error('Inscape Runtime access is unavailable.');
}

function buildClient(): NimiLocalAppClient {
  return createNimiClient({
    localApp: { standardShell: createNimiLocalAppStandardShellSurface() },
  });
}

async function bootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `inscape-bootstrap-${Date.now().toString(36)}`;
  store.setBootstrapReady(false);
  store.setBootstrapError(null);
  try {
    const client = buildClient();
    setInscapeNimiClient(client);
    const status = await client.auth.status();
    store.setRuntimeStatus(status);
    if (status.state !== 'session-bound') {
      store.clearAuthSession();
      store.setBootstrapReady(true);
      return;
    }
    const user = await client.currentUser.get();
    store.setAuthSession({
      id: user.handle,
      displayName: user.displayName || user.handle,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    });
    await ensureLocalAIConfig(client);
    store.setBootstrapReady(true);
  } catch (error) {
    setInscapeNimiClient(null);
    logRendererEvent({
      level: 'error',
      area: 'bootstrap',
      message: 'action:bootstrap-failed',
      flowId,
      details: { error: describeError(error) },
    });
    store.setRuntimeStatus({
      mode: 'local-app',
      state: 'unavailable',
      sessionBound: false,
      reasonCode: 'runtime-service-unavailable',
      actionHint: 'retry_same_host',
      retryable: true,
    });
    store.setBootstrapError('runtime-unavailable');
  }
}

async function ensureLocalAIConfig(client: NimiLocalAppClient): Promise<void> {
  const current = await client.aiConfig.get();
  const localText = current.capabilities.find((entry) => entry.capabilityContract === 'text.generate');
  if (localText?.route.oneofKind === 'local') return;
  await client.aiConfig.overwrite([{
    capabilityContract: 'text.generate',
    requiredFeatures: [],
    route: { oneofKind: 'local', local: {} },
  }]);
}
