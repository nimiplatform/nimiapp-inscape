import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyInscapeSpace } from '../src/domain/inscape-space.ts';
import { validateInscapeSpace } from '../src/contracts/inscape-space-validator.ts';

const NOW = '2026-06-05T00:00:00Z';

function otherSubject(id, attested = true) {
  return {
    id,
    kind: 'other_person',
    display_name: 'Marcus',
    age_attestation: {
      attested_adult: attested,
      attested_at: NOW,
      attestation_method: 'other_person_checkbox',
    },
    type_profile: null,
    typing_episodes: [],
    observation_events: [],
    reflection_entries: [],
  };
}

function relationship(otherId) {
  return {
    id: 'rel1',
    other_subject_id: otherId,
    nature: 'coworker',
    type_dyad: { self_type: null, other_type: null },
    communication_logs: [],
    friction_patterns: [],
    observation_attested: true,
  };
}

test('empty attested space validates', () => {
  assert.equal(validateInscapeSpace(createEmptyInscapeSpace(NOW, true)).ok, true);
});

test('space with an other_person + relationship validates', () => {
  const s = createEmptyInscapeSpace(NOW, true);
  const space = { ...s, other_subjects: [otherSubject('m1')], relationships: [relationship('m1')] };
  assert.equal(validateInscapeSpace(space).ok, true);
});

test('rejects an adult-attested space whose self is not adult-attested', () => {
  const s = createEmptyInscapeSpace(NOW, true);
  const space = {
    ...s,
    self_subject: {
      ...s.self_subject,
      age_attestation: { ...s.self_subject.age_attestation, attested_adult: false },
    },
  };
  const r = validateInscapeSpace(space);
  assert.equal(r.ok, false);
  assert.equal(r.error.field, 'self_subject.age_attestation.attested_adult');
});

test('rejects an other_subject declared with kind "self"', () => {
  const s = createEmptyInscapeSpace(NOW, true);
  const r = validateInscapeSpace({ ...s, other_subjects: [{ ...otherSubject('x'), kind: 'self' }] });
  assert.equal(r.ok, false);
});

test('rejects a relationship missing observation_attested', () => {
  const s = createEmptyInscapeSpace(NOW, true);
  const badRel = { ...relationship('m1') };
  delete badRel.observation_attested;
  const r = validateInscapeSpace({
    ...s,
    other_subjects: [otherSubject('m1')],
    relationships: [badRel],
  });
  assert.equal(r.ok, false);
});
