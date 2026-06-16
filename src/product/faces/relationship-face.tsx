// IS-IA — Relationship face. Add people (other_person subjects) + relationships,
// paste conversation snippets, and run Mode D friction reads. Communication
// rewrite (Mode C) lands in wave-4 with its 4-layer anti-manipulation defence.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { AddPersonForm } from '../relationship/add-person-form.tsx';
import { RelationshipDetail } from '../relationship/relationship-detail.tsx';
import { QuarantineArea } from '../relationship/quarantine-area.tsx';

export function RelationshipFace() {
  const { t } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const relationships = space?.relationships ?? [];
  const others = space?.other_subjects ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  const otherFor = (id: string) => others.find((o) => o.id === id);
  const selectedRelationship = relationships.find((r) => r.id === selected) ?? null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t('Relationship.title')}</h2>
      <AddPersonForm />

      {relationships.length === 0 ? (
        <p className="text-sm opacity-60">{t('Relationship.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {relationships.map((relationship) => {
            const other = otherFor(relationship.other_subject_id);
            return (
              <li key={relationship.id}>
                <button
                  type="button"
                  onClick={() => setSelected((s) => (s === relationship.id ? null : relationship.id))}
                  className="text-sm underline-offset-2 hover:underline"
                  aria-current={selected === relationship.id ? 'true' : undefined}
                >
                  {t('Relationship.buttonLabel', {
                    name: other?.display_name ?? t('Common.unknown'),
                    nature: t(`RelationshipNature.${relationship.nature}`),
                  })}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedRelationship && (
        <RelationshipDetail
          relationship={selectedRelationship}
          other={otherFor(selectedRelationship.other_subject_id)}
        />
      )}

      <QuarantineArea />
    </section>
  );
}
