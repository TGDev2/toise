'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { ClientSelect } from '@/components/quotes/ClientSelect';
import { LaborLinesEditor } from '@/components/quotes/LaborLinesEditor';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { Alert, DecimalInput, Skeleton, StickyActionBar } from '@/components/ui';
import type { EstimationResponse } from '@/lib/estimation-types';
import type {
  Client,
  Quote,
  QuoteLaborLineInput,
  CreateQuotePayload,
} from '@/lib/quote-types';
import type { ShoppingListResponse } from '@/lib/shopping-list-types';

function formatPrice(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

// `text-base` sous `sm:` : sept champs à 14 px, c'était sept zooms iOS à
// annuler à la main pendant qu'on chiffre devant le client.
const NUMBER_FIELD =
  'w-full min-h-12 rounded-2xl border border-stone-300 px-4 py-3 text-base sm:text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

export default function NewQuotePage() {
  const { appUser, isLoading } = useAuth();
  const {
    isFeatureAllowed,
    showPaywall,
    isLoading: gatesLoading,
  } = useFeatureGates();
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
  const [laborLines, setLaborLines] = useState<QuoteLaborLineInput[]>([]);
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
    // `isFeatureAllowed` est fail-closed *pendant* le chargement des gates :
    // sans ce garde, tout arrivant sur l'étape « Devis » voyait le paywall
    // s'ouvrir puis se refermer — y compris un Contractor qui y a droit.
    if (gatesLoading) return;
    if (!isFeatureAllowed('export_devis')) {
      showPaywall('export_devis');
      return;
    }
  }, [appUser, isLoading, gatesLoading, isFeatureAllowed, showPaywall, router]);

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

      // La proposition dépend de l'estimation (elle en dérive les ouvrages) :
      // ne peut être demandée en même temps que les trois appels ci-dessus.
      const proposal = await apiGet<QuoteLaborLineInput[]>(
        `/quotes/labor-proposal?project_id=${projectId}&estimation_id=${est.id}`,
      );
      setLaborLines(proposal);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, 'Impossible de charger les données du projet'),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // La gate `export_devis` ouvrait le paywall mais laissait le rendu et le
  // `fetchData()` se poursuivre : le formulaire complet s'affichait derrière la
  // modale, et se retrouvait utilisable dès sa fermeture jusqu'au 403 serveur.
  const quotingAllowed = !gatesLoading && isFeatureAllowed('export_devis');

  useEffect(() => {
    if (appUser && quotingAllowed) fetchData();
  }, [appUser, quotingAllowed, fetchData]);

  // Live totals
  const pricedItems = useMemo(() => {
    if (!shoppingList) return [];
    return shoppingList.material_items.filter(
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
    return laborLines.reduce(
      (sum, line) =>
        sum + (line.kind === 'flat' ? 1 : line.quantity) * line.unit_price_ht,
      0,
    );
  }, [laborLines]);

  const totalHt = (subtotalMaterials + subtotalLabor) * (1 - discount / 100);
  const totalTtc = totalHt * (1 + tva / 100);

  // Une ligne à 0 EUR est incomplète, pas gratuite : forcer sa saisie avant
  // l'envoi plutôt que produire un devis qui offre la MO sans le vouloir.
  const laborRateMissing = laborLines.some((line) => line.unit_price_ht <= 0);

  /*
    E4-4 — le taux horaire pré-remplit déjà chaque ligne depuis le profil
    entreprise (`quotes.service.ts`), mais `default_labor_hourly_rate` est
    nullable et jamais seedé. Un artisan qui n'est jamais allé dans ses
    réglages voyait donc toutes ses lignes à zéro, « Créer le devis »
    désactivé, et aucun écran ne lui disait où régler ça : 5,2 s par ligne à
    ressaisir, à chaque devis, indéfiniment.

    Une saisie, un tap, et le problème est fermé pour tous les devis suivants.
    Seules les lignes horaires sont concernées : sur un forfait,
    `unit_price_ht` est un montant, pas un taux.
  */
  const hourlyRateMissing = laborLines.some(
    (line) => line.kind === 'hourly' && line.unit_price_ht <= 0,
  );
  const [bulkRate, setBulkRate] = useState('');
  const [rememberRate, setRememberRate] = useState(true);
  const bulkRateValue = parseFloat(bulkRate);
  const bulkRateUsable = Number.isFinite(bulkRateValue) && bulkRateValue > 0;

  const applyBulkRate = async () => {
    if (!bulkRateUsable) return;
    setLaborLines((prev) =>
      prev.map((line) =>
        line.kind === 'hourly'
          ? { ...line, unit_price_ht: bulkRateValue }
          : line,
      ),
    );
    if (!rememberRate) return;
    try {
      await apiPut('/company-profiles/me', {
        default_labor_hourly_rate: bulkRateValue,
      });
    } catch {
      // Le devis courant est déjà servi : un échec d'enregistrement du profil
      // ne doit pas se lire comme un échec du taux qui vient d'être appliqué.
    }
  };

  const addLaborLine = () =>
    setLaborLines((prev) => [
      ...prev,
      {
        work_item_id: null,
        work_type_code: null,
        label: '',
        room_name: null,
        kind: 'hourly',
        surface_m2: null,
        quantity: 0,
        unit_price_ht: 0,
      },
    ]);

  const updateLaborLine = (index: number, line: (typeof laborLines)[number]) =>
    setLaborLines((prev) => prev.map((l, i) => (i === index ? line : l)));

  const removeLaborLine = (index: number) =>
    setLaborLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimation || !shoppingList || laborRateMissing) return;

    setSubmitting(true);
    setError('');
    try {
      const payload: CreateQuotePayload = {
        project_id: projectId,
        estimation_id: estimation.id,
        labor_items: laborLines,
        material_margin_percent: margin,
        discount_percent: discount,
        tva_rate: tva,
        validity_days: parseInt(validityDays) || 30,
        payment_terms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (clientId) payload.client_id = clientId;

      const created = await apiPost<Quote>('/quotes', payload);
      router.push(`/quotes/${created.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de créer le devis'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || gatesLoading || (quotingAllowed && loading)) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
      </main>
    );
  }

  if (!quotingAllowed) {
    // Le paywall est déjà ouvert par l'effet ci-dessus ; on ne rend rien
    // derrière lui plutôt qu'un formulaire que l'API refuserait. Pas de
    // `FlowProgress` non plus : cette étape n'est pas atteignable par ce
    // palier, elle ne doit pas apparaître dans le fil de progression.
    return <main className="mx-auto w-full max-w-4xl px-4 py-8" />;
  }

  if (error && !estimation) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Alert variant="error">{error}</Alert>
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
      <FlowProgress step="quote" projectId={projectId} />

      {/* Header */}
      <div className="rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <h1 className="text-2xl font-semibold text-stone-950 sm:text-3xl">
          Générer un devis
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {pricedItems.length} matériau(x) avec prix renseigne(s)
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
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
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Marge (%)
              </span>
              <DecimalInput
                value={marginPercent}
                onValueChange={setMarginPercent}
                className={NUMBER_FIELD}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Remise (%)
              </span>
              <DecimalInput
                value={discountPercent}
                onValueChange={setDiscountPercent}
                className={NUMBER_FIELD}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                TVA (%)
              </span>
              <DecimalInput
                value={tvaRate}
                onValueChange={setTvaRate}
                className={NUMBER_FIELD}
              />
            </label>
          </div>
        </section>

        {/* Labor */}
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Main d&apos;oeuvre
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Une ligne par ouvrage, proposée à partir des surfaces du projet —
            ajustez librement les heures et le taux.
          </p>

          {hourlyRateMissing && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Votre taux horaire n&apos;est pas renseigné
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Saisissez-le une fois : il s&apos;applique à toutes les lignes
                de ce devis, et pré-remplira les suivants.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-amber-900">
                    Taux horaire (EUR/h)
                  </span>
                  <DecimalInput
                    value={bulkRate}
                    onValueChange={setBulkRate}
                    placeholder="ex. 45"
                    aria-label="Taux horaire de l'entreprise"
                    className="min-h-11 w-28 rounded-xl border border-amber-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-amber-500 focus:outline-none sm:text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyBulkRate}
                  disabled={!bulkRateUsable}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Appliquer à toutes les lignes
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={rememberRate}
                  onChange={(e) => setRememberRate(e.target.checked)}
                  className="accent-amber-600"
                />
                Enregistrer comme taux par défaut de mon entreprise
              </label>
            </div>
          )}

          <div className="mt-4">
            <LaborLinesEditor
              lines={laborLines}
              onAdd={addLaborLine}
              onUpdate={updateLaborLine}
              onRemove={removeLaborLine}
            />
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
                inputMode="numeric"
                min="1"
                max="365"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className={NUMBER_FIELD}
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
              className={NUMBER_FIELD}
            />
          </label>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-stone-700">Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={NUMBER_FIELD}
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

        {/*
          Le total TTC vivait dans le récapitulatif, ~600 px sous le champ de
          marge : ajuster une marge devant le client obligeait à descendre pour
          lire l'effet, puis à remonter. C'est la boucle qui coûtait le plus de
          temps sur cet écran. Il suit désormais le CTA dans la barre collante.
        */}
        <StickyActionBar
          summary={
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-stone-600">Total TTC</span>
              <span className="text-lg font-bold text-stone-950">
                {formatPrice(totalTtc)} EUR
              </span>
            </div>
          }
        >
          <button
            type="submit"
            disabled={submitting || pricedItems.length === 0 || laborRateMissing}
            title={
              laborRateMissing
                ? "Renseignez le taux de chaque ligne de main-d'œuvre"
                : undefined
            }
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creation...' : 'Créer le devis'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 hover:bg-white"
          >
            Annuler
          </button>
        </StickyActionBar>
      </form>
    </main>
  );
}
