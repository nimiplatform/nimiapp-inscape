import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { FOUR_LETTER_TYPES, isFourLetterType, type FourLetterType } from '../../domain/typology.ts';
import { Modal, useLeaveGuard } from './interaction.tsx';

export function TextEditorDialog({
  open,
  title,
  description,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  value: string;
  onClose: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText(value);
  }, [open, value]);
  const leave = useLeaveGuard(open && text !== value);
  async function save() {
    if (!text.trim() || busy) return;
    if (text.trim() === value.trim()) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      if (await onSave(text.trim())) onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        open={open}
        title={title}
        description={description}
        onClose={() => leave.requestLeave(onClose)}
        busy={busy}
      >
        <label>
          {t('Repair.originalText')}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            autoFocus
            disabled={busy}
          />
        </label>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => leave.requestLeave(onClose)}
          >
            {t('Repair.cancel')}
          </button>
          <button
            className="button button-primary"
            disabled={busy || !text.trim()}
            onClick={() => void save()}
          >
            {t('Repair.saveChanges')}
          </button>
        </div>
      </Modal>
      {leave.dialog}
    </>
  );
}

export function TypeReferenceControl({
  value,
  self = false,
  onSave,
}: {
  value: FourLetterType | null;
  self?: boolean;
  onSave: (type: FourLetterType | null) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const label = t(self ? 'Repair.changeStartingType' : 'Repair.changeOtherType');
  return (
    <>
      <button
        className="text-link"
        onClick={() => {
          setCode(value ?? '');
          setOpen(true);
        }}
      >
        <Pencil size={14} />
        {label}
      </button>
      <Modal
        open={open}
        title={label}
        description={t(self ? 'Repair.changeStartingTypeBody' : 'Repair.changeOtherTypeBody')}
        onClose={() => setOpen(false)}
        busy={busy}
      >
        <label>
          {t('Repair.typeReference')}
          <select value={code} onChange={(e) => setCode(e.target.value)} autoFocus>
            <option value="">{t('Repair.noType')}</option>
            {FOUR_LETTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            {t('Repair.cancel')}
          </button>
          <button
            className="button button-primary"
            disabled={busy || (value !== null && code === value)}
            onClick={async () => {
              setBusy(true);
              try {
                if (await onSave(isFourLetterType(code) ? code : null)) setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('Repair.saveChanges')}
          </button>
        </div>
      </Modal>
    </>
  );
}
