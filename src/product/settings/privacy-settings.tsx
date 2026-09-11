import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@nimiplatform/kit/ui';
import { LockKeyhole, Settings2, Trash2 } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function PrivacySettings() {
  const { t } = useTranslation();
  const space = useInscapeStore((state) => state.space);
  const clearLocalData = useInscapeStore((state) => state.clearLocalData);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  function changeOpen(next: boolean) {
    if (working) return;
    setOpen(next);
    if (!next) {
      setConfirming(false);
      setError(false);
    }
  }
  async function clear() {
    if (working) return;
    setWorking(true);
    setError(false);
    const cleared = await clearLocalData();
    if (!cleared) {
      setError(true);
      setWorking(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button className="settings-trigger" aria-label={t('PrivacySettings.title')}>
          <Settings2 size={17} />
          <span>{t('PrivacySettings.title')}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="privacy-dialog" onClose={() => changeOpen(false)}>
        <span className="round-icon">
          <LockKeyhole size={23} />
        </span>
        <DialogTitle>
          {t(confirming ? 'PrivacySettings.confirmTitle' : 'PrivacySettings.title')}
        </DialogTitle>
        <DialogDescription>
          {t(confirming ? 'PrivacySettings.confirmBody' : 'PrivacySettings.description')}
        </DialogDescription>
        {!confirming && (
          <div className="privacy-counts">
            <span>
              {t('PrivacySettings.notes', {
                count: space?.self_subject.reflection_entries.length ?? 0,
              })}
            </span>
            <span>
              {t('PrivacySettings.connections', { count: space?.relationships.length ?? 0 })}
            </span>
          </div>
        )}
        {error && (
          <p role="alert" className="ai-error">
            {t('PrivacySettings.failed')}
          </p>
        )}
        <div className="button-row">
          {confirming ? (
            <>
              <button
                className="button button-secondary"
                disabled={working}
                onClick={() => setConfirming(false)}
              >
                {t('RelationshipDetail.cancel')}
              </button>
              <button
                className="button button-danger"
                disabled={working}
                onClick={() => void clear()}
              >
                <Trash2 size={15} />
                {t(working ? 'PrivacySettings.clearing' : 'PrivacySettings.confirm')}
              </button>
            </>
          ) : (
            <button className="button button-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={15} />
              {t('PrivacySettings.clear')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
