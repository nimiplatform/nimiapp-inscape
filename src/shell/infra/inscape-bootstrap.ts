import { createNimiClient, type NimiClient } from '@nimiplatform/sdk';
import {
  Runtime,
  createNimiLocalFirstPartyRuntimeAccountCaller,
  createNimiRuntimeAppSessionMetadataProvider,
  createNimiRuntimeFullAppRegistration,
  type NimiRuntimeAccountCaller,
  type RuntimeOptions,
} from '@nimiplatform/sdk/runtime';
import {
  AccountSessionState,
  type AccountProjection,
} from '@nimiplatform/sdk/runtime/generated';
import {
  createNimiError,
  ReasonCode,
  type CoreMetadata,
} from '@nimiplatform/sdk/types';
import { getInscapeRuntimeDefaults } from '../bridge/index.js';
import { useAppStore } from '../app-shell/app-store.js';
import { describeError, logRendererEvent } from './renderer-log.js';
import { hasInscapeNimiClient, setInscapeNimiClient } from './inscape-nimi-client.js';
import { ensureInscapeAIConfigFromFirstRunEvidence } from '../ai/inscape-ai-config-bootstrap.ts';
import {
  INSCAPE_APP_ID,
  INSCAPE_APP_INSTANCE_ID as CANONICAL_INSCAPE_APP_INSTANCE_ID,
  INSCAPE_DEVICE_ID as CANONICAL_INSCAPE_DEVICE_ID,
} from '../../contracts/app-identity.ts';

// IS-PRIV / IS-DATA: Inscape is a local Runtime account/session consumer
// registered through the Runtime full-app registration flow. Runtime owns
// login custody and app sessions. Raw Realm account tokens and first-party
// account-control calls are not exposed to Inscape.

export const INSCAPE_RUNTIME_APP_ID = INSCAPE_APP_ID;
export const INSCAPE_RUNTIME_APP_INSTANCE_ID = CANONICAL_INSCAPE_APP_INSTANCE_ID;
export const INSCAPE_RUNTIME_DEVICE_ID = CANONICAL_INSCAPE_DEVICE_ID;

const INSCAPE_RUNTIME_APP_SESSION_INSTANCE_ID = `${INSCAPE_RUNTIME_APP_ID}.platform-runtime-session`;
const INSCAPE_RUNTIME_APP_SESSION_DEVICE_ID = 'platform-runtime-session';
const INSCAPE_RUNTIME_APP_SESSION_TTL_SECONDS = 3600;
const INSCAPE_RUNTIME_APP_SESSION_REFRESH_SKEW_MS = 30_000;
const INSCAPE_RUNTIME_PROTECTED_SCOPES = ['ai.spend.meter'] as const;

export const inscapeRuntimeAccountCaller: NimiRuntimeAccountCaller =
  createNimiLocalFirstPartyRuntimeAccountCaller({
    appId: INSCAPE_RUNTIME_APP_ID,
    appInstanceId: INSCAPE_RUNTIME_APP_INSTANCE_ID,
    deviceId: INSCAPE_RUNTIME_DEVICE_ID,
  });

let bootstrapPromise: Promise<void> | null = null;

export type InscapeAuthUser = {
  id: string;
  displayName: string;
};

export function normalizeInscapeAccountProjection(
  projection: AccountProjection | null | undefined,
): InscapeAuthUser | null {
  const accountId = String(projection?.accountId || '').trim();
  if (!accountId) return null;
  return {
    id: accountId,
    displayName: String(projection?.displayName || '').trim(),
  };
}

export async function loadInscapeRuntimeAccountUser(
  runtime: Runtime,
): Promise<InscapeAuthUser | null> {
  const response = await runtime.account.getAccountSessionStatus({
    caller: inscapeRuntimeAccountCaller,
  });
  if (response.snapshot?.state !== AccountSessionState.AUTHENTICATED) return null;
  return normalizeInscapeAccountProjection(response.snapshot?.accountProjection);
}

