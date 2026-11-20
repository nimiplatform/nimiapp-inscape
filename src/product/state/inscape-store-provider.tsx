// Wave-3.1 — React binding for the InscapeStore. The store instance is created
// once per provider (per persistence client), not a global singleton.

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createInscapeStore,
  type InscapeStore,
  type InscapeStoreState,
} from './inscape-store.ts';
import type { PersistenceClient } from '../persistence/persistence-client.ts';
import { createInscapeStoreAiClient } from './inscape-ai-client.ts';
import type { InscapeRuntimeAiClientOptions } from '../../shell/ai/inscape-runtime-ai-client.ts';

const InscapeStoreContext = createContext<InscapeStore | null>(null);
const InscapeAiRuntimeContext = createContext<{
  readonly getClient?: InscapeRuntimeAiClientOptions['getClient'];
  readonly signal?: AbortSignal;
}>({});

export function InscapeStoreProvider({
  client,
  getAiClient,
  aiSignal,
  children,
}: {
  client: PersistenceClient;
  getAiClient?: InscapeRuntimeAiClientOptions['getClient'];
  aiSignal?: AbortSignal;
  children: ReactNode;
}) {
  const storeRef = useRef<InscapeStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createInscapeStore(client);
  }
  const aiRuntime = useMemo(
    () => ({ getClient: getAiClient, signal: aiSignal }),
    [getAiClient, aiSignal],
  );
  return (
    <InscapeStoreContext.Provider value={storeRef.current}>
      <InscapeAiRuntimeContext.Provider value={aiRuntime}>
        {children}
      </InscapeAiRuntimeContext.Provider>
    </InscapeStoreContext.Provider>
  );
}

export function useInscapeStore<T>(selector: (state: InscapeStoreState) => T): T {
  const store = useContext(InscapeStoreContext);
  if (!store) {
    throw new Error('useInscapeStore must be used within an InscapeStoreProvider');
  }
  return useStore(store, selector);
}

// @nimi-authority: rule.inscape.privacy.r003
export function useInscapeAiClient(relationshipId?: string) {
  const store = useContext(InscapeStoreContext);
  if (!store) throw new Error('Inscape AI requires its product store.');
  const { getClient, signal } = useContext(InscapeAiRuntimeContext);
  const createdAt = useStore(store, (state) => state.space?.created_at);
  const quarantine = useStore(store, (state) => state.pendingQuarantine?.quarantine ?? state.space?.quarantine);
  return useMemo(
    () => createInscapeStoreAiClient(store, relationshipId, getClient, signal),
    [store, createdAt, quarantine, relationshipId, getClient, signal],
  );
}
