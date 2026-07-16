'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { ClientSelect } from '@/components/quotes/ClientSelect';
import type { EstimationResponse } from '@/lib/estimation-types';
import type {
  Client,
  Quote,
  LaborType,
  CreateQuotePayload,
} from '@/lib/quote-types';

interface ShoppingListMaterialItem {
  material_name: string;
  material_category: string;
  work_type_label: string;
  packaging_label: string;
  units_needed: number;
  real_unit_price?: number | null;
}

interface ShoppingListResponse {
  id: string;
  estimation_id: string;
  items_json: {
    material_items: ShoppingListMaterialItem[];
    complementary_items: unknown[];
  };
}

function formatPrice(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

export default function NewQuotePage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [estimation, setEstimation] = useState<EstimationResponse | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [clientId, setClientId] = useState('');
  const [laborType, setLaborType] = useState<LaborType>('hourly');
  const [hourlyRate, setHourlyRate] = useState('45');
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [flatAmount, setFlatAmount] = useState('500');
  const [marginPercent, setMarginPercent] = useState('20');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [tvaRate, setTvaRate] = useState('20');
  const [validityDays, setValidityDays] = useState('30');
  const [paymentTerms, setPaymentTerms] = useState(
    'Acompte de 30 % a la commande, solde a la reception des travaux.',
  );
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
    if (!isFeatureAllowed('export_devis')) {
      showPaywall('export_devis');
      return;
    }
  }, [appUser, isLoading, isFeatureAllowed, showPaywall, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [est, sl, cls] = await Promise.all([
        apiGet<EstimationResponse>(`/projects/${projectId}/estimates/latest`),
        apiGet<ShoppingListResponse>(`/projects/${projectId}/shopping-list`),
        apiGet<Client[]>('/clients'),
      ]);
      setEstimation(est);
      setShoppingList(sl);
      setClients(cls);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, 'Impossible de charger les données du projet'),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (appUser) fetchData();
  }, [appUser, fetchData]);

  // Live totals
  const pricedItems = useMemo(() => {
    if (!shoppingList) return [];
    return shoppingList.items_json.material_items.filter(
      (i) => i.real_unit_price != null && i.real_unit_price > 0,
    );
  }, [shoppingList]);

  const margin = parseFloat(marginPercent) || 0;
  const discount = parseFloat(discountPercent) || 0;
  const tva = parseFloat(tvaRate) || 20;

  const subtotalMaterials = useMemo(() => {
    return pricedItems.reduce((sum, item) => {
      const price = Number(item.real_unit_price) * (1 + margin / 100);
      return sum + price * item.units_needed;
    }, 0);
  }, [pricedItems, margin]);

  const subtotalLabor = useMemo(() => {
    if (laborType === 'flat') return parseFloat(flatAmount) || 0;
    return (parseFloat(hourlyRate) || 0) * (parseFloat(estimatedHours) || 0);
  }, [laborType, hourlyRate, estimatedHours, flatAmount]);

  const totalHt = (subtotalMaterials + subtotalLabor) * (1 - discount / 100);
  const totalTtc = totalHt * (1 + tva / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimation || !shoppingList) return;

    setSubmitting(true);
    setError('');
    try {
      const payload: CreateQuotePayload = {
        project_id: projectId,
        estimation_id: estimation.id,
        labor_type: laborType,
        material_margin_percent: margin,
        discount_percent: discount,
        tva_rate: tva,
        validity_days: parseInt(validityDays) || 30,
        payment_terms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (clientId) payload.client_id = clientId;
      if (laborType === 'hourly') {
        payload.labor_hourly_rate = parseFloat(hourlyRate) || 0;
        payload.labor_estimated_hours = parseFloat(estimatedHours) || 0;
      } else {
        payload.labor_flat_amount = parseFloat(flatAmount) || 0;
      }

      const created = await apiPost<Quote>('/quotes', payload);
      router.push(`/quotes/${created.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de créer le devis'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  if (error && !estimation) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-white"
        >
          Retour
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          Nouveau devis
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Générer un devis
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {pricedItems.length} matériau(x) avec prix renseigne(s)
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {pricedItems.length === 0 && (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Aucun matériau n&apos;a de prix renseigne dans la liste de courses.
          Renseignez les prix avant de créer un devis.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Client */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Client</h2>
          <div className="mt-4">
            <ClientSelect
              clients={clients}
              selectedId={clientId}
              onChange={setClientId}
              onClientCreated={(c) => setClients((prev) => [c, ...prev])}
            />
          </div>
        </section>

        {/* Margin */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Marge matériaux
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Marge (%)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Remise (%)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                TVA (%)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={tvaRate}
                onChange={(e) => setTvaRate(e.target.value)}
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
          </div>
        </section>

        {/* Labor */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Main d&apos;oeuvre
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setLaborType('hourly')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  laborType === 'hourly'
                    ? 'bg-stone-950 text-white'
                    : 'border border-stone-300 text-stone-700 hover:bg-white'
                }`}
              >
                Taux horaire
              </button>
              <button
                type="button"
                onClick={() => setLaborType('flat')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  laborType === 'flat'
                    ? 'bg-stone-950 text-white'
                    : 'border border-stone-300 text-stone-700 hover:bg-white'
                }`}
              >
                Forfait
              </button>
            </div>

            {laborType === 'hourly' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-700">
                    Taux horaire (EUR/h)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-700">
                    Heures estimées
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </label>
              </div>
            ) : (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Montant forfaitaire (EUR)
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(e.target.value)}
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            )}
          </div>
        </section>

        {/* Conditions */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Conditions</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Validite (jours)
              </span>
              <input
                type="number"
                min="1"
                max="365"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-stone-700">
              Conditions de règlement
            </span>
            <textarea
              rows={3}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-stone-700">Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
        </section>

        {/* Live totals */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Recapitulatif
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Sous-total matériaux HT</span>
              <span className="font-medium">
                {formatPrice(subtotalMaterials)} EUR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">
                Sous-total main d&apos;oeuvre HT
              </span>
              <span className="font-medium">
                {formatPrice(subtotalLabor)} EUR
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Remise ({discount} %)</span>
                <span>
                  -{formatPrice((subtotalMaterials + subtotalLabor) * (discount / 100))} EUR
                </span>
              </div>
            )}
            <div className="border-t border-stone-200 pt-2 flex justify-between font-semibold">
              <span>Total HT</span>
              <span>{formatPrice(totalHt)} EUR</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>TVA ({tva} %)</span>
              <span>{formatPrice(totalTtc - totalHt)} EUR</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between text-lg font-bold text-stone-950">
              <span>Total TTC</span>
              <span>{formatPrice(totalTtc)} EUR</span>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || pricedItems.length === 0}
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creation...' : 'Créer le devis'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Annuler
          </button>
        </div>
      </form>
    </main>
  );
}
