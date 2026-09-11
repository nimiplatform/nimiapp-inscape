import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, Plus, Users, X } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { AddPersonForm } from '../relationship/add-person-form.tsx';
import { RelationshipDetail } from '../relationship/relationship-detail.tsx';
import { QuarantineArea } from '../relationship/quarantine-area.tsx';
import { ChoiceGroup, useLeaveGuard } from '../components/interaction.tsx';
import { PageHeading } from '../components/primitives.tsx';

export function RelationshipFace() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const relationships = space?.relationships ?? [];
  const others = space?.other_subjects ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const leave = useLeaveGuard(dirty);
  const leaveAdd = useLeaveGuard(adding && addDirty);
  const current = relationships.find((r) => r.id === selected) ?? relationships[0];
  return (
    <section className="relationship-face">
      <PageHeading
        eyebrow={t('Experience.relationshipEyebrow')}
        title={t('Experience.relationshipPageTitle')}
        description={t('Experience.relationshipPageDescription')}
        action={
          <button className="button button-primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            {t('Experience.addConnection')}
          </button>
        }
      />
      {adding && (
        <div className="add-person-panel">
          <button
            className="icon-button panel-close"
            aria-label={t('Experience.close')}
            onClick={() => leaveAdd.requestLeave(() => setAdding(false))}
          >
            <X size={18} />
          </button>
          <AddPersonForm
            onDirtyChange={setAddDirty}
            onAdded={(id) => {
              setAdding(false);
              leave.requestLeave(() => {
                setDirty(false);
                setSelected(id);
              });
            }}
          />
        </div>
      )}
      {relationships.length === 0 ? (
        <div className="relationship-empty">
          <div className="relationship-illustration">
            <HeartHandshake size={62} strokeWidth={1} />
          </div>
          <span className="eyebrow">{t('Experience.connectionHint')}</span>
          <h2>{t('Experience.connectionEmptyTitle')}</h2>
          <p>{t('Experience.connectionEmptyDescription')}</p>
          <button className="button button-primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            {t('Experience.addConnection')}
          </button>
        </div>
      ) : (
        <>
          <div className="section-heading">
            <h2>
              <Users size={17} />
              {t('Experience.myConnections')}
            </h2>
            <span>{t('Experience.connectionHint')}</span>
          </div>
          <ChoiceGroup
            className="connection-grid"
            label={t('Experience.myConnections')}
            value={current?.id ?? ''}
            onChange={(id) => {
              if (id !== current?.id)
                leave.requestLeave(() => {
                  setDirty(false);
                  setSelected(id);
                });
            }}
            items={relationships.map((relationship, index) => {
              const other = others.find((o) => o.id === relationship.other_subject_id);
              return {
                value: relationship.id,
                className:
                  'connection-card color-' +
                  (index % 4) +
                  (current?.id === relationship.id ? ' selected' : ''),
                label: (
                  <>
                    <span className="connection-avatar" aria-hidden="true">
                      {(other?.display_name || '?').slice(0, 1)}
                    </span>
                    <span>
                      <strong>{other?.display_name}</strong>
                      <small>
                        {t('RelationshipNature.' + relationship.nature)} ·{' '}
                        {other?.type_profile?.leading_type ?? t('Experience.stillBecoming')}
                      </small>
                      <span className="connection-count">
                        {t('Experience.connectionCount', {
                          count: relationship.communication_logs.length,
                        })}
                      </span>
                    </span>
                  </>
                ),
              };
            })}
          />
          {current && (
            <RelationshipDetail
              key={current.id}
              onDirtyChange={setDirty}
              relationship={current}
              other={others.find((o) => o.id === current.other_subject_id)}
            />
          )}
        </>
      )}
      <QuarantineArea />
      {leave.dialog}
      {leaveAdd.dialog}
    </section>
  );
}
