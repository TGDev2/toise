'use client';

import { useMemo, useState } from 'react';
import type { ShoppingListMaterialItem } from '@/lib/shopping-list-types';

const CATEGORY_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet / Sol',
  partition: 'Cloison',
  wall_covering: 'Revetement mural',
};

interface ShoppingListMaterialsProps {
  items: ShoppingListMaterialItem[];
  onUpdateQuantity: (
    materialId: string,
    workItemId: string,
    units: number,
  ) => void;
  onResetQuantity: (materialId: string, workItemId: string) => void;
}

function MaterialRow({
  item,
  onUpdateQuantity,
  onResetQuantity,
}: {
  item: ShoppingListMaterialItem;
  onUpdateQuantity: (units: number) => void;
  onResetQuantity: () => void;
}) {
  const [localQty, setLocalQty] = useState(item.units_needed);

  const handleBlur = () => {
    const val = Math.max(0, Math.round(localQty));
    setLocalQty(val);
    if (val !== item.units_needed) {
      onUpdateQuantity(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleReset = () => {
    setLocalQty(item.original_units_needed);
    onResetQuantity();
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">{item.material_name}</p>
        <p className="mt-0.5 text-sm text-stone-500">
          {item.work_type_label} · {item.packaging_label}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.is_manually_adjusted && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200"
            title="Reinitialiser la quantite"
          >
            Modifie
          </button>
        )}
        <input
          type="number"
          min={0}
          value={localQty}
          onChange={(e) => setLocalQty(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-16 rounded-xl border border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-sm font-semibold text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
          aria-label={`Quantite pour ${item.material_name}`}
        />
        <span className="text-sm text-stone-500">
          x {item.packaging_label}
        </span>
      </div>
    </div>
  );
}

export function ShoppingListMaterials({
  items,
  onUpdateQuantity,
  onResetQuantity,
}: ShoppingListMaterialsProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingListMaterialItem[]>();
    for (const item of items) {
      const cat = item.material_category;
      const existing = map.get(cat);
      if (existing) {
        existing.push(item);
      } else {
        map.set(cat, [item]);
      }
    }
    return Array.from(map.entries());
  }, [items]);

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(grouped.map(([cat]) => cat)),
  );

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-stone-400">
        Aucun materiau dans la liste.
      </p>
    );
  }

  function toggleSection(cat: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map(([category, categoryItems]) => (
        <div key={category}>
          <button
            type="button"
            onClick={() => toggleSection(category)}
            aria-expanded={openSections.has(category)}
            className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-stone-50"
          >
            <div className="min-w-0 flex-1">
              <span className="text-lg font-semibold text-stone-900">
                {CATEGORY_LABELS[category] || category}
              </span>
            </div>
            <span className="mr-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
              {categoryItems.length} article{categoryItems.length > 1 ? 's' : ''}
            </span>
            <span
              className="text-stone-400 transition-transform duration-200"
              style={{
                transform: openSections.has(category)
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
              aria-hidden="true"
            >
              &#x25B8;
            </span>
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateRows: openSections.has(category) ? '1fr' : '0fr',
              transition: 'grid-template-rows 200ms ease',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div className="space-y-3 pt-3">
                {categoryItems.map((item) => (
                  <MaterialRow
                    key={`${item.material_id}-${item.work_item_id}`}
                    item={item}
                    onUpdateQuantity={(units) =>
                      onUpdateQuantity(item.material_id, item.work_item_id, units)
                    }
                    onResetQuantity={() =>
                      onResetQuantity(item.material_id, item.work_item_id)
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
