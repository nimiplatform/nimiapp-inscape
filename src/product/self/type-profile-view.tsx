import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, Sprout } from 'lucide-react';
import { COGNITIVE_FUNCTIONS, DICHOTOMIES, type CognitiveFunction } from '../../domain/typology.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

// @nimi-authority: rule.inscape.ia.r002
export function TypeProfileView({ profile }: { profile: TypeProfile }) {
  const { t } = useTranslation();
  const functions = [...COGNITIVE_FUNCTIONS].sort(
    (a, b) =>
      profile.function_stack_posterior[b].strength - profile.function_stack_posterior[a].strength,
  );
  const [selected, setSelected] = useState<CognitiveFunction>(functions[0]);
  return (
    <div className="profile-map">
      <div className="profile-map-header">
        <div>
          <span className="eyebrow">{t('Experience.functionMap')}</span>
          <h2>{t('Experience.mapTitle')}</h2>
        </div>
        <span className="pattern-pill">
          {profile.leading_type
            ? t('Experience.patternLabel', { type: profile.leading_type })
            : t('Experience.stillBecoming')}
        </span>
      </div>
      <div className="function-map-layout">
        <div className="function-bars" role="radiogroup" aria-label={t('Experience.functionMap')}>
          {functions.map((fn, index) => {
            const value = profile.function_stack_posterior[fn];
            return (
              <button
                className={`function-row function-${fn} ${selected === fn ? 'selected' : ''}`}
                key={fn}
                onClick={() => setSelected(fn)}
                role="radio"
                aria-checked={selected === fn}
                tabIndex={selected === fn ? 0 : -1}
                onKeyDown={(event) => {
                  const step = ['ArrowRight', 'ArrowDown'].includes(event.key)
                    ? 1
                    : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                      ? -1
                      : 0;
                  if (!step) return;
                  event.preventDefault();
                  const next = (index + step + functions.length) % functions.length;
                  setSelected(functions[next]);
                  (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
                }}
              >
                <span className="function-badge">{fn}</span>
                <span className="function-bar-body">
                  <span>
                    <strong>{t(`Functions.${fn}.name`)}</strong>
                    <small>{Math.round(value.strength * 100)}</small>
                  </span>
                  <span className="function-track">
                    <span style={{ width: `${value.strength * 100}%` }} />
                  </span>
                </span>
                <span className="confidence-band">
                  {t('Experience.confidence')}
                  <b>{Math.round(value.confidence * 100)}%</b>
                </span>
              </button>
            );
          })}
        </div>
        <div className={`function-story function-${selected}`}>
          <span className="function-badge large">{selected}</span>
          <span className="eyebrow">{t(`Functions.${selected}.label`)}</span>
          <h3>{t(`Functions.${selected}.name`)}</h3>
          <p>{t(`Functions.${selected}.description`)}</p>
          <div>
            <Sprout size={17} />
            <span>{t(`Functions.${selected}.practice`)}</span>
          </div>
          <small>{t('Experience.lensNote')}</small>
        </div>
      </div>
      <p className="map-note">
        <Info size={13} />
        {t('Experience.confidenceNote')}
      </p>
      <div className="dimension-section">
        <h3>{t('Experience.preferenceTitle')}</h3>
        <p className="axis-explanation">{t('Repair.typeDerivationNote')}</p>
        <div className="dimension-grid">
          {DICHOTOMIES.filter((axis) => axis !== 'A_T').map((axis) => {
            const value = profile.dichotomy_distribution[axis];
            return (
              <div key={axis} className="dimension">
                <div>
                  <span>{t(`Dimensions.${axis}.left`)}</span>
                  <span>{t(`Dimensions.${axis}.right`)}</span>
                </div>
                <div className="dimension-track">
                  <span style={{ left: `${(value.value + 1) * 50}%` }} />
                </div>
                <small>
                  {t('Experience.confidence')} {Math.round(value.confidence * 100)}%
                </small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
