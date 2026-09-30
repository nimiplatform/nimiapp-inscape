import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@nimiplatform/kit/ui';
import { ChoiceGroup, Modal } from '../components/interaction.tsx';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import type { PendingAgeReview } from '../state/inscape-store.ts';

// @nimi-authority: rule.inscape.privacy.r003
export function AgeReviewDialog() {
  const review = useInscapeStore((s) => s.ageReview);
  return review ? <AgeReviewPrompt key={review.id} review={review} /> : null;
}

function AgeReviewPrompt({ review }: { review: PendingAgeReview }) {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const resolve = useInscapeStore((s) => s.resolveAgeReview);
  const [subjectId, setSubjectId] = useState(review.candidateSubjectId);
  const [confirmed, setConfirmed] = useState(false);
  if (!space) return null;
  const correction = subjectId === 'not-current';
  return <Modal open title={t('AgeReview.title')} description={t('AgeReview.body')}
    onClose={() => { resolve(review.id, { kind: 'cancel' }); }}>
    <blockquote className="age-review-evidence">{review.text}</blockquote>
    <ChoiceGroup label={t('AgeReview.subject')} value={subjectId}
      onChange={(value) => { setSubjectId(value); setConfirmed(false); }}
      items={[
        { value: space.self_subject.id, label: t('AgeReview.self') },
        ...space.other_subjects.map((subject) => ({ value: subject.id, label: subject.display_name })),
        { value: 'not-current', label: t('AgeReview.notCurrent') },
      ]} />
    <p>{t(correction ? 'AgeReview.correctionEffect' : subjectId === space.self_subject.id ? 'AgeReview.selfEffect' : 'AgeReview.otherEffect')}</p>
    {!correction && <label className="age-review-attestation">
      <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>{t('AgeReview.confirmAge')}</span>
    </label>}
    <div className="dialog-actions">
      <button className="button button-secondary" autoFocus onClick={() => { resolve(review.id, { kind: 'cancel' }); }}>{t('AgeReview.cancel')}</button>
      <button className={'button ' + (correction ? 'button-primary' : 'button-danger')} disabled={!correction && !confirmed}
        onClick={() => { resolve(review.id, correction ? { kind: 'not_current_age' } : { kind: 'confirmed_minor', subjectId }); }}>
        {t(correction ? 'AgeReview.correct' : 'AgeReview.confirmMinor')}
      </button>
    </div>
  </Modal>;
}
