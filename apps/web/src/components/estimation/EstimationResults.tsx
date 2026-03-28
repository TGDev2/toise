'use client';

import type { EstimationLineItem } from '@/lib/estimation-types';
import { WORK_TYPE_ICONS } from '@/lib/work-types';

interface EstimationResultsProps {
  items: EstimationLineItem[];
}

function formatQty(qty: number, unit: string): string {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unit}`;
}

export function EstimationResults({ items }: EstimationResultsProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-stone-400">
        Aucun materiau a estimer.
      </p>
    );
  }

  // Group items by work type
  const grouped = new Map<string, { label: string; code: string; items: EstimationLineItem[] }>();
  for (const item of items) {
    const existing = grouped.get(item.work_type_code);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.set(item.work_type_code, {
        label: item.work_type_label,
        code: item.work_type_code,
        items: [item],
      });
    }
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.values()).map((group) => (
        <div key={group.code}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900">
            <span>{WORK_TYPE_ICONS[group.code] || ''}</span>
            {group.label}
          </h3>

          <div className="space-y-3">
            {group.items.map((item, idx) => (
              <div
                key={`${item.material_id}-${idx}`}
                className="rounded-2xl border border-stone-200 bg-white px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">
                      {item.material_name}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      Surface : {item.surface_m2} m²
                      {item.number_of_coats
                        ? ` · ${item.number_of_coats} couche${item.number_of_coats > 1 ? 's' : ''}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-stone-900">
                      {item.units_needed} × {item.packaging_label}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  <span>
                    Theorique : {formatQty(item.theoretical_qty, item.material_unit)}
                  </span>
                  <span className="flex items-center gap-1">
                    Perte : {item.waste_factor_percent}%
                    {item.waste_factor_source === 'default' && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        generique
                      </span>
                    )}
                  </span>
                  <span>
                    Ajuste : {formatQty(item.adjusted_qty, item.material_unit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
