'use client';

import type { SupplierTotal } from '@/lib/price-comparison-types';

interface SupplierTotalsSummaryProps {
  supplierTotals: SupplierTotal[];
  optimizedTotal: number;
  selectedTotal: number;
  onQuickSelect: (supplierKey: string | null) => void;
}

export function SupplierTotalsSummary({
  supplierTotals,
  optimizedTotal,
  selectedTotal,
  onQuickSelect,
}: SupplierTotalsSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Optimized total */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600">
              Total optimise (mix fournisseurs)
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {optimizedTotal.toFixed(2)}{' '}
              <span className="text-sm font-medium text-emerald-500">EUR</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onQuickSelect(null)}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Prix optimal
          </button>
        </div>
      </div>

      {/* Selected total (if different from optimized) */}
      {Math.abs(selectedTotal - optimizedTotal) > 0.01 && (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-stone-500">
            Total de votre selection
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {selectedTotal.toFixed(2)}{' '}
            <span className="text-sm font-medium text-stone-500">EUR</span>
          </p>
          {selectedTotal > optimizedTotal && (
            <p className="mt-1 text-xs text-amber-600">
              +{(selectedTotal - optimizedTotal).toFixed(2)} EUR vs prix optimal
            </p>
          )}
        </div>
      )}

      {/* Per-supplier totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {supplierTotals.map((st) => (
          <div
            key={st.supplier_key}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500">
                  {st.supplier_name}
                </p>
                <p className="mt-1 text-lg font-bold text-stone-900">
                  {st.total_cost.toFixed(2)} EUR
                </p>
                <p className="text-xs text-stone-400">
                  {st.items_available}/{st.items_total} articles
                </p>
              </div>
              <button
                type="button"
                onClick={() => onQuickSelect(st.supplier_key)}
                className="mt-1 rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Tout ici
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
