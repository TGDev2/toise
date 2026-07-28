'use client';

import type {
  ItemPriceComparison,
  SupplierPriceResult,
  ItemSupplierSelection,
} from '@/lib/price-comparison-types';

interface PriceComparisonTableProps {
  items: ItemPriceComparison[];
  supplierKeys: string[];
  supplierNames: Record<string, string>;
  selections: Map<string, string>;
  onSelect: (selection: ItemSupplierSelection) => void;
}

function AvailabilityBadge({
  availability,
}: {
  availability: SupplierPriceResult['availability'];
}) {
  switch (availability) {
    case 'in_stock':
      return (
        <span className="text-xs text-emerald-600">En stock</span>
      );
    case 'limited':
      return (
        <span className="text-xs text-amber-600">Stock limite</span>
      );
    case 'out_of_stock':
      return (
        <span className="text-xs text-red-600">Rupture</span>
      );
    case 'not_found':
      return (
        <span className="text-xs text-stone-400">Non disponible</span>
      );
  }
}

function PriceCell({
  price,
  isBest,
  isSelected,
  onSelect,
}: {
  price: SupplierPriceResult | undefined;
  isBest: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (!price || price.availability === 'not_found') {
    return (
      <td className="px-3 py-3 text-center text-sm text-stone-300">
        Non disponible
      </td>
    );
  }

  return (
    <td
      className={`cursor-pointer px-3 py-3 text-center transition-colors ${
        isSelected
          ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400'
          : isBest
            ? 'bg-emerald-50/50'
            : 'hover:bg-stone-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={isSelected}
            onChange={onSelect}
            className="h-3.5 w-3.5 text-emerald-600 accent-emerald-600"
          />
          <span
            className={`text-sm font-semibold ${
              isBest ? 'text-emerald-700' : 'text-stone-900'
            }`}
          >
            {price.unit_price.toFixed(2)} EUR
          </span>
        </div>
        <AvailabilityBadge availability={price.availability} />
        {price.store_distance_km != null && (
          <span className="text-xs text-stone-400">
            {price.store_distance_km} km
          </span>
        )}
      </div>
    </td>
  );
}

export function PriceComparisonTable({
  items,
  supplierKeys,
  supplierNames,
  selections,
  onSelect,
}: PriceComparisonTableProps) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-stone-500">
        Aucun article a comparer.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Article
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">
              Qte
            </th>
            {supplierKeys.map((key) => (
              <th
                key={key}
                className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500"
              >
                {supplierNames[key] ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((item) => {
            const selectionKey = `${item.material_id}:${item.work_item_id}`;
            const selectedSupplier = selections.get(selectionKey);

            // Build price lookup by supplier
            const priceBySupplier = new Map<string, SupplierPriceResult>();
            for (const p of item.prices) {
              priceBySupplier.set(p.supplier_key, p);
            }

            return (
              <tr key={selectionKey} className="hover:bg-stone-50/50">
                <td className="px-3 py-3">
                  <p className="text-sm font-medium text-stone-900">
                    {item.material_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.material_unit}
                  </p>
                </td>
                <td className="px-3 py-3 text-center text-sm text-stone-700">
                  {item.units_needed}
                </td>
                {supplierKeys.map((supplierKey) => {
                  const price = priceBySupplier.get(supplierKey);
                  const isBest = item.best_supplier_key === supplierKey;
                  const isSelected = selectedSupplier === supplierKey;

                  return (
                    <PriceCell
                      key={supplierKey}
                      price={price}
                      isBest={isBest}
                      isSelected={isSelected}
                      onSelect={() =>
                        onSelect({
                          material_id: item.material_id,
                          work_item_id: item.work_item_id,
                          supplier_key: supplierKey,
                        })
                      }
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
