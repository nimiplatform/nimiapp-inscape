import {
  BEEBE_ARCHETYPES,
  COGNITIVE_FUNCTIONS,
  DICHOTOMIES,
  functionStackFor,
  isFourLetterType,
  type FourLetterType,
} from '../../domain/typology.ts';
import type { BeebeArchetypeInference, TypeProfile } from '../../domain/type-profile.ts';
import type { ReflectionEntry } from '../../domain/subject.ts';
import type { ReflectionCalibration } from '../../domain/exploration.ts';
import type { ActiveInscapeSpace } from '../../domain/inscape-space.ts';
import { isBoundedReflectionProposal, parsePosteriorUpdateProposal, type PosteriorUpdateProposal } from './ai-proposal-parser.ts';

// @nimi-authority: rule.inscape.inference.r005
export function deriveProfile(profile: TypeProfile): TypeProfile {
  const axes = ['E_I', 'S_N', 'T_F', 'J_P'] as const;
  const poles = [
    ['E', 'I'],
    ['S', 'N'],
    ['T', 'F'],
    ['J', 'P'],
  ] as const;
  const clear = axes.every(
    (axis) =>
      Math.abs(profile.dichotomy_distribution[axis].value) >= 0.2 - 1e-9 &&
      profile.dichotomy_distribution[axis].confidence >= 0.25,
  );
  const code = axes
    .map((axis, i) => poles[i][profile.dichotomy_distribution[axis].value < 0 ? 0 : 1])
    .join('');
  const leading: FourLetterType | null = clear && isFourLetterType(code) ? code : null;
  const stack = leading ? functionStackFor(leading) : null;
  return {
    ...profile,
    leading_type: leading,
    beebe_archetype_inference: stack
      ? (Object.fromEntries(
          BEEBE_ARCHETYPES.map((role, i) => [role, stack[i]]),
        ) as BeebeArchetypeInference)
      : null,
  };
}

export function calibrationContribution(
  proposal: PosteriorUpdateProposal,
  profile: TypeProfile,
  now: string,
): ReflectionCalibration {
  return {
    accepted_at: now,
    reason: proposal.reason,
    functions: proposal.function_updates.map((u) => ({
      function: u.function,
      strength: u.proposed_strength - profile.function_stack_posterior[u.function].strength,
      confidence: u.proposed_confidence - profile.function_stack_posterior[u.function].confidence,
    })),
    dichotomies: proposal.axis_updates.map((u) => ({
      dichotomy: u.axis,
      value: u.proposed_value - profile.dichotomy_distribution[u.axis].value,
      confidence: u.proposed_confidence - profile.dichotomy_distribution[u.axis].confidence,
    })),
  };
}

// Rebuild from independently removable evidence. Saturation keeps totals in the
// domain after deleting a contribution; it never repairs an invalid AI proposal.
export function rebuildProfile(
  baseline: TypeProfile | null,
  entries: readonly ReflectionEntry[],
  now: string,
): TypeProfile | null {
  if (!baseline) return null;
  const contributions = entries.flatMap((entry) =>
    entry.exploration?.calibration ? [{ id: entry.id, value: entry.exploration.calibration }] : [],
  );
  const bounded = (value: number, min = 0) => Math.max(min, Math.min(1, Number(value.toFixed(10))));
  const function_stack_posterior = { ...baseline.function_stack_posterior };
  for (const fn of COGNITIVE_FUNCTIONS) {
    const changes = contributions.flatMap((c) =>
      c.value.functions.filter((u) => u.function === fn),
    );
    function_stack_posterior[fn] = {
      strength: bounded(
        baseline.function_stack_posterior[fn].strength +
          changes.reduce((sum, c) => sum + c.strength, 0),
      ),
      confidence: bounded(
        baseline.function_stack_posterior[fn].confidence +
          changes.reduce((sum, c) => sum + c.confidence, 0),
      ),
    };
  }
  const dichotomy_distribution = { ...baseline.dichotomy_distribution };
  for (const axis of DICHOTOMIES) {
    const changes = contributions.flatMap((c) =>
      c.value.dichotomies.filter((u) => u.dichotomy === axis).map((u) => ({ ...u, id: c.id })),
    );
    const original = baseline.dichotomy_distribution[axis];
    dichotomy_distribution[axis] = {
      value: bounded(original.value + changes.reduce((sum, c) => sum + c.value, 0), -1),
      confidence: bounded(original.confidence + changes.reduce((sum, c) => sum + c.confidence, 0)),
      sources: [...original.sources, ...changes.map((c) => 'reflection:' + c.id)],
    };
  }
  return deriveProfile({
    ...baseline,
    function_stack_posterior,
    dichotomy_distribution,
    updated_at: now,
  });
}

// @nimi-authority: rule.inscape.inference.r005
export function withReflections(
  space: ActiveInscapeSpace,
  entries: readonly ReflectionEntry[],
  now: string,
): ActiveInscapeSpace {
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

// @nimi-authority: rule.inscape.inference.r004
export function projectReflectionCalibration(
  profile: TypeProfile,
  baseline: TypeProfile,
  entries: readonly ReflectionEntry[],
  entryId: string,
  proposal: PosteriorUpdateProposal,
  now: string,
): { profile: TypeProfile; calibration: ReflectionCalibration } | null {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry?.exploration?.read || entry.exploration.feedback !== 'accepted' ||
      entry.exploration.calibration || !parsePosteriorUpdateProposal(JSON.stringify(proposal)).ok ||
      !isBoundedReflectionProposal(proposal, profile)) return null;
  const calibration = calibrationContribution(proposal, profile, now);
  const projected = rebuildProfile(baseline, entries.map((item) => item.id === entryId
    ? { ...item, exploration: { ...entry.exploration!, calibration } } : item), now)!;
  const equal = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
  // A saturated history may make the requested absolute value unreachable with
  // one bounded contribution. Reject the entire proposal, never a partial update.
  if (!proposal.function_updates.every((u) => {
    const actual = projected.function_stack_posterior[u.function];
    return equal(actual.strength, u.proposed_strength) && equal(actual.confidence, u.proposed_confidence);
  }) || !proposal.axis_updates.every((u) => {
    const actual = projected.dichotomy_distribution[u.axis];
    return equal(actual.value, u.proposed_value) && equal(actual.confidence, u.proposed_confidence);
  })) return null;
  return { profile: projected, calibration };
}
