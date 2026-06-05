// Wave-3.x — InscapeStore (vanilla zustand, no JSX so it is unit-testable).
// Loads the InscapeSpace through a PersistenceClient (SQLite in Tauri,
// in-memory otherwise) and drives the boot lifecycle plus self-subject
// mutations. Every mutation persists through the same fail-close client.

import { createStore } from 'zustand/vanilla';
import { createEmptyInscapeSpace, type InscapeSpace } from '../../domain/inscape-space.ts';
import type { FourLetterType } from '../../domain/typology.ts';
import type {
  ObservationEvent,
  ObservationSource,
  ReflectionEntry,
  Subject,
  TypingEpisode,
} from '../../domain/subject.ts';
import type {
  CommunicationLog,
  Relationship,
  RelationshipNature,
} from '../../domain/relationship.ts';
import { seedTypeProfileFromType } from '../inference/seed-profile.ts';
import { applyPosteriorUpdate } from '../inference/posterior-update.ts';
import type { PosteriorUpdateProposal } from '../inference/ai-proposal-parser.ts';
import {
  newCommunicationLogId,
  newObservationEventId,
  newReflectionEntryId,
  newRelationshipId,
  newSubjectId,
  newTypingEpisodeId,
} from '../ids/index.ts';
import type { PersistenceClient, PersistenceError } from '../persistence/persistence-client.ts';

export type InscapeStoreStatus = 'loading' | 'first-run' | 'ready' | 'error';

export interface InscapeStoreState {
  readonly status: InscapeStoreStatus;
  readonly space: InscapeSpace | null;
  readonly error: string | null;
  initialize: () => Promise<void>;
  completeFirstRun: (now: string) => Promise<void>;
  setInitialType: (type: FourLetterType, now: string) => Promise<void>;
  addReflectionEntry: (text: string, now: string) => Promise<string>;
  applyAcceptedPosteriorUpdate: (
    proposal: PosteriorUpdateProposal,
    now: string,
    sourceId: string,
  ) => Promise<void>;
  addObservationEvent: (note: string, source: ObservationSource, now: string) => Promise<void>;
  addPerson: (displayName: string, nature: RelationshipNature, now: string) => Promise<void>;
  addCommunicationLog: (relationshipId: string, snippet: string, now: string) => Promise<void>;
}

function describePersistenceError(error: PersistenceError): string {
  return `persistence_${error.kind}`;
}

export function createInscapeStore(client: PersistenceClient) {
  return createStore<InscapeStoreState>((set, get) => {
    // Persist `next`; on success commit to state, on failure surface a typed
    // error and leave state unchanged (fail-close, never silent).
    async function persist(next: InscapeSpace): Promise<boolean> {
      const saved = await client.save(next);
      if (!saved.ok) {
        set({ status: 'error', error: describePersistenceError(saved.error) });
        return false;
      }
      set({ space: next });
      return true;
    }

    return {
      status: 'loading',
      space: null,
      error: null,

      async initialize() {
        set({ status: 'loading', error: null });
        const result = await client.load();
        if (!result.ok) {
          set({ status: 'error', error: describePersistenceError(result.error) });
          return;
        }
        set(
          result.snapshot === null
            ? { status: 'first-run' }
            : { status: 'ready', space: result.snapshot },
        );
      },

      async completeFirstRun(now: string) {
        // 18+ attestation recorded; the space cannot persist without it (IS-PRIV).
        const space = createEmptyInscapeSpace(now, true);
        const saved = await client.save(space);
        if (!saved.ok) {
          set({ status: 'error', error: describePersistenceError(saved.error) });
          return;
        }
        set({ status: 'ready', space });
      },

      async setInitialType(type: FourLetterType, now: string) {
        const current = get().space;
        if (!current) return;
        const episode: TypingEpisode = {
          id: newTypingEpisodeId({ now: new Date(now) }),
          source: 'test_submission',
          created_at: now,
          summary: `Initial type recorded: ${type}`,
        };
        await persist({
          ...current,
          self_subject: {
            ...current.self_subject,
            // A prior, not a verdict (IS-INFER-01); reflections refine it.
            type_profile: seedTypeProfileFromType(type, now),
            typing_episodes: [...current.self_subject.typing_episodes, episode],
          },
          updated_at: now,
        });
      },

      async addReflectionEntry(text: string, now: string): Promise<string> {
        const current = get().space;
        if (!current) return '';
        const entry: ReflectionEntry = {
          id: newReflectionEntryId({ now: new Date(now) }),
          created_at: now,
          text,
        };
        await persist({
          ...current,
          self_subject: {
            ...current.self_subject,
            reflection_entries: [...current.self_subject.reflection_entries, entry],
          },
          updated_at: now,
        });
        return entry.id;
      },

      async applyAcceptedPosteriorUpdate(
        proposal: PosteriorUpdateProposal,
        now: string,
        sourceId: string,
      ) {
        const current = get().space;
        if (!current || !current.self_subject.type_profile) return;
        await persist({
          ...current,
          self_subject: {
            ...current.self_subject,
            type_profile: applyPosteriorUpdate(
              current.self_subject.type_profile,
              proposal,
              now,
              sourceId,
            ),
          },
          updated_at: now,
        });
      },

      async addObservationEvent(note: string, source: ObservationSource, now: string) {
        const current = get().space;
        if (!current) return;
        const event: ObservationEvent = {
          id: newObservationEventId({ now: new Date(now) }),
          source,
          created_at: now,
          note,
        };
        await persist({
          ...current,
          self_subject: {
            ...current.self_subject,
            observation_events: [...current.self_subject.observation_events, event],
          },
          updated_at: now,
        });
      },

      async addPerson(displayName: string, nature: RelationshipNature, now: string) {
        const current = get().space;
        if (!current) return;
        const subject: Subject = {
          id: newSubjectId({ now: new Date(now) }),
          kind: 'other_person',
          display_name: displayName,
          // Adult-attested by the add-person checkbox (SQLite CHECK enforces).
          age_attestation: {
            attested_adult: true,
            attested_at: now,
            attestation_method: 'other_person_checkbox',
          },
          type_profile: null,
          typing_episodes: [],
          observation_events: [],
          reflection_entries: [],
        };
        const relationship: Relationship = {
          id: newRelationshipId({ now: new Date(now) }),
          other_subject_id: subject.id,
          nature,
          type_dyad: { self_type: null, other_type: null },
          communication_logs: [],
          friction_patterns: [],
          // "My observations, adult-to-adult" attestation (IS-PRIV; CHECK enforces).
          observation_attested: true,
        };
        await persist({
          ...current,
          other_subjects: [...current.other_subjects, subject],
          relationships: [...current.relationships, relationship],
          updated_at: now,
        });
      },

      async addCommunicationLog(relationshipId: string, snippet: string, now: string) {
        const current = get().space;
        if (!current) return;
        const log: CommunicationLog = {
          id: newCommunicationLogId({ now: new Date(now) }),
          created_at: now,
          snippet,
        };
        const relationships = current.relationships.map((relationship) =>
          relationship.id === relationshipId
            ? { ...relationship, communication_logs: [...relationship.communication_logs, log] }
            : relationship,
        );
        await persist({ ...current, relationships, updated_at: now });
      },
    };
  });
}

export type InscapeStore = ReturnType<typeof createInscapeStore>;
