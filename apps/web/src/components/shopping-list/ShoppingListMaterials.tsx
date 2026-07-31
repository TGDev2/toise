'use client';

import { useMemo, useState } from 'react';
import type { ShoppingListMaterialItem } from '@/lib/shopping-list-types';
import type { BuyLinkItem } from '@/lib/price-comparison-types';

const CATEGORY_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet / Sol',
  partition: 'Cloison',
  wall_covering: 'Revetement mural',
};

interface ShoppingListMaterialsProps {
  items: ShoppingListMaterialItem[];
  readOnly?: boolean;
  budgetAllowed?: boolean;
  // BUY-3 : lien affilié par matériau, indépendant du tier (Free inclus).
  buyLinks?: Map<string, BuyLinkItem>;
  onUpdateQuantity?: (materialId: string, units: number) => void;
  onResetQuantity?: (materialId: string) => void;
  onUpdatePrice?: (
    materialId: string,
    price: number,
    storeName: string,
  ) => void;
  onShowPaywall?: () => void;
}

function MaterialRow({
  item,
  readOnly,
  budgetAllowed,
  buyLink,
  onUpdateQuantity,
  onResetQuantity,
  onUpdatePrice,
  onShowPaywall,
}: {
  item: ShoppingListMaterialItem;
  readOnly?: boolean;
  budgetAllowed?: boolean;
  buyLink?: BuyLinkItem;
  onUpdateQuantity?: (units: number) => void;
  onResetQuantity?: () => void;
  onUpdatePrice?: (price: number, storeName: string) => void;
  onShowPaywall?: () => void;
}) {
  const [localQty, setLocalQty] = useState(item.units_needed);
  const [showPriceFields, setShowPriceFields] = useState(false);
  const [localPrice, setLocalPrice] = useState<string>(
    item.real_unit_price != null ? String(item.real_unit_price) : '',
  );
  const [localStore, setLocalStore] = useState(item.store_name ?? '');

  const handleBlur = () => {
    const val = Math.max(0, Math.round(localQty));
    setLocalQty(val);
    if (val !== item.units_needed && onUpdateQuantity) {
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
    onResetQuantity?.();
  };

  const handlePriceBlur = () => {
    const price = parseFloat(localPrice);
    if (!isNaN(price) && price >= 0 && onUpdatePrice) {
      onUpdatePrice(price, localStore);
    }
  };

  const handleStoreBlur = () => {
    const price = parseFloat(localPrice);
    if (!isNaN(price) && price >= 0 && onUpdatePrice) {
      onUpdatePrice(price, localStore);
    }
  };

  const handlePriceToggle = () => {
    if (budgetAllowed === false) {
      onShowPaywall?.();
      return;
    }
    setShowPriceFields(!showPriceFields);
  };

  const hasPriceSet = item.real_unit_price != null;

  // CV-5 : fourchette basse/haute, masquée dès qu'une correction manuelle a
  // été appliquée (l'utilisateur a fixé une valeur exacte) ou quand elle est
  // de largeur nulle (rien à ajouter au chiffre affiché).
  const hasRange =
    !item.is_manually_adjusted &&
    item.units_needed_low != null &&
    item.units_needed_high != null &&
    item.units_needed_low !== item.units_needed_high;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-stone-900">{item.material_name}</p>
            {hasPriceSet && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            {item.work_type_label} · {item.packaging_label}
            {item.room_count && item.room_count > 1 ? (
              <span className="ml-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                mutualisé · {item.room_count} pièces
              </span>
            ) : null}
          </p>
          {hasRange && (
            <p className="mt-0.5 text-xs text-stone-400">
              Fourchette selon la mesure : {item.units_needed_low}–
              {item.units_needed_high} {item.packaging_label}
            </p>
          )}
          {buyLink && (
            <a
              href={buyLink.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              Acheter chez {buyLink.supplier_name}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v4A.75.75 0 0 0 4.25 11h4a.75.75 0 0 0 .75-.75V8a.75.75 0 0 1 1.5 0v2.25A2.25 2.25 0 0 1 8.25 12.5h-4A2.25 2.25 0 0 1 2 10.25v-4A2.25 2.25 0 0 1 4.25 4H6.5a.75.75 0 0 1 0 1.5H4.25ZM8.75 3a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0V4.81l-4.72 4.72a.75.75 0 1 1-1.06-1.06L10.69 3.75H9.5A.75.75 0 0 1 8.75 3Z" clipRule="evenodd" />
              </svg>
            </a>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={handlePriceToggle}
              className={`rounded-full p-1.5 transition-colors ${
                hasPriceSet
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : budgetAllowed === false
                    ? 'text-stone-300 hover:text-stone-400'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
              }`}
              title={budgetAllowed === false ? 'Fonctionnalité Pro' : 'Saisir le prix reel'}
              aria-label="Saisir le prix reel"
            >
              {budgetAllowed === false ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M6.375 5.5h.875v-1h-.875a.625.625 0 1 0 0 1.25ZM8.75 6.5H7.25v1h1.5a.625.625 0 1 1 0 1.25h-.875v1h.875a1.625 1.625 0 0 0 .38-3.205A1.625 1.625 0 0 0 6.375 4.5h.875v-1h1.5v-1h-1.5V1.75a.75.75 0 0 0-1.5 0v.75h-1.5v1h1.5v1h-.875a1.625 1.625 0 0 0-.38 3.205A1.625 1.625 0 0 0 8.75 9.75h-.875v1H6.25v1h1.625v.5a.75.75 0 0 0 1.5 0v-.5H11v-1H9.375v-1h-.625a.625.625 0 0 1 0-1.25Z" />
                </svg>
              )}
            </button>
          )}
          {!readOnly && item.is_manually_adjusted && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200"
              title="Reinitialiser la quantité"
            >
              Modifie
            </button>
          )}
          {readOnly ? (
            <span className="w-16 text-center text-sm font-semibold text-stone-900">
              {item.units_needed}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              value={localQty}
              onChange={(e) => setLocalQty(Number(e.target.value))}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-16 rounded-xl border border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-sm font-semibold text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
              aria-label={`Quantité pour ${item.material_name}`}
            />
          )}
          <span className="text-sm text-stone-500">
            x {item.packaging_label}
          </span>
        </div>
      </div>

      {showPriceFields && !readOnly && (
        <div className="border-t border-stone-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor={`price-${item.material_id}`} className="text-xs text-stone-500">
                Prix unitaire
              </label>
              <div className="relative">
                <input
                  id={`price-${item.material_id}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={localPrice}
                  onChange={(e) => setLocalPrice(e.target.value)}
                  onBlur={handlePriceBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="0.00"
                  className="w-24 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 pr-7 text-right text-sm text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
                  aria-label={`Prix unitaire pour ${item.material_name}`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                  EUR
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor={`store-${item.material_id}`} className="text-xs text-stone-500">
                Magasin
              </label>
              <input
                id={`store-${item.material_id}`}
                type="text"
                value={localStore}
                onChange={(e) => setLocalStore(e.target.value)}
                onBlur={handleStoreBlur}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Leroy Merlin"
                maxLength={100}
                className="w-40 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
                aria-label={`Magasin pour ${item.material_name}`}
              />
            </div>
            {hasPriceSet && (
              <span className="text-xs text-stone-400">
                Total : {((item.real_unit_price ?? 0) * item.units_needed).toFixed(2)} EUR
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShoppingListMaterials({
  items,
  readOnly,
  budgetAllowed,
  buyLinks,
  onUpdateQuantity,
  onResetQuantity,
  onUpdatePrice,
  onShowPaywall,
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
        Aucun matériau dans la liste.
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
                    key={item.material_id}
                    item={item}
                    readOnly={readOnly}
                    budgetAllowed={budgetAllowed}
                    buyLink={buyLinks?.get(item.material_id)}
                    onUpdateQuantity={onUpdateQuantity ? (units) =>
                      onUpdateQuantity(item.material_id, units)
                    : undefined}
                    onResetQuantity={onResetQuantity ? () =>
                      onResetQuantity(item.material_id)
                    : undefined}
                    onUpdatePrice={onUpdatePrice ? (price, storeName) =>
                      onUpdatePrice(item.material_id, price, storeName)
                    : undefined}
                    onShowPaywall={onShowPaywall}
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
