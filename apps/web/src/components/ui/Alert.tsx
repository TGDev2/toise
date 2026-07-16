import type { ReactNode } from 'react';

const VARIANTS = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-stone-200 bg-white text-stone-700',
  success: 'border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent-strong)]',
} as const;

interface AlertProps {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : undefined}
      className={`rounded-2xl border px-4 py-3 text-sm ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
