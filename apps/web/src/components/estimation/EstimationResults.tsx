'use client';

import { useMemo, useState } from 'react';
import type { EstimationLineItem } from '@/lib/estimation-types';
import { formatPurchase, isMixedPackaging } from '@/lib/packaging';
import { WorkTypeSection } from './WorkTypeSection';

interface EstimationResultsProps {
  items: EstimationLineItem[];
}

function formatQty(qty: number, unit: string): string {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unit}`;
}

interface WorkTypeGroup {
  label: string;
  code: string;
  grossSurface: number;
  netSurface: number;
  excludedSurface: number;
  items: EstimationLineItem[];
}

export function EstimationResults({ items }: EstimationResultsProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, WorkTypeGroup>();
    for (const item of items) {
      const existing = map.get(item.work_type_code);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.work_type_code, {
          label: item.work_type_label,
          code: item.work_type_code,
          grossSurface: item.gross_surface_m2 ?? item.surface_m2,
          netSurface: item.surface_m2,
          excludedSurface: item.excluded_surface_m2 ?? 0,
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(grouped.map((g) => g.code)),
  );
  const [openDetails, setOpenDetails] = useState<Set<string>>(
    () => new Set(),
  );

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-stone-400">
        Aucun matériau à estimer.
      </p>
    );
  }

  function toggleSection(code: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  function toggleDetail(key: string) {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <WorkTypeSection
          key={group.code}
          code={group.code}
          label={group.label}
          grossSurface={group.grossSurface}
          netSurface={group.netSurface}
          excludedSurface={group.excludedSurface}
          itemCount={group.items.length}
          isOpen={openSections.has(group.code)}
          onToggle={() => toggleSection(group.code)}
        >
          <div className="space-y-3">
            {group.items.map((item, idx) => {
              const detailKey = `${item.material_id}-${idx}`;
              const isDetailOpen = openDetails.has(detailKey);
              const excludedSurface = item.excluded_surface_m2 ?? 0;
              const grossSurface = item.gross_surface_m2 ?? item.surface_m2;
              const totalBoughtQty =
                item.units_needed * item.packaging_qty_per_unit;
              const surplusQty = Math.max(
                0,
                totalBoughtQty - item.adjusted_qty,
              );
              const hasRange =
                item.units_needed_low != null &&
                item.units_needed_high != null &&
                item.units_needed_low !== item.units_needed_high;
              const isMixed = isMixedPackaging(item.packaging_breakdown);

              return (
                <div
                  key={detailKey}
                  className="rounded-2xl border border-stone-200 bg-white px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {item.material_name}
                      </p>
                      {hasRange && (
                        <p className="mt-0.5 text-xs text-stone-400">
                          Fourchette selon la mesure : {item.units_needed_low}–
                          {item.units_needed_high}{' '}
                          {isMixed ? 'contenants' : item.packaging_label}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-stone-900">
                        {formatPurchase(
                          item.units_needed,
                          item.packaging_label,
                          item.packaging_breakdown,
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleDetail(detailKey)}
                    aria-expanded={isDetailOpen}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
                  >
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200"
                      style={{
                        transform: isDetailOpen
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }}
                    >
                      ▸
                    </span>
                    Détail du calcul
                  </button>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isDetailOpen ? '1fr' : '0fr',
                      transition: 'grid-template-rows 200ms ease',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <ol className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-xs text-stone-500">
                        <li>Surface brute : {grossSurface} m²</li>
                        {excludedSurface > 0 && (
                          <li>
                            Surfaces exclues (saisies) : -{excludedSurface} m²
                          </li>
                        )}
                        <li>Surface nette : {item.surface_m2} m²</li>
                        {item.number_of_coats && (
                          <li>Nombre de couches : {item.number_of_coats}</li>
                        )}
                        <li className="flex items-center gap-1">
                          Perte : {item.waste_factor_percent}% · Pose{' '}
                          {item.pose_type}
                          {item.waste_factor_source === 'default' && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              générique
                            </span>
                          )}
                          {item.waste_factor_source === 'learned' && (
                            <span
                              className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                              title="Ajusté sur les achats réels de chantiers terminés"
                            >
                              appris
                            </span>
                          )}
                        </li>
                        <li>
                          Quantité théorique :{' '}
                          {formatQty(item.theoretical_qty, item.material_unit)}
                        </li>
                        <li>
                          Quantité ajustée (après perte) :{' '}
                          {formatQty(item.adjusted_qty, item.material_unit)}
                        </li>
                        <li>
                          Conditionnement retenu :{' '}
                          {formatPurchase(
                            item.units_needed,
                            item.packaging_label,
                            item.packaging_breakdown,
                          )}{' '}
                          — {formatQty(totalBoughtQty, item.material_unit)}{' '}
                          achetés pour{' '}
                          {formatQty(item.adjusted_qty, item.material_unit)}{' '}
                          nécessaires (surplus :{' '}
                          {formatQty(surplusQty, item.material_unit)})
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </WorkTypeSection>
      ))}
    </div>
  );
}
