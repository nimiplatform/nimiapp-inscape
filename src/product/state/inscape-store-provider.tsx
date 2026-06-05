// Wave-3.1 — React binding for the InscapeStore. The store instance is created
// once per provider (per persistence client), not a global singleton.

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createInscapeStore,
  type InscapeStore,
  type InscapeStoreState,
} from './inscape-store.ts';
import type { PersistenceClient } from '../persistence/persistence-client.ts';

const InscapeStoreContext = createContext<InscapeStore | null>(null);

export function InscapeStoreProvider({
  client,
  children,
}: {
  client: PersistenceClient;
  children: ReactNode;
}) {
  const storeRef = useRef<InscapeStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createInscapeStore(client);
  }
  return (
    <InscapeStoreContext.Provider value={storeRef.current}>
      {children}
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
