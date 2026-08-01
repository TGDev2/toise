'use client';

import { SKILL_LEVELS } from '@/lib/work-types';

interface SkillLevelSelectorProps {
  value: string;
  onChange: (level: string) => void;
  disabled?: boolean;
}

export function SkillLevelSelector({
  value,
  onChange,
  disabled,
}: SkillLevelSelectorProps) {
  return (
    <div className="flex gap-1 rounded-2xl bg-stone-100 p-1">
      {SKILL_LEVELS.map((level) => (
        <button
          key={level.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(level.value)}
          className={`min-h-11 flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            value === level.value
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
