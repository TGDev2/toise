'use client';

import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="text-sm text-stone-600">{message}</div>
      <div className="mt-6 flex gap-3">
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={busy}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
