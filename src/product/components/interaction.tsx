import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, X } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';

export function Modal({
  open,
  title,
  description,
  onClose,
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="inscape-dialog"
      aria-labelledby={id}
      aria-describedby={description ? id + '-description' : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label={t('Repair.close')}
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {description && (
        <p id={id + '-description'} className="dialog-description">
          {description}
        </p>
      )}
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  danger = true,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<boolean> | boolean;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (await onConfirm()) onCancel();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} title={title} description={description} onClose={onCancel} busy={busy}>
      <div className="dialog-actions">
        <button className="button button-secondary" disabled={busy} onClick={onCancel} autoFocus>
          {t('Repair.cancel')}
        </button>
        <button
          className={'button ' + (danger ? 'button-danger' : 'button-primary')}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy && <LoaderCircle size={15} className="spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function SaveRecovery() {
  const { t } = useTranslation();
  const error = useInscapeStore((s) => s.saveError);
  const retrying = useInscapeStore((s) => s.retrying);
  const retry = useInscapeStore((s) => s.retrySave);
  const cancel = useInscapeStore((s) => s.cancelSave);
  useUnsavedWarning(!!error);
  return (
    <Modal
      open={!!error}
      title={t('Repair.saveFailureTitle')}
      description={t('Repair.saveFailureBody')}
      onClose={cancel}
      busy={retrying}
    >
      <details className="technical-note">
        <summary>{t('Runtime.technicalDetails')}</summary>
        <p>{error}</p>
      </details>
      <div className="dialog-actions">
        <button className="button button-secondary" disabled={retrying} onClick={cancel}>
          {t('Repair.backToEditing')}
        </button>
        <button className="button button-primary" disabled={retrying} onClick={() => void retry()}>
          {retrying && <LoaderCircle size={15} className="spin" />}
          {t('Repair.retrySave')}
        </button>
      </div>
    </Modal>
  );
}

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export function useLeaveGuard(dirty: boolean, save?: () => Promise<boolean>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = useRef<(() => void) | null>(null);
  useUnsavedWarning(dirty);
  function requestLeave(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    next.current = action;
    setOpen(true);
  }
  function leave() {
    setOpen(false);
    next.current?.();
    next.current = null;
  }
  const dialog = (
    <Modal
      open={open}
      title={t('Repair.leaveTitle')}
      description={t(save ? 'Repair.leaveBody' : 'Repair.leaveUnsavedBody')}
      onClose={() => setOpen(false)}
      busy={busy}
    >
      <div className="dialog-actions">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => setOpen(false)}
          autoFocus
        >
          {t('Repair.keepWriting')}
        </button>
        <button className="button button-quiet" disabled={busy} onClick={leave}>
          {t('Repair.discardDraft')}
        </button>
        {save && (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (await save()) leave();
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('Repair.saveAndLeave')}
          </button>
        )}
      </div>
    </Modal>
  );
  return { requestLeave, dialog };
}

export function Tabs({
  id,
  label,
  items,
  value,
  onChange,
  className = 'self-tabs',
}: {
  id: string;
  label: string;
  items: readonly { value: string; label: ReactNode; className?: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          className={item.className}
          key={item.value}
          id={id + '-tab-' + item.value}
          role="tab"
          aria-selected={value === item.value}
          aria-controls={id + '-panel-' + item.value}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === 'ArrowRight') next = (index + 1) % items.length;
            else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else return;
            event.preventDefault();
            onChange(items[next].value);
            document.getElementById(id + '-tab-' + items[next].value)?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ChoiceGroup({
  label,
  items,
  value,
  onChange,
  className = 'filter-tabs',
  disabled = false,
}: {
  label: string;
  items: readonly { value: string; label: ReactNode; className?: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {items.map((item, index) => (
        <button
          className={item.className}
          type="button"
          key={item.value}
          id={id + index}
          role="radio"
          aria-checked={value === item.value}
          tabIndex={
            value === item.value || (!items.some((i) => i.value === value) && index === 0) ? 0 : -1
          }
          disabled={disabled}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const step = ['ArrowRight', 'ArrowDown'].includes(event.key)
              ? 1
              : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                ? -1
                : 0;
            if (!step) return;
            event.preventDefault();
            const next = (index + step + items.length) % items.length;
            onChange(items[next].value);
            document.getElementById(id + next)?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function localDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
