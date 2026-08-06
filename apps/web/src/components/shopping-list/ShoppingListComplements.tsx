'use client';

import { useState } from 'react';
import type { ShoppingListComplementaryItem } from '@/lib/shopping-list-types';
import { costedQuantity } from '@/lib/shopping-list-types';
import type { KnownPrice } from '@/lib/known-prices';
import { formatKnownPrice } from '@/lib/known-prices';
import { DecimalInput } from '@/components/ui';

interface ShoppingListComplementsProps {
  items: ShoppingListComplementaryItem[];
  readOnly?: boolean;
  budgetAllowed?: boolean;
  // E4-4 : dernier prix relevé par l'entreprise, indexé par complementary_material_id.
  knownPrices?: Map<string, KnownPrice>;
  onUpdateQuantity?: (complementaryMaterialId: string, quantity: number) => void;
  onRemove?: (complementaryMaterialId: string) => void;
  onRestore?: (complementaryMaterialId: string) => void;
  onUpdatePrice?: (complementaryMaterialId: string, price: number, storeName: string) => void;
  onShowPaywall?: () => void;
}

function ComplementRow({
  item,
  readOnly,
  budgetAllowed,
  knownPrice,
  onUpdateQuantity,
  onRemove,
  onUpdatePrice,
  onShowPaywall,
}: {
  item: ShoppingListComplementaryItem;
  readOnly?: boolean;
  budgetAllowed?: boolean;
  knownPrice?: KnownPrice;
  onUpdateQuantity?: (qty: number) => void;
  onRemove?: () => void;
  onUpdatePrice?: (price: number, storeName: string) => void;
  onShowPaywall?: () => void;
}) {
  const [localQty, setLocalQty] = useState(item.quantity);
  const [showPriceFields, setShowPriceFields] = useState(false);

  // E4-4 : cf. `ShoppingListMaterials` — prix et magasin dérivés de la ligne,
  // brouillon local le temps de la frappe seulement, pour que le rappel des
  // prix soit visible dans le champ.
  const [draftPrice, setDraftPrice] = useState<string | null>(null);
  const [draftStore, setDraftStore] = useState<string | null>(null);
  const localPrice =
    draftPrice ??
    (item.real_unit_price != null ? String(item.real_unit_price) : '');
  const localStore = draftStore ?? item.store_name ?? '';

  const handleBlur = () => {
    const val = Math.max(0, Math.round(localQty));
    setLocalQty(val);
    if (val !== item.quantity && onUpdateQuantity) {
      onUpdateQuantity(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const commitPrice = () => {
    const price = parseFloat(localPrice);
    if (!isNaN(price) && price >= 0 && onUpdatePrice) {
      onUpdatePrice(price, localStore);
    }
  };

  const handlePriceBlur = () => {
    commitPrice();
    setDraftPrice(null);
  };

  const handleStoreBlur = () => {
    commitPrice();
    setDraftStore(null);
  };

  const handlePriceToggle = () => {
    if (budgetAllowed === false) {
      onShowPaywall?.();
      return;
    }
    setShowPriceFields(!showPriceFields);
  };

  const hasPriceSet = item.real_unit_price != null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-stone-900">
            {item.name}
            {item.is_calculated && (
              <span className="ml-2 text-xs font-normal text-stone-400">
                (estimé)
              </span>
            )}
            {hasPriceSet && (
              <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </p>
          {item.description_fr && (
            <p className="mt-0.5 text-sm text-stone-500">{item.description_fr}</p>
          )}
          {/* E4-4 : cf. `ShoppingListMaterials` — le rappel se montre avant de s'appliquer. */}
          {!hasPriceSet && knownPrice && !readOnly && (
            <p className="mt-1 text-xs text-stone-500">
              {formatKnownPrice(knownPrice)}
            </p>
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
              title={budgetAllowed === false ? 'Fonctionnalité Pro' : 'Saisir le prix réel'}
              aria-label="Saisir le prix réel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                {budgetAllowed === false ? (
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                ) : (
                  <path d="M6.375 5.5h.875v-1h-.875a.625.625 0 1 0 0 1.25ZM8.75 6.5H7.25v1h1.5a.625.625 0 1 1 0 1.25h-.875v1h.875a1.625 1.625 0 0 0 .38-3.205A1.625 1.625 0 0 0 6.375 4.5h.875v-1h1.5v-1h-1.5V1.75a.75.75 0 0 0-1.5 0v.75h-1.5v1h1.5v1h-.875a1.625 1.625 0 0 0-.38 3.205A1.625 1.625 0 0 0 8.75 9.75h-.875v1H6.25v1h1.625v.5a.75.75 0 0 0 1.5 0v-.5H11v-1H9.375v-1h-.625a.625.625 0 0 1 0-1.25Z" />
                )}
              </svg>
            </button>
          )}
          {readOnly ? (
            <span className="w-16 text-center text-sm font-semibold text-stone-900">
              {item.quantity}
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
              aria-label={`Quantité pour ${item.name}`}
            />
          )}
          <span className="text-sm text-stone-500">{item.unit_label}</span>
          {!readOnly && (
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
          )}
        </div>
      </div>

      {showPriceFields && !readOnly && (
        <div className="border-t border-stone-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor={`cprice-${item.complementary_material_id}`} className="text-xs text-stone-500">
                Prix unitaire
              </label>
              <div className="relative">
                {/* Même champ que les matériaux (PRO-5) : `type="number"`
                    rejetait la virgule du clavier français, et « 3,5 » se
                    transformait en chaîne vide sans le moindre signal. */}
                <DecimalInput
                  id={`cprice-${item.complementary_material_id}`}
                  value={localPrice}
                  onValueChange={setDraftPrice}
                  onBlur={handlePriceBlur}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  placeholder="0,00"
                  className="min-h-11 w-24 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 pr-7 text-right text-base text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none sm:text-sm"
                  aria-label={`Prix unitaire pour ${item.name}`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                  EUR
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor={`cstore-${item.complementary_material_id}`} className="text-xs text-stone-500">
                Magasin
              </label>
              <input
                id={`cstore-${item.complementary_material_id}`}
                type="text"
                value={localStore}
                onChange={(e) => setDraftStore(e.target.value)}
                onBlur={handleStoreBlur}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Leroy Merlin"
                maxLength={100}
                className="w-40 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none"
                aria-label={`Magasin pour ${item.name}`}
              />
            </div>
            {hasPriceSet && (
              <span className="text-xs text-stone-400">
                Total : {((item.real_unit_price ?? 0) * costedQuantity(item)).toFixed(2)} EUR
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShoppingListComplements({
  items,
  readOnly,
  budgetAllowed,
  knownPrices,
  onUpdateQuantity,
  onRemove,
  onRestore,
  onUpdatePrice,
  onShowPaywall,
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
        Accessoires recommandés
      </h2>

      {activeItems.length === 0 ? (
        <p className="py-4 text-sm text-stone-400">
          Tous les accessoires ont été retirés.
        </p>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <ComplementRow
              key={item.complementary_material_id}
              item={item}
              readOnly={readOnly}
              budgetAllowed={budgetAllowed}
              knownPrice={knownPrices?.get(item.complementary_material_id)}
              onUpdateQuantity={onUpdateQuantity ? (qty) =>
                onUpdateQuantity(item.complementary_material_id, qty)
              : undefined}
              onRemove={onRemove ? () => onRemove(item.complementary_material_id) : undefined}
              onUpdatePrice={onUpdatePrice ? (price, storeName) =>
                onUpdatePrice(item.complementary_material_id, price, storeName)
              : undefined}
              onShowPaywall={onShowPaywall}
            />
          ))}
        </div>
      )}

      {!readOnly && removedItems.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRemoved(!showRemoved)}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            {showRemoved ? 'Masquer' : 'Voir'} les articles retirés (
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
                    onClick={() => onRestore?.(item.complementary_material_id)}
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
