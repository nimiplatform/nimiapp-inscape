import { createStore } from 'zustand/vanilla';
import { createEmptyInscapeSpace, type InscapeSpace } from '../../domain/inscape-space.ts';
import type { InscapeLocale } from '../../domain/locale.ts';
import { isFourLetterType, type FourLetterType } from '../../domain/typology.ts';
import type { SavedExploration } from '../../domain/exploration.ts';
import type { ObservationSource, ReflectionEntry, Subject } from '../../domain/subject.ts';
import type { RelationshipNature } from '../../domain/relationship.ts';
import { parseInferredType } from '../../domain/type-suggestion.ts';
import type { NewReading, ResonanceFeedback } from '../../domain/reading.ts';
import { seedTypeProfileFromType } from '../inference/seed-profile.ts';
import { calibrationContribution, rebuildProfile } from '../inference/derive-profile.ts';
import {
  isBoundedReflectionProposal,
  parsePosteriorUpdateProposal,
  type PosteriorUpdateProposal,
  type ReflectionProposalContext,
} from '../inference/ai-proposal-parser.ts';
import { newUlid } from '../ids/index.ts';
import type { PersistenceClient } from '../persistence/persistence-client.ts';

export type InscapeStoreStatus = 'loading' | 'first-run' | 'ready' | 'error';
export interface InscapeStoreState {
  readonly status: InscapeStoreStatus;
  readonly space: InscapeSpace | null;
  readonly error: string | null;
  readonly saveError: string | null;
  readonly retrying: boolean;
  initialize: () => Promise<void>;
  retrySave: () => Promise<boolean>;
  cancelSave: () => void;
  completeFirstRun: (now: string, locale?: InscapeLocale) => Promise<boolean>;
  setLocale: (locale: InscapeLocale, now: string) => Promise<boolean>;
  clearLocalData: () => Promise<boolean>;
  setInitialType: (type: FourLetterType | null, now: string) => Promise<boolean>;
  addReflectionEntry: (
    text: string,
    now: string,
    exploration?: SavedExploration,
  ) => Promise<string>;
  editReflectionEntry: (id: string, text: string, now: string) => Promise<boolean>;
  deleteReflectionEntry: (id: string, now: string) => Promise<boolean>;
  updateExploration: (
    id: string,
    exploration: SavedExploration,
    now: string,
    expectedText?: string,
  ) => Promise<boolean>;
  applyAcceptedPosteriorUpdate: (
    proposal: PosteriorUpdateProposal,
    now: string,
    sourceId: string,
    expectedText: string,
    context: ReflectionProposalContext,
  ) => Promise<boolean>;
  revokeCalibration: (entryId: string, now: string) => Promise<boolean>;
  addObservationEvent: (note: string, source: ObservationSource, now: string) => Promise<boolean>;
  addPerson: (name: string, nature: RelationshipNature, now: string) => Promise<string>;
  editPerson: (
    relationshipId: string,
    name: string,
    nature: RelationshipNature,
    now: string,
  ) => Promise<boolean>;
  deletePerson: (relationshipId: string, now: string) => Promise<boolean>;
  addCommunicationLog: (relationshipId: string, snippet: string, now: string) => Promise<boolean>;
  editCommunicationLog: (
    relationshipId: string,
    id: string,
    snippet: string,
    now: string,
  ) => Promise<boolean>;
  deleteCommunicationLog: (relationshipId: string, id: string, now: string) => Promise<boolean>;
  quarantineOtherSubject: (subjectId: string, now: string) => Promise<boolean>;
  deleteQuarantineRecord: (id: string, now: string) => Promise<boolean>;
  setOtherSubjectType: (
    subjectId: string,
    type: FourLetterType | null,
    now: string,
    readingId?: string,
  ) => Promise<boolean>;
  addReading: (reading: NewReading, now: string) => Promise<string>;
  setReadingFeedback: (id: string, feedback: ResonanceFeedback, now: string) => Promise<boolean>;
  deleteReading: (id: string, now: string) => Promise<boolean>;
}

