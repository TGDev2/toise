'use client';

import { WORK_TYPE_LABELS } from '@/lib/project-types';

interface CommunityWorkTypeFilterProps {
  selected: string | null;
  onChange: (workType: string | null) => void;
}

const WORK_TYPES = Object.entries(WORK_TYPE_LABELS);

export function CommunityWorkTypeFilter({
  selected,
  onChange,
}: CommunityWorkTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          selected === null
            ? 'bg-stone-900 text-white'
            : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
        }`}
      >
        Tous
      </button>
      {WORK_TYPES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selected === key
              ? 'bg-stone-900 text-white'
              : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
