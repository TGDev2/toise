import Link from 'next/link';
import { WORK_TYPE_LABELS } from '@/lib/project-types';

interface CommunityWorkTypeFilterProps {
  selected: string | null;
}

const WORK_TYPES = Object.entries(WORK_TYPE_LABELS);

export function CommunityWorkTypeFilter({
  selected,
}: CommunityWorkTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/community"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          selected === null
            ? 'bg-stone-900 text-white'
            : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
        }`}
      >
        Tous
      </Link>
      {WORK_TYPES.map(([key, label]) => (
        <Link
          key={key}
          href={`/community?work_type=${key}`}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selected === key
              ? 'bg-stone-900 text-white'
              : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
