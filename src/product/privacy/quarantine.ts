import type { ActiveInscapeSpace, QuarantinedInscapeSpace } from '../../domain/inscape-space.ts';
import type { AgeReviewSource } from '../../domain/age-context.ts';
import { withReflections } from '../inference/derive-profile.ts';
import { findUnder18Candidate } from './age-disclosure.ts';

// @nimi-authority: rule.inscape.privacy.r003
export function quarantineSelf(space: ActiveInscapeSpace, now: string, id: string, disclosure = ''): QuarantinedInscapeSpace {
  return {
    ...space, self_subject: null, other_subjects: [], relationships: [], readings: [],
    quarantine: [...space.quarantine, {
      id, quarantined_at: now, reason: 'under_18_actual_knowledge',
      payload_json: JSON.stringify({
        subject: { ...space.self_subject, age_attestation: {
          attested_adult: false, attested_at: now, attestation_method: 're_declaration',
        } }, other_subjects: space.other_subjects, relationships: space.relationships,
        readings: space.readings, disclosure,
      }),
    }], updated_at: now,
  };
}

// @nimi-authority: rule.inscape.data-model.r007
export function quarantineOther(space: ActiveInscapeSpace, subjectId: string, now: string, id: string, disclosure = '', source?: AgeReviewSource): ActiveInscapeSpace {
  const subject = space.other_subjects.find((item) => item.id === subjectId)!;
  const relationships = space.relationships.filter((r) => r.other_subject_id === subjectId);
  const ids = new Set(relationships.map((r) => r.id));
  // A confirmed source may belong to the self journal or another adult's
  // relationship. Keep its identity and original contents in quarantine too.
  const reflections = space.self_subject.reflection_entries.filter((entry) =>
    source?.kind === 'reflection' && entry.id === source.id);
  const communicationLogs = space.relationships.filter((r) => !ids.has(r.id)).flatMap((r) =>
    r.communication_logs.filter((log) => source?.kind === 'communication' && log.id === source.id)
      .map((log) => ({ relationship_id: r.id, ...log })));
  const sourceIds = new Set([
    ...subject.reflection_entries.map((entry) => entry.id),
    ...reflections.map((entry) => entry.id),
    ...communicationLogs.map((log) => log.id),
    ...relationships.flatMap((r) => r.communication_logs.map((log) => log.id)),
  ]);
  const readings = space.readings.filter((r) =>
    (r.relationship_id && ids.has(r.relationship_id)) || r.source_ids.some((sourceId) => sourceIds.has(sourceId)));
  const active = reflections.length
    ? withReflections(space, space.self_subject.reflection_entries.filter((entry) => !sourceIds.has(entry.id)), now)
    : space;
  return {
    ...active, other_subjects: active.other_subjects.filter((s) => s.id !== subjectId),
    relationships: active.relationships.filter((r) => !ids.has(r.id)).map((r) => ({
      ...r, communication_logs: r.communication_logs.filter((log) => !sourceIds.has(log.id)),
    })),
    readings: space.readings.filter((r) => !readings.includes(r)),
    quarantine: [...space.quarantine, {
      id, quarantined_at: now, reason: 'under_18_actual_knowledge',
      payload_json: JSON.stringify({
        subject: { ...subject, age_attestation: { attested_adult: false, attested_at: now, attestation_method: 're_declaration' } },
        relationships, readings, disclosure, source,
        reflection_entries: reflections, communication_logs: communicationLogs,
      }),
    }], updated_at: now,
  };
}

export function ageReviewCandidate(space: ActiveInscapeSpace, text: string, otherId?: string): string | null {
  if (findUnder18Candidate(text) === 'self') return space.self_subject.id;
  for (const other of space.other_subjects) {
    if (findUnder18Candidate(text, other.display_name, other.id === otherId) === 'other') return other.id;
  }
  return null;
}
