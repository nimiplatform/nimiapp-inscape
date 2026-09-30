import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/interaction.tsx';
import { StandaloneLanguageSwitch } from './language-switch.tsx';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

// @nimi-authority: rule.inscape.data-model.r006
// @nimi-authority: rule.inscape.privacy.r003
export function SpaceRecovery({ quarantined = false }: { quarantined?: boolean }) {
  const { t } = useTranslation();
  const loadError = useInscapeStore((s) => s.loadError);
  const error = useInscapeStore((s) => s.error);
  const initialize = useInscapeStore((s) => s.initialize);
  const clear = useInscapeStore((s) => s.clearLocalData);
  const [confirm, setConfirm] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  const incompatible = loadError?.kind === 'load_incompatible_version';
  return (
    <section className="space-recovery">
      <StandaloneLanguageSwitch />
      <h1>{t(quarantined ? 'AgeGate.title' : incompatible ? 'Recovery.versionTitle' : 'Recovery.loadTitle')}</h1>
      <p role="alert">{t(quarantined ? 'AgeGate.body' : incompatible ? 'Recovery.versionBody' : 'Repair.loadFailure')}</p>
      <div className="button-row">
        {!quarantined && !incompatible && <button className="button button-primary" onClick={() => void initialize()}>{t('Runtime.retry')}</button>}
        <button className="button button-danger" onClick={() => { setClearFailed(false); setConfirm(true); }}>{t('PrivacySettings.clear')}</button>
      </div>
      {clearFailed && <p role="alert">{t('PrivacySettings.failed')}</p>}
      {!quarantined && <details className="technical-note">
        <summary>{t('Runtime.technicalDetails')}</summary>
        <p>{error}</p>
        {incompatible && <p>{t('Recovery.versionDetails', { stored: loadError.storedVersion, expected: loadError.expectedVersion })}</p>}
      </details>}
      <ConfirmDialog open={confirm} title={t('PrivacySettings.confirmTitle')}
        description={t('PrivacySettings.confirmBody')} confirmLabel={t('PrivacySettings.confirm')}
        onCancel={() => setConfirm(false)} onConfirm={async () => {
          const cleared = await clear();
          setClearFailed(!cleared);
          return cleared;
        }} />
    </section>
  );
}
