'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] hover:-translate-y-0.5 hover:shadow-md',
  secondary:
    'border border-stone-300 bg-white text-stone-700 hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-sm',
  danger:
    'bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-md',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
} as const;

const SIZES = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
} as const;

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
