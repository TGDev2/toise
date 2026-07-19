interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-[var(--foreground)]/10 bg-[var(--surface)] p-5">
      <p className="text-xs font-medium text-[var(--foreground)]/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-[var(--foreground)]/40">{hint}</p>
      )}
    </div>
  );
}
