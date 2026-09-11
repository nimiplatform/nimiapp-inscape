import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Fingerprint } from 'lucide-react';
import { FOUR_LETTER_TYPES, type FourLetterType } from '../../domain/typology.ts';
import { ChoiceGroup } from '../components/interaction.tsx';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function InitialTyping({ onExplore }: { onExplore?: () => void }) {
  const { t } = useTranslation();
  const setInitialType = useInscapeStore((s) => s.setInitialType);
  const [code, setCode] = useState<FourLetterType | null>(null);
  const [saving, setSaving] = useState(false);
  async function create() {
    if (!code || saving) return;
    setSaving(true);
    await setInitialType(code, new Date().toISOString());
    setSaving(false);
  }
  return (
    <div className="initial-profile">
      <div className="initial-copy">
        <span className="round-icon">
          <Fingerprint size={29} strokeWidth={1.4} />
        </span>
        <span className="eyebrow">{t('Experience.startingPoint')}</span>
        <h2>{t('Experience.typeIntro')}</h2>
        <p>{t('Experience.typeIntroNote')}</p>
        <small>{t('Experience.typeIsOptional')}</small>
      </div>
      <div className="type-picker">
        <ChoiceGroup
          className="type-grid"
          label={t('InitialTyping.title')}
          value={code ?? ''}
          onChange={(value) => setCode(value as FourLetterType)}
          disabled={saving}
          items={FOUR_LETTER_TYPES.map((type) => ({
            value: type,
            label: (
              <>
                <span>{type}</span>
                {code === type && <Check size={13} />}
              </>
            ),
            className: 'type-choice type-group-' + (type[1] === 'N' ? type[2] : type[3]),
          }))}
        />
        <div className="type-actions">
          <button
            className="button button-primary"
            disabled={!code || saving}
            onClick={() => void create()}
          >
            {t('Experience.createMap')}
            <ArrowRight size={15} />
          </button>
          {onExplore && (
            <button className="button button-quiet" onClick={onExplore}>
              {t('Experience.notSureYet')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
