import { createNimiClient, createRealmFetchTransport, type NimiClient } from '@nimiplatform/sdk';
import {
  AccountCallerMode,
  AccountSessionState,
  type AccountCaller,
  type AccountProjection,
} from '@nimiplatform/sdk/runtime/generated';
import type { Runtime } from '@nimiplatform/sdk/runtime';
import { getInscapeRuntimeDefaults } from '../bridge/index.js';
import { useAppStore } from '../app-shell/app-store.js';
import { describeError, logRendererEvent } from './renderer-log.js';
import { getInscapeNimiClient, hasInscapeNimiClient, setInscapeNimiClient } from './inscape-nimi-client.js';
import { ensureInscapeAIConfigFromFirstRunEvidence } from '../ai/inscape-ai-config-bootstrap.ts';
import {
  INSCAPE_APP_ID,
  INSCAPE_APP_INSTANCE_ID as CANONICAL_INSCAPE_APP_INSTANCE_ID,
  INSCAPE_DEVICE_ID as CANONICAL_INSCAPE_DEVICE_ID,
} from '../../contracts/app-identity.ts';

// IS-PRIV / IS-DATA: Nimi owns the account / session / runtime
// boundary; Inscape is admitted as an active local first-party Runtime
// account/session consumer. Caller identity is fixed; runtime owns
// refresh-token custody and short-lived access-token projection. No
// app-owned token surface is admitted.

export const INSCAPE_RUNTIME_APP_ID = INSCAPE_APP_ID;
export const INSCAPE_RUNTIME_APP_INSTANCE_ID = CANONICAL_INSCAPE_APP_INSTANCE_ID;
export const INSCAPE_RUNTIME_DEVICE_ID = CANONICAL_INSCAPE_DEVICE_ID;

export const inscapeRuntimeAccountCaller: AccountCaller = {
  appId: INSCAPE_RUNTIME_APP_ID,
  appInstanceId: INSCAPE_RUNTIME_APP_INSTANCE_ID,
  deviceId: INSCAPE_RUNTIME_DEVICE_ID,
  mode: AccountCallerMode.LOCAL_FIRST_PARTY_APP,
  scopes: [],
};

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
  if (response.state !== AccountSessionState.AUTHENTICATED) return null;
  return normalizeInscapeAccountProjection(response.accountProjection);
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

async function buildInscapeNimiClient(realmBaseUrl: string): Promise<NimiClient> {
  const client = createNimiClient({
    appId: INSCAPE_RUNTIME_APP_ID,
    runtime: {
      appId: INSCAPE_RUNTIME_APP_ID,
      metadata: {
        callerId: INSCAPE_RUNTIME_APP_ID,
        surfaceId: 'inscape.session',
      },
      transport: {
        type: 'tauri-ipc',
        commandNamespace: 'runtime_bridge',
        eventNamespace: 'runtime_bridge',
      },
    },
    realm: {
      transport: createRealmFetchTransport({
        baseUrl: realmBaseUrl,
        credentials: 'include',
      }),
    },
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
    // Step 1: Runtime defaults (realm base URL, transport).
    const runtimeDefaults = await getInscapeRuntimeDefaults();
    store.setRuntimeDefaults(runtimeDefaults);

    // Step 2: Construct the explicit vNext Nimi client.
    setInscapeNimiClient(null);
    const client = await buildInscapeNimiClient(runtimeDefaults.realm.realmBaseUrl);
    setInscapeNimiClient(client);
    const runtime = client.runtime;

    // Step 3: Resolve current account from runtime projection.
    const runtimeAccountUser = runtime
      ? await loadInscapeRuntimeAccountUser(runtime).catch((error) => {
          logRendererEvent({
            level: 'warn',
            area: 'inscape-bootstrap.account',
            message: 'action:runtime-account-projection-unavailable',
            flowId,
            details: { error: describeError(error) },
          });
          return null;
        })
      : null;
    if (runtimeAccountUser) {
      store.setAuthSession(runtimeAccountUser);
    } else {
      store.clearAuthSession();
    }

    // Step 4: Runtime SDK readiness. Product surfaces must not mount against a
    // runtime client that cannot answer Runtime app storage projections.
    if (runtime) {
      await runtime.ready();
    }

    // Bind text.generate from runtime first-run evidence. Fail-soft: a
    // not-initialized outcome (runtime not yet AI-ready) is logged, not fatal —
    // the AI surface stays unavailable until a binding exists.
    const aiConfigInit = await ensureInscapeAIConfigFromFirstRunEvidence({ client });
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
  await getInscapeNimiClient().runtime.account.logout({
    caller: inscapeRuntimeAccountCaller,
    reason: 'inscape_logout',
  });
}
