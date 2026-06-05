import type { AuthPlatformAdapter } from '@nimiplatform/kit/auth';
import { getPlatformClient } from '@nimiplatform/sdk';
import { inscapeTauriOAuthBridge } from '../../bridge/index.js';
import {
  ensureInscapeRuntimeClientReady,
  loadInscapeRuntimeAccountUser,
  logoutInscapeRuntimeAccount,
  inscapeRuntimeAccountCaller,
  type InscapeAuthUser,
} from '../../infra/inscape-bootstrap.js';

const INSCAPE_EMBEDDED_AUTH_UNSUPPORTED =
  'Embedded auth flow is not supported in Inscape desktop-browser mode.';

const INSCAPE_TOKEN_PROXY_FORBIDDEN =
  'Inscape does not own access/refresh token custody (IS-PRIV). '
  + 'Runtime is the sole owner — login through the desktop browser broker.';

function unsupported<T>(): Promise<T> {
  return Promise.reject(new Error(INSCAPE_EMBEDDED_AUTH_UNSUPPORTED));
}

export async function loadCurrentUser(): Promise<InscapeAuthUser | null> {
  await ensureInscapeRuntimeClientReady();
  return loadInscapeRuntimeAccountUser(getPlatformClient().runtime);
}

export function createInscapeDesktopBrowserAuthAdapter(): AuthPlatformAdapter {
  return {
    checkEmail: unsupported,
    passwordLogin: unsupported,
    requestEmailOtp: unsupported,
    verifyEmailOtp: unsupported,
    verifyTwoFactor: unsupported,
    walletChallenge: unsupported,
    walletLogin: unsupported,
    oauthLogin: unsupported,
    updatePassword: unsupported,
    loadCurrentUser,
    applyToken: async () => {
      throw new Error(INSCAPE_TOKEN_PROXY_FORBIDDEN);
    },
    persistSession: async () => {
      throw new Error(INSCAPE_TOKEN_PROXY_FORBIDDEN);
    },
    clearPersistedSession: async () => {
      await logoutInscapeRuntimeAccount();
    },
    oauthBridge: inscapeTauriOAuthBridge,
    syncAfterLogin: async () => {},
  };
}

export function createInscapeRuntimeAccountBrowserBroker() {
  return {
    begin: async (input: { callbackUrl: string; baseUrl?: string; timeoutMs: number }) => {
      await ensureInscapeRuntimeClientReady();
      const response = await getPlatformClient().runtime.account.beginLogin({
        caller: inscapeRuntimeAccountCaller,
        redirectUri: input.callbackUrl,
        callbackOrigin: new URL(input.callbackUrl).origin,
        requestedScopes: [],
        ttlSeconds: Math.max(10, Math.ceil(input.timeoutMs / 1000)),
      });
      if (
        !response.accepted
        || !response.loginAttemptId
        || !response.oauthAuthorizationUrl
        || !response.state
        || !response.nonce
      ) {
        throw new Error(
          `Runtime account login could not start: ${String(response.accountReasonCode || response.reasonCode || 'unknown')}`,
        );
      }
      return {
        loginAttemptId: response.loginAttemptId,
        authorizationUrl: response.oauthAuthorizationUrl,
        state: response.state,
        nonce: response.nonce,
      };
    },
    complete: async (input: {
      loginAttemptId: string;
      code: string;
      state: string;
      nonce: string;
      callbackUrl: string;
    }) => {
      await ensureInscapeRuntimeClientReady();
      const response = await getPlatformClient().runtime.account.completeLogin({
        caller: inscapeRuntimeAccountCaller,
        loginAttemptId: input.loginAttemptId,
        code: input.code,
        // R-OAUTH-008 / IS-PRIV: refreshToken MUST be empty here.
        refreshToken: '',
        state: input.state,
        nonce: input.nonce,
        redirectUri: input.callbackUrl,
        callbackOrigin: new URL(input.callbackUrl).origin,
        uxTraceId: '',
        sealedCompletionTicket: '',
      });
      if (!response.accepted) {
        throw new Error(
          `Runtime account login could not complete: ${String(response.accountReasonCode || response.reasonCode || 'unknown')}`,
        );
      }
      const accountId = String(response.accountProjection?.accountId || '').trim();
      return {
        user: accountId
          ? {
              id: accountId,
              displayName: String(response.accountProjection?.displayName || '').trim(),
            }
          : null,
      };
    },
  };
}
