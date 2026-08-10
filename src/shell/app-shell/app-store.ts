import { create } from 'zustand';
import type { NimiAppAuthProjection } from '@nimiplatform/sdk/app';

// IS-PRIV: Nimi platform owns identity. The renderer-side app store
// keeps only the runtime-projected account identity. Raw Realm access tokens
// are never exposed to Inscape.
export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
};

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface AppState {
  auth: {
    status: AuthStatus;
    user: AuthUser | null;
  };
  bootstrapReady: boolean;
  bootstrapError: string | null;
  runtimeStatus: NimiAppAuthProjection | null;

  setAuthSession: (user: AuthUser) => void;
  clearAuthSession: () => void;
  setBootstrapReady: (ready: boolean) => void;
  setBootstrapError: (error: string | null) => void;
  setRuntimeStatus: (status: NimiAppAuthProjection) => void;
}

declare global {
  interface ImportMeta {
    readonly env?: { readonly DEV?: boolean };
  }
  interface Window {
    __INSCAPE_APP_STORE__?: typeof useAppStore;
  }
}

export const useAppStore = create<AppState>((set) => ({
  auth: {
    status: 'bootstrapping',
    user: null,
  },
  bootstrapReady: false,
  bootstrapError: null,
  runtimeStatus: null,

  setAuthSession(user) {
    set({ auth: { status: 'authenticated', user } });
  },
  clearAuthSession() {
    set({ auth: { status: 'unauthenticated', user: null } });
  },
  setBootstrapReady: (ready) => set({ bootstrapReady: ready }),
  setBootstrapError: (error) => set({ bootstrapError: error }),
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
}));