export async function runInscapeBootstrap(options: { force?: boolean } = {}): Promise<void> {
  if (bootstrapPromise && !options.force) return bootstrapPromise;
  if (options.force) bootstrapPromise = null;
  bootstrapPromise = doRunInscapeBootstrap().finally(() => {
    if (!useAppStore.getState().bootstrapReady) bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export async function ensureInscapeBootstrapReady(): Promise<void> {
  const store = useAppStore.getState();
  if (store.bootstrapReady) return;
  await runInscapeBootstrap();
  const next = useAppStore.getState();
  if (!next.bootstrapReady) {
    throw new Error(next.bootstrapError || 'Inscape bootstrap did not complete');
  }
}

export async function ensureInscapeRuntimeClientReady(): Promise<void> {
  await ensureInscapeBootstrapReady();
  if (hasInscapeNimiClient()) return;
  await runInscapeBootstrap({ force: true });
  if (!hasInscapeNimiClient()) {
    throw new Error('Inscape Nimi client is unavailable after bootstrap retry');
  }
}

function inscapeRuntimeOptions(authMetadata?: () => Promise<CoreMetadata>): RuntimeOptions {
  return {
    appId: INSCAPE_RUNTIME_APP_ID,
    metadata: {
      callerId: INSCAPE_RUNTIME_APP_ID,
      surfaceId: 'inscape.session',
    },
    ...(authMetadata ? { authMetadata } : {}),
    transport: {
      type: 'tauri-ipc',
      commandNamespace: 'runtime_bridge',
      eventNamespace: 'runtime_bridge',
    },
  };
}

async function registerInscapeRuntimeAccountCaller(accountRuntime: Runtime): Promise<void> {
  await createNimiRuntimeFullAppRegistration(
    () => ({ auth: accountRuntime.auth }),
    {
      appId: INSCAPE_RUNTIME_APP_ID,
      appInstanceId: inscapeRuntimeAccountCaller.appInstanceId,
      deviceId: inscapeRuntimeAccountCaller.deviceId,
      capabilities: [...INSCAPE_RUNTIME_PROTECTED_SCOPES],
      rejectionLabel: 'Inscape Runtime account caller registration rejected',
    },
  )();
}

function createInscapeRuntimeAuthMetadataProvider(accountRuntime: Runtime): () => Promise<CoreMetadata> {
  const requiredRuntimeSessionMetadata = createNimiRuntimeAppSessionMetadataProvider({
    appId: INSCAPE_RUNTIME_APP_ID,
    appInstanceId: INSCAPE_RUNTIME_APP_SESSION_INSTANCE_ID,
    deviceId: INSCAPE_RUNTIME_APP_SESSION_DEVICE_ID,
    ttlSeconds: INSCAPE_RUNTIME_APP_SESSION_TTL_SECONDS,
    refreshSkewMs: INSCAPE_RUNTIME_APP_SESSION_REFRESH_SKEW_MS,
    capabilities: [...INSCAPE_RUNTIME_PROTECTED_SCOPES],
    auth: accountRuntime.auth,
  });
  return async () => {
    const session = await accountRuntime.account.getAccountSessionStatus({
      caller: inscapeRuntimeAccountCaller,
    });
    if (session.snapshot?.state !== AccountSessionState.AUTHENTICATED || !session.snapshot?.accountProjection?.accountId) {
      return {};
    }
    return requiredRuntimeSessionMetadata();
  };
}

async function buildInscapeNimiClient(): Promise<NimiClient> {
  const accountRuntime = new Runtime(inscapeRuntimeOptions());
  await accountRuntime.ready();
  await registerInscapeRuntimeAccountCaller(accountRuntime);
  const runtime = new Runtime(inscapeRuntimeOptions(
    createInscapeRuntimeAuthMetadataProvider(accountRuntime),
  ));
  const client = createNimiClient({
    appId: INSCAPE_RUNTIME_APP_ID,
    runtime,
    realm: false,
    app: false,
    permissions: false,
  });
  await client.runtime.ready();
  return client;
}

async function doRunInscapeBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `inscape-bootstrap-${Date.now().toString(36)}`;

  try {
    // Step 1: Runtime defaults (transport and platform projection).
    const runtimeDefaults = await getInscapeRuntimeDefaults();
    store.setRuntimeDefaults(runtimeDefaults);

    // Step 2: Construct the Runtime client. The app registers itself through
    // the Runtime full-app registration flow during client construction.
    setInscapeNimiClient(null);
    const client = await buildInscapeNimiClient();
    setInscapeNimiClient(client);
    const runtime = client.runtime;

    // Step 3: Resolve current account from runtime projection.
    const runtimeAccountUser = await loadInscapeRuntimeAccountUser(runtime).catch((error) => {
      logRendererEvent({
        level: 'warn',
        area: 'inscape-bootstrap.account',
        message: 'action:runtime-account-projection-unavailable',
        flowId,
        details: { error: describeError(error) },
      });
      return null;
    });
    if (runtimeAccountUser) {
      store.setAuthSession(runtimeAccountUser);
    } else {
      store.clearAuthSession();
    }

    // Step 4: Runtime SDK readiness. Product surfaces must not mount against a
    // runtime client that cannot answer Runtime app storage projections.
    await runtime.ready();

    const aiConfigInit = await ensureInscapeAIConfigFromFirstRunEvidence();
    if (aiConfigInit.outcome === 'not-initialized') {
      logRendererEvent({
        level: 'warn',
        area: 'inscape-bootstrap.ai-config',
        message: 'action:first-run-ai-config-init-skipped',
        flowId,
        details: { reason: aiConfigInit.reason, detail: aiConfigInit.detail },
      });
    }

    store.setBootstrapReady(true);
    store.setBootstrapError(null);
  } catch (error) {
    setInscapeNimiClient(null);
    const message = error instanceof Error ? error.message : String(error);
    logRendererEvent({
      level: 'error',
      area: 'bootstrap',
      message: 'action:bootstrap-failed',
      flowId,
      details: { error: describeError(error) },
    });
    store.setBootstrapError(message);
    store.setBootstrapReady(false);
  }
}

export async function logoutInscapeRuntimeAccount(): Promise<void> {
  await ensureInscapeRuntimeClientReady();
  throw createNimiError({
    message: 'Inscape is a developer-registered local app and cannot own Runtime account logout. Sign out from the first-party Desktop account surface.',
    reasonCode: ReasonCode.PRINCIPAL_UNAUTHORIZED,
    actionHint: 'use_desktop_account_surface',
    source: 'runtime',
  });
}
