'use client';

const CATEGORIES = [
  { value: '', label: 'Tous' },
  { value: 'painting', label: 'Peinture' },
  { value: 'tiling', label: 'Carrelage' },
  { value: 'flooring', label: 'Parquet' },
  { value: 'partition', label: 'Cloison' },
  { value: 'wall_covering', label: 'Revêtement mural' },
] as const;

interface CategoryTabsProps {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            selected === cat.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent)]/10'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
