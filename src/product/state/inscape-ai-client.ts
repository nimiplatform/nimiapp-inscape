import { createInscapeRuntimeAiClient, type InscapeRuntimeAiClientOptions } from '../../shell/ai/inscape-runtime-ai-client.ts';
import type { InscapeStore } from './inscape-store.ts';

// @nimi-authority: rule.inscape.privacy.r003
export function createInscapeStoreAiClient(
  store: InscapeStore,
  relationshipId?: string,
  getClient?: InscapeRuntimeAiClientOptions['getClient'],
) {
  const initial = store.getState();
  const createdAt = initial.space?.created_at;
  const quarantine = initial.pendingQuarantine?.quarantine ?? initial.space?.quarantine;
  return createInscapeRuntimeAiClient({
    getClient,
    beforeGenerate: async () => {
      const space = store.getState().space;
      if (!space) return false;
      for (const entry of space.self_subject.reflection_entries) {
        if (!(await store.getState().checkAgeDisclosure(entry.text, new Date().toISOString(), undefined,
          { kind: 'reflection', id: entry.id }))) return false;
      }
      const relationship = space.relationships.find((r) => r.id === relationshipId);
      for (const log of relationship?.communication_logs ?? []) {
        if (!(await store.getState().checkAgeDisclosure(log.snippet, new Date().toISOString(), relationship?.other_subject_id,
          { kind: 'communication', id: log.id }))) return false;
      }
      return true;
    },
    getAgeContext: (request) => {
      const state = store.getState();
      const sources = [
        ...(state.space?.self_subject.reflection_entries.filter((e) => e.age_context).map((e) => e.text) ?? []),
        ...(state.space?.relationships.find((r) => r.id === relationshipId)?.communication_logs.filter((log) => log.age_context).map((log) => log.snippet) ?? []),
        ...(state.correctedInput ? [state.correctedInput.text] : []),
      ];
      const corrected = sources.some((text) => request.user.includes(text) || request.user.includes(JSON.stringify(text).slice(1, -1)));
      return corrected ? 'The user has explicitly reviewed the age references in this material as historical, quoted or hypothetical, not the current age of the represented person. Preserve that context and do not treat those references as current-age facts.' : null;
    },
    canProcess: () => {
      const state = store.getState();
      // A completed quarantine must not revive requests started before it.
      return state.status === 'ready' && !state.processingBlocked && !!state.space &&
        state.space.created_at === createdAt && state.space.quarantine === quarantine &&
        (!relationshipId || state.space.relationships.some((r) => r.id === relationshipId));
    },
  });
}
