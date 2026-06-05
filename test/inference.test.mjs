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
    rationale: 'Reflection suggests Fe-strain accumulating.',
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
    rationale: 'x',
  });
  const r = parsePosteriorUpdateProposal(raw);
  assert.equal(r.ok, false);
  assert.equal(r.failure.kind, 'schema_violation');
});

test('T1-11 parser drops out-of-range strength', () => {
  const raw = JSON.stringify({
    function_updates: [{ function: 'Ni', proposed_strength: 1.5, proposed_confidence: 0.5 }],
    rationale: 'x',
  });
  assert.equal(parsePosteriorUpdateProposal(raw).ok, false);
});

test('T1-11 parser drops an empty proposal (no updates)', () => {
  const raw = JSON.stringify({ function_updates: [], dichotomy_updates: [], rationale: 'x' });
  assert.equal(parsePosteriorUpdateProposal(raw).ok, false);
});

test('applyPosteriorUpdate replaces only the targeted entries', () => {
  const seed = seedTypeProfileFromType('INTJ', NOW);
  const parsed = parsePosteriorUpdateProposal(
    JSON.stringify({
      function_updates: [{ function: 'Fe', proposed_strength: 0.24, proposed_confidence: 0.5 }],
      dichotomy_updates: [{ dichotomy: 'T_F', proposed_value: 0.1, proposed_confidence: 0.6 }],
      rationale: 'accepted by user',
    }),
  );
  assert.equal(parsed.ok, true);
  const next = applyPosteriorUpdate(seed, parsed.proposal, '2026-07-01T00:00:00Z', 'reflection:7842');
  assert.equal(next.function_stack_posterior.Fe.strength, 0.24);
  assert.equal(next.function_stack_posterior.Ni.strength, 0.85); // untouched
  assert.equal(next.dichotomy_distribution.T_F.value, 0.1);
  assert.ok(next.dichotomy_distribution.T_F.sources.includes('reflection:7842'));
  assert.equal(next.updated_at, '2026-07-01T00:00:00Z');
});
