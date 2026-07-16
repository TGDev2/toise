'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SIZES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
} as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: keyof typeof SIZES;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Piège le focus dans la modale.
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_25px_80px_rgba(67,39,15,0.15)] focus:outline-none ${SIZES[size]}`}
      >
        <div className="flex items-start justify-between gap-4">
          {title && (
            <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className={title ? 'mt-3' : ''}>{children}</div>
        {footer && <div className="mt-6 flex gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
