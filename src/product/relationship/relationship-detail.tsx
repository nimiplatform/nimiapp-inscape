import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, Plus, ScanHeart, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildFrictionPrompt } from './relationship-prompts.ts';
import { CommunicationRewrite } from './communication-rewrite.tsx';
import { DyadInsight } from './dyad-insight.tsx';
import type { Relationship, RelationshipNature } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';
import { AiError, LoadingRead, ReadFeedback } from '../components/primitives.tsx';
import { ReadingHistory, useReadingHistory } from '../components/reading-history.tsx';
import {
  ConfirmDialog,
  Modal,
  Tabs,
  localDate,
  useLeaveGuard,
} from '../components/interaction.tsx';
import { TextEditorDialog } from '../components/record-editors.tsx';

const NATURES: readonly RelationshipNature[] = [
  'partner',
  'parent',
  'child',
  'sibling',
  'friend',
  'coworker',
  'mentor',
  'other',
];
export function RelationshipDetail({
  relationship,
  other,
  onDirtyChange,
}: {
  relationship: Relationship;
  other: Subject | undefined;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const addLog = useInscapeStore((s) => s.addCommunicationLog);
  const editLog = useInscapeStore((s) => s.editCommunicationLog);
  const deleteLog = useInscapeStore((s) => s.deleteCommunicationLog);
  const editPerson = useInscapeStore((s) => s.editPerson);
  const deletePerson = useInscapeStore((s) => s.deletePerson);
  const quarantine = useInscapeStore((s) => s.quarantineOtherSubject);
  const space = useInscapeStore((s) => s.space);
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);
  const history = useReadingHistory('friction-analysis', relationship.id);
  const [tab, setTab] = useState('understand');
  const [snippet, setSnippet] = useState('');
  const [working, setWorking] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'quarantine' | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(other?.display_name ?? '');
  const [nature, setNature] = useState(relationship.nature);
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState<string | null>(null);
  const [rewriteDirty, setRewriteDirty] = useState(false);
  const [dyadDirty, setDyadDirty] = useState(false);
  const leaveEdit = useLeaveGuard(
    editing && (name !== other?.display_name || nature !== relationship.nature),
  );
  const dirty = !!snippet.trim() || rewriteDirty || dyadDirty || history.pending;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const tabsId = 'relation-' + relationship.id;
  async function save() {
    if (!snippet.trim() || saving) return;
    setSaving(true);
    try {
      if (await addLog(relationship.id, snippet.trim(), new Date().toISOString())) setSnippet('');
    } finally {
      setSaving(false);
    }
  }
  async function analyze() {
    if (working || history.pending || !relationship.communication_logs.length) return;
    setWorking(true);
    setError(null);
    try {
      const logs = relationship.communication_logs.slice(-10);
      setLoadingAi(true);
      const result = await client.generate(
        buildFrictionPrompt({
          snippets: logs.map((e) => e.snippet),
          selfType: space?.self_subject.type_profile?.leading_type ?? null,
          otherType: other?.type_profile?.leading_type ?? null,
          nature: relationship.nature,
          locale: space?.settings.locale,
        }),
      );
      setLoadingAi(false);
      if (result.ok)
        await history.save({
          text: result.text,
          evidence: logs.map((e) => e.snippet).join('\n\n'),
          source_ids: logs.map((e) => e.id),
          reference_type: space?.self_subject.type_profile?.leading_type ?? null,
          refusal: null,
          other_reference_type: other?.type_profile?.leading_type ?? null,
        });
      else setError(result.failure.detail);
    } finally {
      setWorking(false);
      setLoadingAi(false);
    }
  }
  return (
    <div className="relationship-detail">
      <div className="record-tools">
        <button
          className="text-link"
          onClick={() => {
            setName(other?.display_name ?? '');
            setNature(relationship.nature);
            setEditing(true);
          }}
        >
          <Pencil size={14} />
          {t('Repair.editConnection')}
        </button>
        <button className="text-link" onClick={() => setConfirm('delete')}>
          <Trash2 size={14} />
          {t('Repair.deleteConnection')}
        </button>
      </div>
      <Tabs
        id={tabsId}
        label={t('Experience.connectionViews')}
        value={tab}
        onChange={setTab}
        items={[
          {
            value: 'understand',
            label: (
              <>
                <ScanHeart size={17} />
                {t('Experience.understand')}
              </>
            ),
          },
          {
            value: 'conversation',
            label: (
              <>
                <MessagesSquare size={17} />
                {t('Experience.conversation')}
              </>
            ),
          },
        ]}
      />
      <div
        hidden={tab !== 'understand'}
        role="tabpanel"
        id={tabsId + '-panel-understand'}
        aria-labelledby={tabsId + '-tab-understand'}
      >
        <DyadInsight relationship={relationship} other={other} onDirtyChange={setDyadDirty} />
      </div>
      <div
        hidden={tab !== 'conversation'}
        role="tabpanel"
        id={tabsId + '-panel-conversation'}
        aria-labelledby={tabsId + '-tab-conversation'}
        className="conversation-workshop"
      >
        <div className="conversation-grid">
          <div className="product-form">
            <span className="eyebrow">{t('Experience.sharedMoment')}</span>
            <h2>{t('Experience.frictionTitle')}</h2>
            <p>{t('Experience.frictionDescription')}</p>
            <label className="field-label" htmlFor={'snippet-' + relationship.id}>
              {t('Experience.yourObservation')}
            </label>
            <textarea
              id={'snippet-' + relationship.id}
              rows={4}
              value={snippet}
              maxLength={2000}
              disabled={saving}
              onChange={(e) => setSnippet(e.target.value)}
              placeholder={t('RelationshipDetail.snippetPlaceholder')}
            />
            <button
              className="button button-secondary"
              disabled={saving || !snippet.trim()}
              onClick={() => void save()}
            >
              <Plus size={15} />
              {t('RelationshipDetail.addSnippet')}
            </button>
            {relationship.communication_logs.length > 0 && (
              <>
                <details className="snippet-list">
                  <summary>
                    {t('RelationshipDetail.collectedSnippets', {
                      count: relationship.communication_logs.length,
                    })}
                  </summary>
                  {relationship.communication_logs.map((entry) => (
                    <div className="managed-record" key={entry.id}>
                      <time className="reading-meta" dateTime={entry.created_at}>
                        {localDate(entry.created_at, i18n.language)}
                      </time>
                      <p>{entry.snippet}</p>
                      <div className="record-tools">
                        <button className="text-link" onClick={() => setEditingLog(entry.id)}>
                          {t('Repair.editInteraction')}
                        </button>
                        <button className="text-link" onClick={() => setDeletingLog(entry.id)}>
                          {t('Repair.deleteInteraction')}
                        </button>
                      </div>
                    </div>
                  ))}
                </details>
                <button
                  className="button button-primary"
                  disabled={working || history.pending}
                  onClick={() => void analyze()}
                >
                  <Sparkles size={15} />
                  {t('Experience.readInteraction')}
                </button>
              </>
            )}
            {loadingAi && <LoadingRead />}
            {error && <AiError detail={error} onRetry={() => void analyze()} />}
            {history.record && (
              <ReadFeedback
                key={history.record.id}
                record={history.record}
                unsaved={history.pending}
                onDiscard={history.discard}
                onSave={() => void history.retry()}
              />
            )}
            {!history.pending && (
              <ReadingHistory
                readings={history.readings}
                selectedId={history.record?.id}
                onSelect={history.select}
              />
            )}
          </div>
          <div className="rewrite-panel">
            <CommunicationRewrite
              relationshipId={relationship.id}
              recipientName={other?.display_name ?? t('Common.unknown')}
              nature={relationship.nature}
              onDirtyChange={setRewriteDirty}
            />
          </div>
        </div>
      </div>
      <p className="relationship-grounding">{t('Experience.relationshipGrounding')}</p>
      <details className="relationship-management">
        <summary>{t('Repair.ageSafety')}</summary>
        <p className="inline-note">{t('RelationshipDetail.quarantineWarning')}</p>
        <button className="text-link" onClick={() => setConfirm('quarantine')}>
          {t('RelationshipDetail.markUnder18')}
        </button>
      </details>
      <ConfirmDialog
        open={!!confirm}
        title={t(
          confirm === 'quarantine' ? 'RelationshipDetail.markUnder18' : 'Repair.deleteConnection',
        )}
        description={t(
          confirm === 'quarantine'
            ? 'RelationshipDetail.quarantineWarning'
            : 'Repair.deleteConnectionBody',
          { name: other?.display_name },
        )}
        confirmLabel={t(
          confirm === 'quarantine'
            ? 'RelationshipDetail.confirmQuarantine'
            : 'Repair.deletePermanently',
        )}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm === 'quarantine'
            ? quarantine(relationship.other_subject_id, new Date().toISOString())
            : deletePerson(relationship.id, new Date().toISOString())
        }
      />
      <Modal
        open={editing}
        title={t('Repair.editConnection')}
        description={t('Repair.editConnectionBody')}
        onClose={() => leaveEdit.requestLeave(() => setEditing(false))}
        busy={saving}
      >
        <label>
          {t('Repair.name')}
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          {t('Repair.relationshipKind')}
          <select value={nature} onChange={(e) => setNature(e.target.value as RelationshipNature)}>
            {NATURES.map((value) => (
              <option key={value} value={value}>
                {t('RelationshipNature.' + value)}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={saving}
            onClick={() => leaveEdit.requestLeave(() => setEditing(false))}
          >
            {t('Repair.cancel')}
          </button>
          <button
            className="button button-primary"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                if (await editPerson(relationship.id, name, nature, new Date().toISOString()))
                  setEditing(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {t('Repair.saveChanges')}
          </button>
        </div>
      </Modal>
      {leaveEdit.dialog}
      <TextEditorDialog
        open={!!editingLog}
        title={t('Repair.editInteraction')}
        description={t('Repair.editInteractionBody')}
        value={relationship.communication_logs.find((log) => log.id === editingLog)?.snippet ?? ''}
        onClose={() => setEditingLog(null)}
        onSave={(text) =>
          editingLog
            ? editLog(relationship.id, editingLog, text, new Date().toISOString())
            : Promise.resolve(false)
        }
      />
      <ConfirmDialog
        open={!!deletingLog}
        title={t('Repair.deleteInteraction')}
        description={t('Repair.deleteInteractionBody')}
        confirmLabel={t('Repair.deletePermanently')}
        onCancel={() => setDeletingLog(null)}
        onConfirm={() =>
          deletingLog ? deleteLog(relationship.id, deletingLog, new Date().toISOString()) : false
        }
      />
    </div>
  );
}
