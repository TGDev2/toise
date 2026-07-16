'use client';

import type { ReactNode } from 'react';
import { WORK_TYPE_ICONS } from '@/lib/work-types';

interface WorkTypeSectionProps {
  code: string;
  label: string;
  grossSurface: number;
  netSurface: number;
  itemCount: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function WorkTypeSection({
  code,
  label,
  grossSurface,
  netSurface,
  itemCount,
  isOpen,
  onToggle,
  children,
}: WorkTypeSectionProps) {
  const icon = WORK_TYPE_ICONS[code] || '';
  const showBothSurfaces = grossSurface !== netSurface;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-stone-50"
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-lg"
          aria-hidden="true"
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <span className="text-lg font-semibold text-stone-900">{label}</span>
          <p className="text-xs text-stone-500">
            {showBothSurfaces ? (
              <>
                Surface brute : {grossSurface} m² · Surface nette : {netSurface} m²
              </>
            ) : (
              <>Surface : {netSurface} m²</>
            )}
          </p>
        </div>

        <span className="mr-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
          {itemCount} matériau{itemCount > 1 ? 'x' : ''}
        </span>

        <span
          className="text-stone-400 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
