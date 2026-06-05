// Wave-3.1 — IA shell. Wires the InscapeStore to SQLite persistence, the
// first-run 18+ gate, and the three-face navigation. The five value-prop
// surfaces and AI modes A–E land in wave-3.2..3.4.

import { useEffect, useMemo } from 'react';
import { useAppStore } from '../app-shell/app-store.js';
import { RuntimeAppStoragePersistenceAdapter } from '../persistence/runtime-app-storage-adapter.ts';
import { InMemoryPersistenceAdapter } from '../../product/persistence/in-memory-adapter.ts';
import type { PersistenceClient } from '../../product/persistence/persistence-client.ts';
import {
  InscapeStoreProvider,
  useInscapeStore,
} from '../../product/state/inscape-store-provider.tsx';
import { InscapeShell } from '../../product/shell/inscape-shell.tsx';
import { FirstRunGate } from '../../product/first-run/first-run-gate.tsx';

function pickPersistenceClient(): PersistenceClient {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return new RuntimeAppStoragePersistenceAdapter();
  }
  return new InMemoryPersistenceAdapter();
}

export function ProductArea() {
  const user = useAppStore((s) => s.auth.user);
  const client = useMemo(() => pickPersistenceClient(), []);
  if (!user?.id) return null;
  return (
    <InscapeStoreProvider client={client}>
      <InscapeBootGate />
    </InscapeStoreProvider>
  );
}

function InscapeBootGate() {
  const status = useInscapeStore((s) => s.status);
  const error = useInscapeStore((s) => s.error);
  const initialize = useInscapeStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (status === 'loading') {
    return <CenteredNote text="加载中…" />;
  }
  if (status === 'error') {
    return <CenteredNote text={`无法加载本地数据：${error ?? 'unknown'}`} />;
  }
  if (status === 'first-run') {
    return <FirstRunGate />;
  }
  return <InscapeShell />;
}

function CenteredNote({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-sm opacity-70">{text}</div>
  );
}
