import type { ReactNode } from 'react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Check, CheckCheck, Eye, Leaf, LoaderCircle, X } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import type { SavedReading } from '../../domain/reading.ts';
import { ConfirmDialog, localDate } from './interaction.tsx';

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="brand">
      <span className="brand-mark">
        <Leaf size={23} strokeWidth={1.6} />
      </span>
      {!compact && (
        <span>
          <strong>
            Inscape<span className="brand-dot">.</span>
          </strong>
          <small>{t('Experience.brandLine')}</small>
        </span>
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function LoadingRead() {
  const { t } = useTranslation();
  return (
    <div className="reading-loader" role="status">
      <LoaderCircle size={27} className="spin" />
      <h3>{t('Experience.listening')}</h3>
      <p>{t('Experience.listeningNote')}</p>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  );
}

export function AiError({ detail, onRetry }: { detail: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="ai-error" role="alert">
      <strong>{t('Experience.aiError')}</strong>
      <p>{t('Experience.aiErrorNote')}</p>
      <details>
        <summary>{t('Runtime.technicalDetails')}</summary>
        <p>{detail}</p>
      </details>
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          {t('Runtime.retry')}
        </button>
      )}
    </div>
  );
}

// @nimi-authority: rule.inscape.data-model.r007
export function ReadFeedback({
  record,
  unsaved = false,
  onSave,
  onDiscard,
  children,
}: {
  record: SavedReading;
  unsaved?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const update = useInscapeStore((s) => s.setReadingFeedback);
  const remove = useInscapeStore((s) => s.deleteReading);
  const isRewrite = record.mode === 'communication-rewrite';
  const isReference =
    (record.mode === 'self-mirror' || record.mode === 'dyad-insight') &&
    record.source_ids.length === 0;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  async function recordFeedback(value: 'accepted' | 'rejected') {
    if (saving || unsaved) return;
    setSaving(true);
    try {
      await update(record.id, record.feedback === value ? null : value, new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="read-card">
      <div className="reading-meta">
        <time dateTime={record.created_at}>{localDate(record.created_at, i18n.language)}</time>
        <span>{t(unsaved ? 'Repair.readNotSaved' : 'Experience.savedLocally')}</span>
        {!record.refusal &&
          (record.other_reference_type ? (
            <span>
              {t('Repair.readPairReference', {
                self: record.reference_type ?? t('Repair.noType'),
                other: record.other_reference_type,
              })}
            </span>
          ) : record.reference_type ? (
            <span>{t('Repair.readReference', { type: record.reference_type })}</span>
          ) : null)}
      </div>
      {record.refusal ? (
        <div className="refusal-note">
          <p>{t('Repair.refusal.' + record.refusal)}</p>
          <p>{t('Repair.refusalFollowup')}</p>
          <blockquote>{record.evidence}</blockquote>
        </div>
      ) : (
        <div className="read-prose">{children ?? <AiText text={record.text} />}</div>
      )}
      {unsaved && (
        <button className="button button-secondary" onClick={onSave}>
          {t('Repair.saveReading')}
        </button>
      )}
      <div className="read-actions">
        {!record.refusal && (
          <>
            {record.mode !== 'type-suggestion' && (
              <>
                <button
                  disabled={saving || unsaved}
                  aria-pressed={record.feedback === 'accepted'}
                  onClick={() => void recordFeedback('accepted')}
                >
                  <Check size={15} />
                  {t(
                    isRewrite
                      ? 'Repair.meaningFits'
                      : record.relationship_id
                        ? 'Repair.observationFits'
                        : record.feedback === 'accepted'
                          ? 'Experience.accepted'
                          : 'Experience.resonates',
                  )}
                </button>
                <button
                  disabled={saving || unsaved}
                  aria-pressed={record.feedback === 'rejected'}
                  onClick={() => void recordFeedback('rejected')}
                >
                  <X size={15} />
                  {t(
                    isRewrite
                      ? 'Repair.meaningDiffers'
                      : record.relationship_id
                        ? 'Repair.observationDiffers'
                        : record.feedback === 'rejected'
                          ? 'Experience.rejected'
                          : 'Experience.doesntResonate',
                  )}
                </button>
              </>
            )}
            <button aria-expanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)}>
              <Eye size={15} />
              {t('Experience.evidence')}
            </button>
          </>
        )}
        {(!unsaved || onDiscard) && (
          <button onClick={() => setDeleting(true)}>
            {t(
              unsaved
                ? 'Repair.discardReading'
                : record.refusal
                  ? 'Repair.deleteRecord'
                  : 'Repair.deleteReading',
            )}
          </button>
        )}
      </div>
      {record.feedback && <p className="inline-note">{t('Repair.feedbackUndoHint')}</p>}
      {showEvidence && (
        <div className="evidence-panel">
          <span className="eyebrow">
            {t(isReference ? 'Repair.referenceContext' : 'Experience.yourWords')}
          </span>
          <p>{record.evidence || t('Experience.noEvidence')}</p>
          <small>{t('Experience.evidenceNote')}</small>
        </div>
      )}
      <ConfirmDialog
        open={deleting}
        title={t(
          unsaved
            ? 'Repair.discardReading'
            : record.refusal
              ? 'Repair.deleteRecord'
              : 'Repair.deleteReading',
        )}
        description={t('Repair.deleteReadingBody')}
        confirmLabel={t(unsaved ? 'Repair.discardReading' : 'Repair.deletePermanently')}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (unsaved) {
            onDiscard?.();
            return true;
          }
          return remove(record.id, new Date().toISOString());
        }}
      />
    </div>
  );
}

export function AiText({ text }: { text: string }) {
  return (
    <Markdown
      skipHtml
      unwrapDisallowed
      allowedElements={[
        'p',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'code',
        'br',
      ]}
    >
      {text}
    </Markdown>
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}

export function SavedNote() {
  const { t } = useTranslation();
  return (
    <span className="saved-note">
      <CheckCheck size={13} />
      {t('Experience.savedLocally')}
    </span>
  );
}
