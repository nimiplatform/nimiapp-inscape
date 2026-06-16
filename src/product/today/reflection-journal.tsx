// IS-IA / IS-AI / IS-INFER — reflection journal. Write a reflection -> save +
// persist -> Mode E resonance -> Mode A posterior proposal -> T1-11 parse ->
// accept/reject -> applyPosteriorUpdate. A parse failure is dropped silently
// (Scenario 12); the reflection itself is always saved.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import {
  parsePosteriorUpdateProposal,
  type PosteriorUpdateProposal,
} from '../inference/ai-proposal-parser.ts';
import { buildPosteriorProposalPrompt, buildResonancePrompt } from './reflection-prompts.ts';

type Pending = { proposal: PosteriorUpdateProposal; sourceId: string };

export function ReflectionJournal() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const addReflectionEntry = useInscapeStore((s) => s.addReflectionEntry);
  const applyAcceptedPosteriorUpdate = useInscapeStore((s) => s.applyAcceptedPosteriorUpdate);
  const profile = space?.self_subject.type_profile ?? null;
  const locale = space?.settings.locale;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [resonance, setResonance] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  async function onSave() {
    const trimmed = text.trim();
    if (!trimmed || working) return;
    const now = new Date().toISOString();
    setWorking(true);
    setResonance(null);
    setAiError(null);
    setPending(null);

    const entryId = await addReflectionEntry(trimmed, now);
    setText('');

    const resonanceResult = await client.generate(buildResonancePrompt(trimmed, profile, locale));
    if (resonanceResult.ok) {
      setResonance(resonanceResult.text);
    } else {
      setAiError(`${resonanceResult.failure.kind}: ${resonanceResult.failure.detail}`);
    }

    if (profile) {
      const proposalResult = await client.generate(buildPosteriorProposalPrompt(trimmed, profile, locale));
      if (proposalResult.ok) {
        const parsed = parsePosteriorUpdateProposal(proposalResult.text);
        // T1-11: a parse failure is dropped silently — no proposal is shown.
        if (parsed.ok) {
          setPending({ proposal: parsed.proposal, sourceId: `reflection:${entryId}` });
        }
      }
    }
    setWorking(false);
  }

  function onAccept() {
    if (!pending) return;
    void applyAcceptedPosteriorUpdate(pending.proposal, new Date().toISOString(), pending.sourceId);
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t('ReflectionJournal.title')}</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={t('ReflectionJournal.placeholder')}
        className="w-full rounded border border-black/15 p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={working || !text.trim()}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? t('ReflectionJournal.processing') : t('ReflectionJournal.save')}
      </button>

      {!profile && (
        <p className="text-xs opacity-60">{t('ReflectionJournal.needsProfile')}</p>
      )}

      {resonance && (
        <div className="rounded border border-black/10 bg-black/[0.02] p-3 text-sm">{resonance}</div>
      )}
      {aiError && (
        <p className="text-xs opacity-60">{t('ReflectionJournal.aiUnavailableSaved', { error: aiError })}</p>
      )}

      {pending && (
        <div className="space-y-2 rounded border border-black/15 p-3 text-sm">
          <p className="font-medium">{t('ReflectionJournal.posteriorTitle')}</p>
          <p className="opacity-70">{pending.proposal.rationale}</p>
          <ul className="text-xs opacity-70">
            {pending.proposal.function_updates.map((u) => (
              <li key={u.function}>
                {t('ReflectionJournal.functionUpdate', {
                  function: u.function,
                  strength: u.proposed_strength.toFixed(2),
                  confidence: u.proposed_confidence.toFixed(2),
                })}
              </li>
            ))}
            {pending.proposal.dichotomy_updates.map((u) => (
              <li key={u.dichotomy}>
                {t('ReflectionJournal.dichotomyUpdate', {
                  dichotomy: u.dichotomy,
                  value: u.proposed_value.toFixed(2),
                })}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAccept}
              className="rounded bg-black/80 px-3 py-1 text-xs text-white"
            >
              {t('ReflectionJournal.accept')}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded border border-black/15 px-3 py-1 text-xs"
            >
              {t('ReflectionJournal.reject')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
