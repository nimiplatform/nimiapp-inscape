import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedTypeProfileFromType } from '../src/product/inference/seed-profile.ts';
import { parsePosteriorUpdateProposal } from '../src/product/inference/ai-proposal-parser.ts';
import { applyPosteriorUpdate } from '../src/product/inference/posterior-update.ts';

const NOW = '2026-06-05T00:00:00Z';

test('seedTypeProfileFromType builds the Beebe stack posterior for INTJ', () => {
  const p = seedTypeProfileFromType('INTJ', NOW);
  assert.equal(p.leading_type, 'INTJ');
  assert.equal(p.beebe_archetype_inference.hero, 'Ni');
  assert.equal(p.beebe_archetype_inference.anima, 'Se');
  assert.equal(p.function_stack_posterior.Ni.strength, 0.85); // hero strongest
  assert.ok(p.function_stack_posterior.Ni.strength > p.function_stack_posterior.Se.strength);
  assert.ok(p.dichotomy_distribution.E_I.value > 0); // INTJ → I is the positive pole
  assert.ok(p.dichotomy_distribution.T_F.value < 0); // INTJ → T is the negative pole
});

test('T1-11 parser accepts a well-formed proposal', () => {
  const raw = JSON.stringify({
    function_updates: [{ function: 'Fe', proposed_strength: 0.24, proposed_confidence: 0.5 }],
    axis_updates: [],
    reason: 'Reflection suggests Fe-strain accumulating.',
  });
  const r = parsePosteriorUpdateProposal(raw);
  assert.equal(r.ok, true);
  assert.equal(r.proposal.function_updates[0].function, 'Fe');
  assert.equal(r.proposal.function_updates[0].proposed_strength, 0.24);
});

test('T1-11 parser drops invalid JSON (unclosed bracket)', () => {
  const r = parsePosteriorUpdateProposal('{ "function_updates": [ ');
  assert.equal(r.ok, false);
  assert.equal(r.failure.kind, 'invalid_json');
});

test('T1-11 parser drops an unknown function name', () => {
  const raw = JSON.stringify({
    function_updates: [{ function: 'Fii', proposed_strength: 0.3, proposed_confidence: 0.5 }],
    reason: 'x',
  });
  const r = parsePosteriorUpdateProposal(raw);
  assert.equal(r.ok, false);
  assert.equal(r.failure.kind, 'schema_violation');
});

test('T1-11 parser drops out-of-range strength', () => {
  const raw = JSON.stringify({
    function_updates: [{ function: 'Ni', proposed_strength: 1.5, proposed_confidence: 0.5 }],
    reason: 'x',
  });
  assert.equal(parsePosteriorUpdateProposal(raw).ok, false);
});

test('T1-11 parser drops an empty proposal (no updates)', () => {
  const raw = JSON.stringify({ function_updates: [], axis_updates: [], reason: 'x' });
  assert.equal(parsePosteriorUpdateProposal(raw).ok, false);
});

test('applyPosteriorUpdate replaces only the targeted entries', () => {
  const seed = seedTypeProfileFromType('INTJ', NOW);
  const parsed = parsePosteriorUpdateProposal(
    JSON.stringify({
      function_updates: [{ function: 'Fe', proposed_strength: 0.24, proposed_confidence: 0.5 }],
      axis_updates: [{ axis: 'T_F', proposed_value: 0.1, proposed_confidence: 0.6 }],
      reason: 'accepted by user',
    }),
  );
  assert.equal(parsed.ok, true);
  const next = applyPosteriorUpdate(
    seed,
    parsed.proposal,
    '2026-07-01T00:00:00Z',
    'reflection:7842',
  );
  assert.equal(next.function_stack_posterior.Fe.strength, 0.24);
  assert.equal(next.function_stack_posterior.Ni.strength, 0.85); // untouched
  assert.equal(next.dichotomy_distribution.T_F.value, 0.1);
  assert.ok(next.dichotomy_distribution.T_F.sources.includes('reflection:7842'));
  assert.equal(next.updated_at, '2026-07-01T00:00:00Z');
});

test('proposal parser rejects duplicate targets and missing update arrays as a whole', () => {
  const item = { function: 'Fe', proposed_strength: 0.3, proposed_confidence: 0.4 };
  assert.equal(
    parsePosteriorUpdateProposal(
      JSON.stringify({
        function_updates: [item, item],
        axis_updates: [],
        reason: 'duplicate',
      }),
    ).ok,
    false,
  );
  assert.equal(
    parsePosteriorUpdateProposal(
      JSON.stringify({ function_updates: [item], reason: 'missing array' }),
    ).ok,
    false,
  );
});

test('model field misspellings and retired proposal keys are rejected, never aliased', () => {
  for (const key of ['dichotomie_updates', 'dichotomy_updates']) {
    const result = parsePosteriorUpdateProposal(
      JSON.stringify({
        function_updates: [{ function: 'Fi', proposed_strength: 0.88, proposed_confidence: 0.45 }],
        [key]: [],
        reason: 'Observed model regression.',
      }),
    );
    assert.equal(result.ok, false);
  }
});
