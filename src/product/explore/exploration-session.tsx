import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Eye,
  Lightbulb,
  LoaderCircle,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import {
  parseExplorationRead,
  type ExplorationMode,
  type ExplorationRead,
  type SavedExploration,
} from '../../domain/exploration.ts';
import type { FourLetterType } from '../../domain/typology.ts';
import { DEFAULT_INSCAPE_LOCALE } from '../../domain/locale.ts';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { ConfirmDialog, Tabs, ChoiceGroup, useLeaveGuard } from '../components/interaction.tsx';
import { TextEditorDialog } from '../components/record-editors.tsx';
import { applyPosteriorUpdate } from '../inference/posterior-update.ts';
import { AiError, LoadingRead, SavedNote } from '../components/primitives.tsx';
import { buildExplorationPrompt } from './exploration-prompts.ts';
import { buildPosteriorProposalPrompt } from '../today/reflection-prompts.ts';
import {
  parsePosteriorUpdateProposal,
  isBoundedReflectionProposal,
  type PosteriorUpdateProposal,
  type ReflectionProposalContext,
} from '../inference/ai-proposal-parser.ts';

export const MOODS = ['calm', 'bright', 'tangled', 'low', 'restless'] as const;

export function ExplorationSession({
  mode,
  initialText = '',
  initialMood = '',
  existingId,
  onBack,
}: {
  mode: ExplorationMode;
  initialText?: string;
  initialMood?: string;
  existingId?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const sessionElement = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const viewport = sessionElement.current?.closest<HTMLElement>('.workspace-scroll');
    if (viewport) viewport.scrollTop = 0;
    return () => {
      if (viewport) viewport.scrollTop = 0;
    };
  }, []);
  const space = useInscapeStore((s) => s.space);
  const addReflection = useInscapeStore((s) => s.addReflectionEntry);
  const updateExploration = useInscapeStore((s) => s.updateExploration);
  const editEntry = useInscapeStore((s) => s.editReflectionEntry);
  const deleteEntry = useInscapeStore((s) => s.deleteReflectionEntry);
  const revoke = useInscapeStore((s) => s.revokeCalibration);
  const voiceId = useId();
  const composerId = useId();
  const applyUpdate = useInscapeStore((s) => s.applyAcceptedPosteriorUpdate);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const [entryId, setEntryId] = useState(existingId);
  const entry = space?.self_subject.reflection_entries.find((item) => item.id === entryId);
  const [text, setText] = useState(entry?.text ?? initialText);
  useEffect(() => {
    if (entry) setText(entry.text);
  }, [entry?.text]);
  const [mood, setMood] = useState(entry?.exploration?.mood ?? initialMood);
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const [candidate, setCandidate] = useState<{
    proposal: PosteriorUpdateProposal;
    source: string;
    context: ReflectionProposalContext;
  } | null>(null);
  const [calibrationNote, setCalibrationNote] = useState('');
  const [pendingRead, setPendingRead] = useState<{
    read: ExplorationRead;
    source: string;
    referenceType: FourLetterType | null;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discardingRead, setDiscardingRead] = useState(false);
  useEffect(() => {
    if (pendingRead && entry && entry.text !== pendingRead.source) {
      setPendingRead(null);
      setError(t('Repair.sourceChanged'));
    }
  }, [entry, pendingRead, t]);
  useEffect(() => {
    if (space && entryId && !entry) {
      setPendingRead(null);
      setCandidate(null);
      onBack();
    }
  }, [space, entryId, entry, onBack]);
  const data = entry?.exploration;
  const read = pendingRead?.read ?? data?.read;
  const profile = space?.self_subject.type_profile ?? null;
  const baseline = space?.self_subject.profile_baseline ?? null;
  const locale = space?.settings.locale ?? DEFAULT_INSCAPE_LOCALE;
  const proposalCurrent =
    candidate !== null &&
    candidate.context.profile === profile &&
    candidate.context.baseline === baseline &&
    candidate.source === entry?.text &&
    data?.feedback === 'accepted' &&
    !data.calibration;
  const proposal = proposalCurrent ? candidate.proposal : null;
  const canSubmit =
    Boolean(text.trim()) && (Boolean(entryId) || text.trim() !== initialText.trim());

  async function saveDraft() {
    if (running.current) return false;
    running.current = true;
    setWorking(true);
    try {
      if (pendingRead && entryId) {
        const saved = await updateExploration(
          entryId,
          { mode, mood, read: pendingRead.read, reference_type: pendingRead.referenceType },
          new Date().toISOString(),
          pendingRead.source,
        );
        if (saved) setPendingRead(null);
        return saved;
      }
      if (entryId) return true;
      const id = await addReflection(text.trim(), new Date().toISOString(), { mode, mood });
      if (id) setEntryId(id);
      return !!id;
    } finally {
      running.current = false;
      setWorking(false);
      setLoadingAi(false);
    }
  }
  const leave = useLeaveGuard(
    (!entryId && !!text.trim() && text.trim() !== initialText.trim()) || !!pendingRead,
    saveDraft,
  );
  useEffect(() => {
    if (candidate && !proposalCurrent) {
      setCandidate(null);
      setCalibrationNote('Repair.calibrationChanged');
    }
  }, [candidate, proposalCurrent, t]);
  const projected =
    proposal && profile
      ? applyPosteriorUpdate(profile, proposal, new Date().toISOString(), 'preview')
      : null;

  // @nimi-authority: rule.inscape.runtime-ai.r003
  async function run(withAi: boolean) {
    if (running.current || !canSubmit) return;
    running.current = true;
    setWorking(true);
    setError(null);
    try {
      const id =
        entryId ?? (await addReflection(text.trim(), new Date().toISOString(), { mode, mood }));
      if (!id) return;
      setEntryId(id);
      if (!withAi) return;
      const source = entry?.text ?? text.trim();
      setLoadingAi(true);
      const result = await client.generate(
        buildExplorationPrompt({ mode, mood, text: source, profile, locale }),
      );
      setLoadingAi(false);
      if (!result.ok) {
        setError(result.failure.detail);
        return;
      }
      const parsed = parseExplorationRead(result.text, mode);
      if (!parsed) {
        setError(t('Experience.invalidRead'));
        return;
      }
      setPendingRead({ read: parsed, source, referenceType: profile?.leading_type ?? null });
      if (
        await updateExploration(
          id,
          { mode, mood, read: parsed, reference_type: profile?.leading_type ?? null },
          new Date().toISOString(),
          source,
        )
      )
        setPendingRead(null);
    } finally {
      setWorking(false);
      setLoadingAi(false);
      running.current = false;
    }
  }

  async function update(patch: Partial<SavedExploration>) {
    if (!entryId || !data || running.current) return;
    running.current = true;
    setWorking(true);
    try {
      const saved = await updateExploration(
        entryId,
        { ...data, ...patch },
        new Date().toISOString(),
      );
      if (saved && 'feedback' in patch) {
        setCandidate(null);
        setCalibrationNote('');
      }
    } finally {
      running.current = false;
      setWorking(false);
      setLoadingAi(false);
    }
  }

  async function proposeCalibration() {
    if (!profile || !baseline || !entry || data?.calibration || running.current) return;
    running.current = true;
    setWorking(true);
    setError(null);
    setCalibrationNote('');
    try {
      setLoadingAi(true);
      const result = await client.generate(
        buildPosteriorProposalPrompt(entry.text, profile, locale),
      );
      setLoadingAi(false);
      if (!result.ok) {
        setError(result.failure.detail);
        return;
      }
      const parsed = parsePosteriorUpdateProposal(result.text);
      if (parsed.ok && isBoundedReflectionProposal(parsed.proposal, profile)) {
        setCandidate({
          proposal: parsed.proposal,
          source: entry.text,
          context: { profile, baseline },
        });
      } else setCalibrationNote('Experience.noCalibration');
    } finally {
      running.current = false;
      setWorking(false);
      setLoadingAi(false);
    }
  }

  async function acceptCalibration() {
    if (!proposal || !candidate || !entryId || running.current) return;
    running.current = true;
    setWorking(true);
    try {
      const saved = await applyUpdate(
        proposal,
        new Date().toISOString(),
        `reflection:${entryId}`,
        candidate.source,
        candidate.context,
      );
      if (saved) {
        setCandidate(null);
        setCalibrationNote('Experience.calibrationSaved');
      }
    } finally {
      running.current = false;
      setWorking(false);
      setLoadingAi(false);
    }
  }

  return (
    <section className="exploration-session" ref={sessionElement}>
      <div className="session-top">
        <button className="back-link" onClick={() => leave.requestLeave(onBack)}>
          <ArrowLeft size={17} />
          {t('Experience.back')}
        </button>
        {entryId && <SavedNote />}
      </div>
      {entry && (
        <div className="record-tools">
          <button className="text-link" disabled={working} onClick={() => setEditing(true)}>
            {t('Repair.editNote')}
          </button>
          <button className="text-link" disabled={working} onClick={() => setDeleting(true)}>
            {t('Repair.deleteNote')}
          </button>
        </div>
      )}
      <div className="session-heading">
        <span className="eyebrow">{t(`Experience.modes.${mode}.eyebrow`)}</span>
        <h1>{t(`Experience.modes.${mode}.title`)}</h1>
        <p>{t(`Experience.modes.${mode}.description`)}</p>
      </div>
      {!read && (
        <div className="session-composer">
          <label className="field-label" htmlFor={composerId}>
            {t('Experience.oneMoment')}
          </label>
          <textarea
            id={composerId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!!entryId}
            disabled={working}
            maxLength={2000}
            rows={5}
            placeholder={t(`Experience.modes.${mode}.placeholder`)}
            autoFocus={!existingId}
          />
          {initialText && !canSubmit && (
            <p className="inline-note">{t('Experience.addYourMoment')}</p>
          )}
          {!entryId && (
            <>
              <div className="composer-meta">
                <span>{t('Experience.moodQuestion')}</span>
                <span>{text.length}/2000</span>
              </div>
              <ChoiceGroup
                className="mood-options"
                label={t('Experience.moodQuestion')}
                value={mood}
                onChange={setMood}
                items={[
                  { value: '', label: t('Repair.noMood'), className: 'mood-chip' },
                  ...MOODS.map((value) => ({
                    value,
                    className: 'mood-chip',
                    label: (
                      <>
                        <span className={'mood-dot ' + value} />
                        {t('Experience.moods.' + value)}
                      </>
                    ),
                  })),
                ]}
              />
            </>
          )}
          <div className="composer-footer">
            <span>
              <LeafNote />
              {t('Experience.onlyYou')}
            </span>
            <div>
              {!entryId && (
                <button
                  className="button button-quiet"
                  disabled={working || !canSubmit}
                  onClick={() => void run(false)}
                >
                  {t(working && !loadingAi ? 'Repair.saving' : 'Experience.saveOnly')}
                </button>
              )}
              <button
                className="button button-primary"
                disabled={working || !canSubmit}
                onClick={() => void run(true)}
              >
                {working ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                {t(entryId ? 'Experience.exploreSaved' : 'Experience.beginExplore')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
          {entryId && !working && !error && (
            <p className="inline-note">{t('Experience.savedWithoutAI')}</p>
          )}
        </div>
      )}
      {loadingAi && !read && <LoadingRead />}
      {error && <AiError detail={error} onRetry={!read ? () => void run(true) : undefined} />}
      {read && (
        <div className="exploration-result">
          {pendingRead && (
            <div className="inline-callout">
              <p>{t('Repair.readNotSaved')}</p>
              <button
                className="text-link"
                disabled={working}
                onClick={() => setDiscardingRead(true)}
              >
                {t('Repair.discardReading')}
              </button>
              <button
                className="button button-secondary"
                disabled={working}
                onClick={() => void saveDraft()}
              >
                {t('Repair.saveReading')}
              </button>
            </div>
          )}
          {data?.reference_type && (
            <p className="inline-note">
              {t('Repair.readReference', { type: data.reference_type })}
            </p>
          )}
          <div className="result-intro">
            <span className="eyebrow">
              <Sparkles size={13} />
              {t('Experience.aPerspective')}
            </span>
            <h2>{read.title}</h2>
            <p>{read.reflection}</p>
          </div>
          <div className="roundtable-heading">
            <h3>{t('Experience.voicesTitle')}</h3>
            <span>{t('Experience.voicesHint')}</span>
          </div>
          <Tabs
            id={voiceId}
            label={t('Experience.voicesTitle')}
            className={'voice-grid ' + (mode === 'roundtable' ? 'eight' : '')}
            value={String(selected)}
            onChange={(value) => setSelected(Number(value))}
            items={read.voices.map((item, index) => ({
              value: String(index),
              className:
                'voice-selector function-' +
                item.function +
                (selected === index ? ' selected' : ''),
              label: (
                <>
                  <span className="function-badge">{item.function}</span>
                  <span>{t('Functions.' + item.function + '.name')}</span>
                  <ChevronDown size={14} />
                </>
              ),
            }))}
          />
          {read.voices.map((voice, index) => (
            <div
              role="tabpanel"
              id={voiceId + '-panel-' + index}
              aria-labelledby={voiceId + '-tab-' + index}
              hidden={selected !== index}
              className={'voice-detail function-' + voice.function}
              key={voice.function}
            >
              <span className="voice-label">
                {t('Experience.voiceSays', { name: t('Functions.' + voice.function + '.name') })}
              </span>
              <p>“{voice.perspective}”</p>
              <div className="voice-question">
                <Lightbulb size={17} />
                <span>{voice.question}</span>
              </div>
            </div>
          ))}
          <div className="reframe">
            <span className="eyebrow">{t('Experience.anotherAngle')}</span>
            <p>{read.alternative}</p>
          </div>
          <div className="experiment">
            <div className="experiment-icon">
              <Sprout size={25} />
            </div>
            <div>
              <span className="eyebrow">{t('Experience.tinyExperiment')}</span>
              <p>{read.experiment}</p>
              <small>{t('Experience.experimentNote')}</small>
            </div>
            <button
              disabled={working || !!pendingRead}
              className={`experiment-check ${data?.experiment_done ? 'done' : ''}`}
              aria-label={t(
                data?.experiment_done ? 'Experience.undoExperiment' : 'Experience.finishExperiment',
              )}
              aria-pressed={!!data?.experiment_done}
              onClick={() => void update({ experiment_done: !data?.experiment_done })}
            >
              {data?.experiment_done ? <CheckCheck size={21} /> : <Check size={21} />}
            </button>
          </div>
          <div className="read-actions">
            <button
              disabled={working || !!pendingRead}
              aria-pressed={data?.feedback === 'accepted'}
              onClick={() =>
                void update({ feedback: data?.feedback === 'accepted' ? null : 'accepted' })
              }
            >
              <Check size={16} />
              {t(data?.feedback === 'accepted' ? 'Experience.accepted' : 'Experience.resonates')}
            </button>
            <button
              disabled={working || !!pendingRead}
              aria-pressed={data?.feedback === 'rejected'}
              onClick={() =>
                void update({ feedback: data?.feedback === 'rejected' ? null : 'rejected' })
              }
            >
              <X size={16} />
              {t(
                data?.feedback === 'rejected' ? 'Experience.rejected' : 'Experience.doesntResonate',
              )}
            </button>
            <button aria-expanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)}>
              <Eye size={16} />
              {t('Experience.evidence')}
            </button>
          </div>
          {showEvidence && (
            <div className="evidence-panel">
              <span className="eyebrow">{t('Experience.yourWords')}</span>
              <p>{entry?.text}</p>
              <small>{t('Experience.evidenceNote')}</small>
            </div>
          )}
          {data?.feedback && (
            <p className="inline-note">
              {t(data.calibration ? 'Repair.feedbackCalibrationHint' : 'Repair.feedbackUndoHint')}
            </p>
          )}
          {data?.feedback === 'accepted' &&
            profile &&
            !data.calibration &&
            !proposal &&
            (!calibrationNote || calibrationNote === 'Repair.calibrationChanged') && (
              <button
                className="text-link"
                disabled={working}
                onClick={() => void proposeCalibration()}
              >
                {working && <LoaderCircle className="spin" size={14} />}
                {t('Experience.calibrate')}
                <ArrowRight size={15} />
              </button>
            )}
          {data?.calibration && (
            <div className="calibration-card">
              <h3>{t('Repair.calibrationApplied')}</h3>
              <p>{data.calibration.reason}</p>
              <button
                className="text-link"
                disabled={working}
                onClick={async () => {
                  if (!entryId) return;
                  setWorking(true);
                  try {
                    if (await revoke(entryId, new Date().toISOString())) setCalibrationNote('');
                  } finally {
                    setWorking(false);
                    setLoadingAi(false);
                  }
                }}
              >
                {t('Repair.revokeCalibration')}
              </button>
            </div>
          )}
          {proposal && (
            <div className="calibration-card">
              <h3>{t('Experience.calibrationTitle')}</h3>
              <p>{proposal.reason}</p>
              {projected?.leading_type !== profile?.leading_type && (
                <p className="inline-note">
                  {t('Repair.projectedType', {
                    before: profile?.leading_type ?? t('Repair.noType'),
                    after: projected?.leading_type ?? t('Repair.noType'),
                  })}
                </p>
              )}
              <div className="calibration-values">
                {proposal.function_updates.map((item) => (
                  <span key={item.function}>
                    {item.function}:{' '}
                    {profile?.function_stack_posterior[item.function].strength.toFixed(2)} →{' '}
                    {item.proposed_strength.toFixed(2)} · {t('Experience.confidence')}{' '}
                    {profile?.function_stack_posterior[item.function].confidence.toFixed(2)} →{' '}
                    {item.proposed_confidence.toFixed(2)}
                  </span>
                ))}
                {proposal.axis_updates.map((item) => (
                  <span key={item.axis}>
                    {item.axis}: {profile?.dichotomy_distribution[item.axis].value.toFixed(2)} →{' '}
                    {item.proposed_value.toFixed(2)} · {t('Experience.confidence')}{' '}
                    {profile?.dichotomy_distribution[item.axis].confidence.toFixed(2)} →{' '}
                    {item.proposed_confidence.toFixed(2)}
                  </span>
                ))}
              </div>
              <p className="inline-note">{t('Experience.calibrationNote')}</p>
              <div className="button-row">
                <button
                  className="button button-primary"
                  disabled={working}
                  onClick={() => void acceptCalibration()}
                >
                  {t('Experience.acceptCalibration')}
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setCandidate(null);
                    setCalibrationNote('Experience.calibrationDeclined');
                  }}
                >
                  {t('Experience.keepAsIs')}
                </button>
              </div>
            </div>
          )}
          {calibrationNote && (
            <p role="status" className="inline-note">
              {t(calibrationNote)}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={discardingRead}
        title={t('Repair.discardReading')}
        description={t('Repair.deleteReadingBody')}
        confirmLabel={t('Repair.discardReading')}
        onCancel={() => setDiscardingRead(false)}
        onConfirm={() => {
          setPendingRead(null);
          return true;
        }}
      />
      {leave.dialog}
      <TextEditorDialog
        open={editing}
        title={t('Repair.editNote')}
        description={t('Repair.editNoteBody')}
        value={entry?.text ?? text}
        onClose={() => setEditing(false)}
        onSave={async (next) => {
          if (!entryId) return false;
          const saved = await editEntry(entryId, next, new Date().toISOString());
          if (saved) {
            setText(next);
            setPendingRead(null);
            setCandidate(null);
            setCalibrationNote('');
            setError(null);
          }
          return saved;
        }}
      />
      <ConfirmDialog
        open={deleting}
        title={t('Repair.deleteNote')}
        description={t('Repair.deleteNoteBody')}
        confirmLabel={t('Repair.deletePermanently')}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          if (!entryId) return false;
          const saved = await deleteEntry(entryId, new Date().toISOString());
          if (saved) onBack();
          return saved;
        }}
      />
    </section>
  );
}

function LeafNote() {
  return <Sprout size={13} />;
}
