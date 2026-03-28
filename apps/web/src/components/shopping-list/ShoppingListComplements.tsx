'use client';

import { useState } from 'react';
import type { ShoppingListComplementaryItem } from '@/lib/shopping-list-types';

interface ShoppingListComplementsProps {
  items: ShoppingListComplementaryItem[];
  onUpdateQuantity: (complementaryMaterialId: string, quantity: number) => void;
  onRemove: (complementaryMaterialId: string) => void;
  onRestore: (complementaryMaterialId: string) => void;
}

function ComplementRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: ShoppingListComplementaryItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const [localQty, setLocalQty] = useState(item.quantity);

  const handleBlur = () => {
    const val = Math.max(0, Math.round(localQty));
    setLocalQty(val);
    if (val !== item.quantity) {
      onUpdateQuantity(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">{item.name}</p>
        {item.description_fr && (
          <p className="mt-0.5 text-sm text-stone-500">{item.description_fr}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          min={0}
          value={localQty}
          onChange={(e) => setLocalQty(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-16 rounded-xl border border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-sm font-semibold text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
          aria-label={`Quantite pour ${item.name}`}
        />
        <span className="text-sm text-stone-500">{item.unit_label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-500"
          title="Retirer de la liste"
          aria-label={`Retirer ${item.name}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ShoppingListComplements({
  items,
  onUpdateQuantity,
  onRemove,
  onRestore,
}: ShoppingListComplementsProps) {
  const [showRemoved, setShowRemoved] = useState(false);

  const activeItems = items.filter((i) => !i.is_removed);
  const removedItems = items.filter((i) => i.is_removed);

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-stone-900">
        Accessoires recommandes
      </h2>

      {activeItems.length === 0 ? (
        <p className="py-4 text-sm text-stone-400">
          Tous les accessoires ont ete retires.
        </p>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <ComplementRow
              key={item.complementary_material_id}
              item={item}
              onUpdateQuantity={(qty) =>
                onUpdateQuantity(item.complementary_material_id, qty)
              }
              onRemove={() => onRemove(item.complementary_material_id)}
            />
          ))}
        </div>
      )}

      {removedItems.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRemoved(!showRemoved)}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            {showRemoved ? 'Masquer' : 'Voir'} les articles retires (
            {removedItems.length})
          </button>

          {showRemoved && (
            <div className="mt-3 space-y-2">
              {removedItems.map((item) => (
                <div
                  key={item.complementary_material_id}
                  className="flex items-center gap-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-3 opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-600">{item.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(item.complementary_material_id)}
                    className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-300"
                  >
                    Restaurer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
