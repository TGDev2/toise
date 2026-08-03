'use client';

import { useMemo } from 'react';
import type { EstimationLineItem } from '@/lib/estimation-types';
import { packagingUnits } from '@/lib/packaging';

interface EstimationSummaryProps {
  items: EstimationLineItem[];
}

interface ConsolidatedMaterial {
  materialName: string;
  packagingLabel: string;
  totalUnits: number;
}

export function EstimationSummary({ items }: EstimationSummaryProps) {
  const consolidated = useMemo(() => {
    // Only show when 2+ distinct work types
    const workTypes = new Set(items.map((i) => i.work_type_code));
    if (workTypes.size < 2) return null;

    // Une ligne par (matériau, format) : un achat panaché (E1-5) se consolide
    // format par format, sinon deux lignes « Pot 5 L + Pot 2.5 L » se
    // cumuleraient en « 4 × Pot 5 L + Pot 2.5 L », qui ne veut rien dire.
    const map = new Map<string, ConsolidatedMaterial>();
    for (const item of items) {
      for (const entry of packagingUnits(
        item.units_needed,
        item.packaging_label,
        item.packaging_breakdown,
      )) {
        const key = `${item.material_id}::${entry.label}`;
        const existing = map.get(key);
        if (existing) {
          existing.totalUnits += entry.units;
        } else {
          map.set(key, {
            materialName: item.material_name,
            packagingLabel: entry.label,
            totalUnits: entry.units,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [items]);

  if (!consolidated) return null;

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          Recapitulatif global
        </h2>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {consolidated.length} matériau{consolidated.length > 1 ? 'x' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {consolidated.map((mat) => (
          <div
            key={`${mat.materialName}::${mat.packagingLabel}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3"
          >
            <span className="min-w-0 truncate text-sm font-medium text-stone-800">
              {mat.materialName}
            </span>
            <span className="shrink-0 text-sm font-bold text-stone-900">
              {mat.totalUnits} × {mat.packagingLabel}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