function withoutCalibration(data: SavedExploration): SavedExploration {
  const next = { ...data };
  delete next.calibration;
  return next;
}
function withReflections(
  space: InscapeSpace,
  entries: readonly ReflectionEntry[],
  now: string,
): InscapeSpace {
  const rebuilt = rebuildProfile(space.self_subject.profile_baseline, entries, now);
  const previous = space.self_subject.type_profile;
  const same =
    JSON.stringify(rebuilt ? { ...rebuilt, updated_at: '' } : null) ===
    JSON.stringify(previous ? { ...previous, updated_at: '' } : null);
  const profile = same ? previous : rebuilt;
  return {
    ...space,
    self_subject: { ...space.self_subject, reflection_entries: entries, type_profile: profile },
    relationships: space.relationships.map((r) => ({
      ...r,
      type_dyad: { ...r.type_dyad, self_type: profile?.leading_type ?? null },
    })),
    updated_at: now,
  };
}

export function createInscapeStore(client: PersistenceClient) {
  return createStore<InscapeStoreState>((set, get) => {
    let mutationQueue: Promise<unknown> = Promise.resolve();
    const queued =
      <A extends unknown[], R>(action: (...args: A) => Promise<R>) =>
      (...args: A): Promise<R> => {
        const pending = mutationQueue.then(() => action(...args));
        mutationQueue = pending.catch(() => undefined);
        return pending;
      };
    let pendingSave: { snapshot: InscapeSpace; resolve: (saved: boolean) => void } | null = null;
    const id = (now: string) => newUlid({ now: new Date(now) });
    async function write(snapshot: InscapeSpace): Promise<boolean> {
      try {
        const result = await client.save(snapshot);
        if (!result.ok) {
          set({ saveError: 'persistence_' + result.error.kind });
          return false;
        }
        set({ space: snapshot, saveError: null });
        return true;
      } catch (error) {
        set({ saveError: error instanceof Error ? error.message : String(error) });
        return false;
      }
    }
    // @nimi-authority: rule.inscape.data-model.r006
    async function persist(snapshot: InscapeSpace): Promise<boolean> {
      if (await write(snapshot)) return true;
      // Keep the originating action alive. A successful retry completes that same
      // action (including its new id), so the composer cannot create a duplicate.
      return new Promise<boolean>((resolve) => {
        pendingSave = { snapshot, resolve };
      });
    }
    return {
      status: 'loading',
      space: null,
      error: null,
      saveError: null,
      retrying: false,
      async initialize() {
        if (pendingSave) return;
        set({ status: 'loading', error: null });
        try {
          const result = await client.load();
          if (!result.ok) {
            set({ status: 'error', error: 'persistence_' + result.error.kind });
            return;
          }
          set({ status: result.snapshot ? 'ready' : 'first-run', space: result.snapshot });
        } catch (error) {
          set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      },
      async retrySave() {
        const pending = pendingSave;
        if (!pending || get().retrying) return false;
        set({ retrying: true });
        const saved = await write(pending.snapshot);
        if (saved) {
          pendingSave = null;
          pending.resolve(true);
        }
        set({ retrying: false });
        return saved;
      },
      cancelSave() {
        if (get().retrying) return;
        const pending = pendingSave;
        pendingSave = null;
        set({ saveError: null });
        pending?.resolve(false);
      },
      completeFirstRun: queued(async (now: string, locale?: InscapeLocale) => {
        const saved = await persist(createEmptyInscapeSpace(now, true, locale));
        if (saved) set({ status: 'ready' });
        return saved;
      }),
      setLocale: queued(async (locale: InscapeLocale, now: string) => {
        const current = get().space;
        if (!current) return false;
        if (current.settings.locale === locale) return true;
        return persist({ ...current, settings: { ...current.settings, locale }, updated_at: now });
      }),
      clearLocalData: queued(async () => {
        const result = await client.clear();
        if (!result.ok) return false;
        set({ status: 'first-run', space: null, error: null, saveError: null });
        return true;
      }),
      // @nimi-authority: rule.inscape.inference.r005
      setInitialType: queued(async (type: FourLetterType | null, now: string) => {
        const current = get().space;
        if (!current || (type !== null && !isFourLetterType(type))) return false;
        const baseline = type ? seedTypeProfileFromType(type, now) : null;
        const entries = current.self_subject.reflection_entries.map((entry) =>
          entry.exploration
            ? { ...entry, exploration: withoutCalibration(entry.exploration) }
            : entry,
        );
        const next = withReflections(
          {
            ...current,
            self_subject: {
              ...current.self_subject,
              profile_baseline: baseline,
              typing_episodes: [
                ...current.self_subject.typing_episodes,
                {
                  id: id(now),
                  source: 'user_calibration',
                  created_at: now,
                  summary: type ?? 'No type reference',
                },
              ],
            },
          },
          entries,
          now,
        );
        return persist(next);
      }),
      // @nimi-authority: rule.inscape.data-model.r003
      addReflectionEntry: queued(
        async (text: string, now: string, exploration?: SavedExploration) => {
          const current = get().space;
          if (!current || !text.trim()) return '';
          const entry: ReflectionEntry = {
            id: id(now),
            text: text.trim(),
            created_at: now,
            ...(exploration ? { exploration: withoutCalibration(exploration) } : {}),
          };
          return (await persist({
            ...current,
            self_subject: {
              ...current.self_subject,
              reflection_entries: [...current.self_subject.reflection_entries, entry],
            },
            updated_at: now,
          }))
            ? entry.id
            : '';
        },
      ),
      editReflectionEntry: queued(async (entryId: string, text: string, now: string) => {
        const current = get().space;
        if (
          !current ||
          !text.trim() ||
          !current.self_subject.reflection_entries.some((entry) => entry.id === entryId)
        )
          return false;
        const entries = current.self_subject.reflection_entries.map((entry) =>
          entry.id !== entryId
            ? entry
            : {
                id: entry.id,
                created_at: entry.created_at,
                text: text.trim(),
                ...(entry.exploration
                  ? { exploration: { mode: entry.exploration.mode, mood: entry.exploration.mood } }
                  : {}),
              },
        );
        return persist({
          ...withReflections(current, entries, now),
          readings: current.readings.filter((r) => !r.source_ids.includes(entryId)),
        });
      }),
      deleteReflectionEntry: queued(async (entryId: string, now: string) => {
        const current = get().space;
        if (!current) return false;
        return persist({
          ...withReflections(
            current,
            current.self_subject.reflection_entries.filter((entry) => entry.id !== entryId),
            now,
          ),
          readings: current.readings.filter((r) => !r.source_ids.includes(entryId)),
        });
      }),
      updateExploration: queued(
        async (
          entryId: string,
          exploration: SavedExploration,
          now: string,
          expectedText?: string,
        ) => {
          const current = get().space;
          const previous = current?.self_subject.reflection_entries.find(
            (entry) => entry.id === entryId,
          );
          if (
            !current ||
            !previous ||
            (expectedText !== undefined && previous.text !== expectedText)
          )
            return false;
          const next = withoutCalibration(exploration);
          if (next.feedback === 'accepted' && previous.exploration?.calibration)
            next.calibration = previous.exploration.calibration;
          return persist(
            withReflections(
              current,
              current.self_subject.reflection_entries.map((entry) =>
                entry.id === entryId ? { ...entry, exploration: next } : entry,
              ),
              now,
            ),
          );
        },
      ),
      // @nimi-authority: rule.inscape.inference.r004
      applyAcceptedPosteriorUpdate: queued(
        async (
          proposal: PosteriorUpdateProposal,
          now: string,
          sourceId: string,
          expectedText: string,
          context: ReflectionProposalContext,
        ) => {
          const current = get().space;
          const profile = current?.self_subject.type_profile;
          const entryId = sourceId.startsWith('reflection:')
            ? sourceId.slice('reflection:'.length)
            : '';
          const entry = current?.self_subject.reflection_entries.find((e) => e.id === entryId);
          if (
            !current ||
            !profile ||
            profile !== context.profile ||
            current.self_subject.profile_baseline !== context.baseline ||
            !entry?.exploration?.read ||
            entry.exploration.feedback !== 'accepted' ||
            entry.exploration.calibration ||
            entry.text !== expectedText
          )
            return false;
          if (
            !parsePosteriorUpdateProposal(JSON.stringify(proposal)).ok ||
            !isBoundedReflectionProposal(proposal, profile)
          )
            return false;
          const calibration = calibrationContribution(proposal, profile, now);
          const entries = current.self_subject.reflection_entries.map((e) =>
            e.id === entryId ? { ...e, exploration: { ...entry.exploration!, calibration } } : e,
          );
          return persist(withReflections(current, entries, now));
        },
      ),
      revokeCalibration: queued(async (entryId: string, now: string) => {
        const current = get().space;
        if (!current) return false;
        return persist(
          withReflections(
            current,
            current.self_subject.reflection_entries.map((entry) =>
              entry.id === entryId && entry.exploration
                ? { ...entry, exploration: withoutCalibration(entry.exploration) }
                : entry,
            ),
            now,
          ),
        );
      }),
      addObservationEvent: queued(async (note: string, source: ObservationSource, now: string) => {
        const current = get().space;
        if (!current) return false;
        return persist({
          ...current,
          self_subject: {
            ...current.self_subject,
            observation_events: [
              ...current.self_subject.observation_events,
              { id: id(now), source, note, created_at: now },
            ],
          },
          updated_at: now,
        });
      }),
      addPerson: queued(async (name: string, nature: RelationshipNature, now: string) => {
        const current = get().space;
        if (!current || !name.trim()) return '';
        const subject: Subject = {
          id: id(now),
          kind: 'other_person',
          display_name: name.trim(),
          age_attestation: {
            attested_adult: true,
            attested_at: now,
            attestation_method: 'other_person_checkbox',
          },
          type_profile: null,
          profile_baseline: null,
          typing_episodes: [],
          observation_events: [],
          reflection_entries: [],
        };
        const relationshipId = id(now);
        return (await persist({
          ...current,
          other_subjects: [...current.other_subjects, subject],
          relationships: [
            ...current.relationships,
            {
              id: relationshipId,
              other_subject_id: subject.id,
              nature,
              type_dyad: {
                self_type: current.self_subject.type_profile?.leading_type ?? null,
                other_type: null,
              },
              communication_logs: [],
              friction_patterns: [],
              observation_attested: true,
            },
          ],
          updated_at: now,
        }))
          ? relationshipId
          : '';
      }),
      editPerson: queued(
        async (relationshipId: string, name: string, nature: RelationshipNature, now: string) => {
          const current = get().space;
          const relation = current?.relationships.find((r) => r.id === relationshipId);
          if (!current || !relation || !name.trim()) return false;
          return persist({
            ...current,
            other_subjects: current.other_subjects.map((s) =>
              s.id === relation.other_subject_id ? { ...s, display_name: name.trim() } : s,
            ),
            relationships: current.relationships.map((r) =>
              r.id === relationshipId ? { ...r, nature } : r,
            ),
            updated_at: now,
          });
        },
      ),
      deletePerson: queued(async (relationshipId: string, now: string) => {
        const current = get().space;
        const relation = current?.relationships.find((r) => r.id === relationshipId);
        if (!current || !relation) return false;
        const removed = new Set(
          current.relationships
            .filter((r) => r.other_subject_id === relation.other_subject_id)
            .map((r) => r.id),
        );
        return persist({
          ...current,
          other_subjects: current.other_subjects.filter((s) => s.id !== relation.other_subject_id),
          relationships: current.relationships.filter((r) => !removed.has(r.id)),
          readings: current.readings.filter(
            (r) => !r.relationship_id || !removed.has(r.relationship_id),
          ),
          updated_at: now,
        });
      }),
      addCommunicationLog: queued(async (relationshipId: string, snippet: string, now: string) => {
        const current = get().space;
        if (
          !current ||
          !snippet.trim() ||
          !current.relationships.some((r) => r.id === relationshipId)
        )
          return false;
        return persist({
          ...current,
          relationships: current.relationships.map((r) =>
            r.id === relationshipId
              ? {
                  ...r,
                  communication_logs: [
                    ...r.communication_logs,
                    { id: id(now), created_at: now, snippet: snippet.trim() },
                  ],
                }
              : r,
          ),
          updated_at: now,
        });
      }),
      editCommunicationLog: queued(
        async (relationshipId: string, logId: string, snippet: string, now: string) => {
          const current = get().space;
          if (!current || !snippet.trim()) return false;
          return persist({
            ...current,
            relationships: current.relationships.map((r) =>
              r.id === relationshipId
                ? {
                    ...r,
                    communication_logs: r.communication_logs.map((log) =>
                      log.id === logId ? { ...log, snippet: snippet.trim() } : log,
                    ),
                  }
                : r,
            ),
            readings: current.readings.filter((r) => !r.source_ids.includes(logId)),
            updated_at: now,
          });
        },
      ),
      deleteCommunicationLog: queued(async (relationshipId: string, logId: string, now: string) => {
        const current = get().space;
        if (!current) return false;
        return persist({
          ...current,
          relationships: current.relationships.map((r) =>
            r.id === relationshipId
              ? { ...r, communication_logs: r.communication_logs.filter((log) => log.id !== logId) }
              : r,
          ),
          readings: current.readings.filter((r) => !r.source_ids.includes(logId)),
          updated_at: now,
        });
      }),
      // @nimi-authority: rule.inscape.privacy.r003
      quarantineOtherSubject: queued(async (subjectId: string, now: string) => {
        const current = get().space;
        const subject = current?.other_subjects.find((s) => s.id === subjectId);
        if (!current || !subject) return false;
        const relationships = current.relationships.filter((r) => r.other_subject_id === subjectId);
        const ids = new Set(relationships.map((r) => r.id));
        const readings = current.readings.filter(
          (r) => r.relationship_id && ids.has(r.relationship_id),
        );
        return persist({
          ...current,
          other_subjects: current.other_subjects.filter((s) => s.id !== subjectId),
          relationships: current.relationships.filter((r) => !ids.has(r.id)),
          readings: current.readings.filter((r) => !readings.includes(r)),
          quarantine: [
            ...current.quarantine,
            {
              id: id(now),
              quarantined_at: now,
              reason: 'under_18_actual_knowledge',
              payload_json: JSON.stringify({ subject, relationships, readings }),
            },
          ],
          updated_at: now,
        });
      }),
      deleteQuarantineRecord: queued(async (recordId: string, now: string) => {
        const current = get().space;
        return current
          ? persist({
              ...current,
              quarantine: current.quarantine.filter((r) => r.id !== recordId),
              updated_at: now,
            })
          : false;
      }),
      setOtherSubjectType: queued(
        async (subjectId: string, type: FourLetterType | null, now: string, readingId?: string) => {
          const current = get().space;
          if (!current || (type !== null && !isFourLetterType(type))) return false;
          if (readingId) {
            const reading = current.readings.find(
              (r) => r.id === readingId && r.mode === 'type-suggestion',
            );
            const inferred = reading ? parseInferredType(reading.text) : null;
            if (
              !reading ||
              !inferred?.ok ||
              inferred.inferred.type !== type ||
              !current.relationships.some(
                (r) => r.id === reading.relationship_id && r.other_subject_id === subjectId,
              )
            )
              return false;
          }
          const profile = type ? seedTypeProfileFromType(type, now) : null;
          return persist({
            ...current,
            readings: current.readings.map((r) =>
              r.id === readingId ? { ...r, feedback: 'accepted' } : r,
            ),
            other_subjects: current.other_subjects.map((s) =>
              s.id === subjectId ? { ...s, type_profile: profile, profile_baseline: profile } : s,
            ),
            relationships: current.relationships.map((r) =>
              r.other_subject_id === subjectId
                ? {
                    ...r,
                    type_dyad: {
                      self_type: current.self_subject.type_profile?.leading_type ?? null,
                      other_type: type,
                    },
                  }
                : r,
            ),
            updated_at: now,
          });
        },
      ),
      // @nimi-authority: rule.inscape.data-model.r007
      addReading: queued(async (reading: NewReading, now: string) => {
        const current = get().space;
        if (
          !current ||
          (reading.relationship_id &&
            !current.relationships.some((r) => r.id === reading.relationship_id))
        )
          return '';
        if (reading.id && current.readings.some((r) => r.id === reading.id)) return reading.id;
        const sources = new Map([
          ...current.self_subject.reflection_entries.map((e) => [e.id, e.text] as const),
          ...current.relationships.flatMap((r) =>
            r.communication_logs.map((log) => [log.id, log.snippet] as const),
          ),
        ]);
        if (reading.source_ids.some((id) => !sources.has(id))) return '';
        if (
          reading.source_ids.length &&
          ['today-read', 'friction-analysis', 'dyad-insight', 'self-mirror'].includes(
            reading.mode,
          ) &&
          reading.source_ids.map((id) => sources.get(id)).join('\n\n') !== reading.evidence
        )
          return '';
        const record = { ...reading, id: reading.id ?? id(now), created_at: now, feedback: null };
        return (await persist({
          ...current,
          readings: [...current.readings, record],
          updated_at: now,
        }))
          ? record.id
          : '';
      }),
      setReadingFeedback: queued(
        async (readingId: string, feedback: ResonanceFeedback, now: string) => {
          const current = get().space;
          if (!current) return false;
          return persist({
            ...current,
            readings: current.readings.map((r) =>
              r.id === readingId && !r.refusal ? { ...r, feedback } : r,
            ),
            updated_at: now,
          });
        },
      ),
      deleteReading: queued(async (readingId: string, now: string) => {
        const current = get().space;
        return current
          ? persist({
              ...current,
              readings: current.readings.filter((r) => r.id !== readingId),
              updated_at: now,
            })
          : false;
      }),
    };
  });
}
export type InscapeStore = ReturnType<typeof createInscapeStore>;
