'use client';

import { useCallback, useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  PriceComparisonResponse,
  ItemSupplierSelection,
} from '@/lib/price-comparison-types';
import { PriceComparisonTable } from './PriceComparisonTable';
import { SupplierTotalsSummary } from './SupplierTotalsSummary';

interface PriceComparisonPanelProps {
  projectId: string;
  data: PriceComparisonResponse;
  onApplied: () => void;
  onClose: () => void;
}

export function PriceComparisonPanel({
  projectId,
  data,
  onApplied,
  onClose,
}: PriceComparisonPanelProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  // Track supplier selection per item (key = "material_id:work_item_id")
  const [selections, setSelections] = useState<Map<string, string>>(() => {
    const initial = new Map<string, string>();
    for (const item of data.items) {
      if (item.best_supplier_key) {
        initial.set(
          `${item.material_id}:${item.work_item_id}`,
          item.best_supplier_key,
        );
      }
    }
    return initial;
  });

  // Derive unique supplier keys and names
  const { supplierKeys, supplierNames } = useMemo(() => {
    const keys: string[] = [];
    const names: Record<string, string> = {};
    for (const st of data.supplier_totals) {
      keys.push(st.supplier_key);
      names[st.supplier_key] = st.supplier_name;
    }
    return { supplierKeys: keys, supplierNames: names };
  }, [data.supplier_totals]);

  // Compute the total for the current selection
  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const item of data.items) {
      const key = `${item.material_id}:${item.work_item_id}`;
      const selectedSupplier = selections.get(key);
      if (selectedSupplier) {
        const price = item.prices.find(
          (p) => p.supplier_key === selectedSupplier,
        );
        if (price && price.availability !== 'not_found') {
          total += price.unit_price * item.units_needed;
        }
      }
    }
    return +total.toFixed(2);
  }, [data.items, selections]);

  const handleSelect = useCallback((sel: ItemSupplierSelection) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(`${sel.material_id}:${sel.work_item_id}`, sel.supplier_key);
      return next;
    });
  }, []);

  const handleQuickSelect = useCallback(
    (supplierKey: string | null) => {
      setSelections(() => {
        const next = new Map<string, string>();
        for (const item of data.items) {
          const key = `${item.material_id}:${item.work_item_id}`;
          if (supplierKey === null) {
            // Optimal: select best per item
            if (item.best_supplier_key) {
              next.set(key, item.best_supplier_key);
            }
          } else {
            // Select this supplier if available
            const price = item.prices.find(
              (p) =>
                p.supplier_key === supplierKey &&
                p.availability !== 'not_found',
            );
            if (price) {
              next.set(key, supplierKey);
            } else if (item.best_supplier_key) {
              // Fallback to best if this supplier unavailable
              next.set(key, item.best_supplier_key);
            }
          }
        }
        return next;
      });
    },
    [data.items],
  );

  const handleApply = useCallback(async () => {
    const selectionsList: ItemSupplierSelection[] = [];
    for (const item of data.items) {
      const key = `${item.material_id}:${item.work_item_id}`;
      const supplierKey = selections.get(key);
      if (supplierKey) {
        selectionsList.push({
          material_id: item.material_id,
          work_item_id: item.work_item_id,
          supplier_key: supplierKey,
        });
      }
    }

    if (selectionsList.length === 0) return;

    setApplying(true);
    setError('');
    try {
      await apiPost(
        `/projects/${projectId}/shopping-list/compare-prices/apply`,
        { selections: selectionsList },
      );
      onApplied();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible d\'appliquer la selection'));
    } finally {
      setApplying(false);
    }
  }, [data.items, selections, projectId, onApplied]);

  return (
    <section className="mb-6 rounded-[2rem] border border-emerald-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          Comparateur de prix
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-50"
        >
          Fermer
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SupplierTotalsSummary
        supplierTotals={data.supplier_totals}
        optimizedTotal={data.optimized_total}
        selectedTotal={selectedTotal}
        onQuickSelect={handleQuickSelect}
      />

      <div className="mt-6">
        <PriceComparisonTable
          items={data.items}
          supplierKeys={supplierKeys}
          supplierNames={supplierNames}
          selections={selections}
          onSelect={handleSelect}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-stone-400">
          Prix mis en cache jusqu&apos;au{' '}
          {new Date(data.cache_expires_at).toLocaleString('fr-FR')}
        </p>
        <button
          type="button"
          onClick={handleApply}
          disabled={applying || selections.size === 0}
          className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {applying ? 'Application...' : 'Appliquer la selection'}
        </button>
      </div>
    </section>
  );
}
