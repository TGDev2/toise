'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPatch, apiPost, apiDownload } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { ShoppingListResponse, BudgetSummary } from '@/lib/shopping-list-types';
import type {
  PriceComparisonResponse,
  BuyLinkItem,
  BuyLinksResponse,
} from '@/lib/price-comparison-types';
import type { KnownPrice, KnownPricesResponse } from '@/lib/known-prices';
import { indexKnownPrices } from '@/lib/known-prices';
import { ShoppingListMaterials } from '@/components/shopping-list/ShoppingListMaterials';
import { ShoppingListComplements } from '@/components/shopping-list/ShoppingListComplements';
import { ShareLinkPanel } from '@/components/shopping-list/ShareLinkPanel';
import { GuestPromptModal } from '@/components/auth/GuestPromptModal';
import { BudgetDashboard } from '@/components/shopping-list/BudgetDashboard';
import { PriceComparisonPanel } from '@/components/shopping-list/PriceComparisonPanel';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { Alert, ConfirmDialog, Skeleton, StickyActionBar } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function ShoppingListPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const budgetAllowed = isFeatureAllowed('budget_tracking');
  const priceComparisonAllowed = isFeatureAllowed('price_comparison');
  const canQuote = isFeatureAllowed('export_devis');
  /*
    Le panneau « matériaux éco » vivait ici : filtre, badge, suggestion
    d'équivalence, et un paywall sur `eco_materials`. La gate est gelée
    (`is_enabled = false`, migration 065) — refusée à tous les paliers — et
    l'argument vise le particulier, hors de la cible artisan (ADR 0001 D3,
    §3.1). Le clic ne menait donc qu'à « Fonctionnalité indisponible ».
    Retiré en E4-3 ; le catalogue d'équivalences reste en base.
  */
  // DATA-5 : gate `free`. La clôture alimente DATA-3, DATA-4, COM-1 et PLAT-1 ;
  // la réserver aux abonnés reviendrait à n'apprendre que d'eux.
  const closeoutAllowed = isFeatureAllowed('project_closeout');

  const [data, setData] = useState<ShoppingListResponse | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  /** Action réservée aux comptes inscrits qu'un invité vient de tenter (E2-1). */
  const [pendingGuestAction, setPendingGuestAction] = useState<
    'pdf' | 'share' | null
  >(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [knownPrices, setKnownPrices] = useState<KnownPricesResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState<PriceComparisonResponse | null>(null);
  const [buyLinks, setBuyLinks] = useState<Map<string, BuyLinkItem>>(new Map());
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  // Même filtre que `QuotesService.create` : seules les lignes réellement
  // chiffrées entrent dans le devis.
  const pricedCount =
    data?.material_items.filter(
      (i) => i.real_unit_price != null && i.real_unit_price > 0,
    ).length ?? 0;

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<{
    material_items?: { material_id: string; units_needed: number; real_unit_price?: number; store_name?: string }[];
    complementary_items?: { complementary_material_id: string; quantity?: number; is_removed?: boolean; real_unit_price?: number; store_name?: string }[];
  }>({});

  const hasPriceUpdatesRef = useRef(false);

  const loadBudgetSummary = useCallback(async () => {
    if (!budgetAllowed) return;
    try {
      const summary = await apiGet<BudgetSummary>(
        `/projects/${projectId}/shopping-list/budget-summary`,
      );
      setBudgetSummary(summary);
    } catch {
      // Budget summary may not exist yet if no prices entered
    }
  }, [budgetAllowed, projectId]);

  const loadKnownPrices = useCallback(async () => {
    if (!budgetAllowed) return;
    try {
      const result = await apiGet<KnownPricesResponse>(
        `/projects/${projectId}/shopping-list/known-prices`,
      );
      setKnownPrices(result);
    } catch {
      // Rappel de prix optionnel : un échec laisse la saisie manuelle intacte.
    }
  }, [budgetAllowed, projectId]);

  const flushUpdates = useCallback(async () => {
    const updates = pendingUpdatesRef.current;
    if (!updates.material_items?.length && !updates.complementary_items?.length) {
      return;
    }

    const hadPriceUpdates = hasPriceUpdatesRef.current;
    pendingUpdatesRef.current = {};
    hasPriceUpdatesRef.current = false;
    setSaving(true);
    try {
      const result = await apiPatch<ShoppingListResponse>(
        `/projects/${projectId}/shopping-list`,
        updates,
      );
      setData(result);
      if (hadPriceUpdates) {
        await loadBudgetSummary();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de sauvegarder'));
    } finally {
      setSaving(false);
    }
  }, [projectId, loadBudgetSummary]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(flushUpdates, 300);
  }, [flushUpdates]);

  /**
   * Vide les saisies en attente **avant** de quitter l'étape (E4-4, § 8.1 de
   * `docs/AUDIT_PARCOURS_10MIN.md`).
   *
   * Le débounce de 300 ms est réarmé à chaque saisie : sur mobile, le tap sur
   * « Générer le devis » est aussi ce qui fait perdre le focus au champ de prix,
   * donc la programmation du `PATCH` et la navigation sont le même geste. Et
   * `QuotesService.create` ne retient que les lignes portant un prix réel : le
   * matériau disparaissait du devis sans un mot. Reproduit deux fois par le
   * chronométrage avant correction.
   */
  const flushNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await flushUpdates();
  }, [flushUpdates]);

  useEffect(() => {
    if (isLoading) return;
    // Même garde que `dimensions` et `work-selection` (E2-1) — cf. le
    // commentaire de `estimate/page.tsx`. La liste d'achat est le terminus du
    // parcours invité : c'est ce qu'il est venu chercher.
    if (!appUser && !isGuest) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const [project, shoppingList, buyLinksRes] = await Promise.all([
          apiGet<{ name: string }>(`/projects/${projectId}`),
          apiGet<ShoppingListResponse>(`/projects/${projectId}/shopping-list`),
          // BUY-3 : disponible à tous les tiers ; un échec ne doit jamais
          // bloquer l'affichage de la liste (fonctionnalité secondaire).
          apiGet<BuyLinksResponse>(
            `/projects/${projectId}/shopping-list/buy-links`,
          ).catch(() => ({ links: [] })),
        ]);
        setProjectName(project.name);
        setData(shoppingList);
        setBuyLinks(new Map(buyLinksRes.links.map((l) => [l.material_id, l])));
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger la liste'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [appUser, isGuest, isLoading, projectId, router]);

  // Load budget summary when data is available
  useEffect(() => {
    if (data && budgetAllowed) {
      loadBudgetSummary();
    }
  }, [data, budgetAllowed, loadBudgetSummary]);

  // Derniers prix relevés par l'entreprise (E4-4)
  useEffect(() => {
    if (data && budgetAllowed) {
      loadKnownPrices();
    }
  }, [data, budgetAllowed, loadKnownPrices]);

  const knownMaterialPrices = useMemo(
    () => indexKnownPrices(knownPrices?.materials ?? []),
    [knownPrices],
  );
  const knownComplementPrices = useMemo(
    () => indexKnownPrices(knownPrices?.complements ?? []),
    [knownPrices],
  );

  /**
   * Articles encore sans prix pour lesquels l'entreprise en connaît un. Ne
   * propose jamais d'écraser une saisie de ce chantier : le rappel comble des
   * trous, il ne corrige pas ce que l'artisan vient de relever.
   */
  const recallable = useMemo(() => {
    if (!data) return { materials: [], complements: [] };
    const materials = data.material_items
      .map((item) => ({ item, known: knownMaterialPrices.get(item.material_id) }))
      .filter(
        (row): row is { item: typeof row.item; known: KnownPrice } =>
          row.known != null && row.item.real_unit_price == null,
      );
    const complements = data.complementary_items
      .map((item) => ({
        item,
        known: knownComplementPrices.get(item.complementary_material_id),
      }))
      .filter(
        (row): row is { item: typeof row.item; known: KnownPrice } =>
          row.known != null &&
          !row.item.is_removed &&
          row.item.real_unit_price == null,
      );
    return { materials, complements };
  }, [data, knownMaterialPrices, knownComplementPrices]);

  const recallableCount =
    recallable.materials.length + recallable.complements.length;

  const handleUpdateMaterialQty = useCallback(
    (materialId: string, units: number) => {
      // Update local state optimistically
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          material_items: prev.material_items.map((item) =>
            item.material_id === materialId
              ? {
                  ...item,
                  units_needed: units,
                  is_manually_adjusted: units !== item.original_units_needed,
                }
              : item,
          ),
        };
      });

      // Queue update (mutualisé : clé material_id)
      const existing = pendingUpdatesRef.current.material_items || [];
      const idx = existing.findIndex((u) => u.material_id === materialId);
      if (idx >= 0) {
        existing[idx].units_needed = units;
      } else {
        existing.push({ material_id: materialId, units_needed: units });
      }
      pendingUpdatesRef.current.material_items = existing;
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleResetMaterialQty = useCallback(
    (materialId: string) => {
      const item = data?.material_items.find((m) => m.material_id === materialId);
      if (item) {
        handleUpdateMaterialQty(materialId, item.original_units_needed);
      }
    },
    [data, handleUpdateMaterialQty],
  );

  const handleUpdateMaterialPrice = useCallback(
    (materialId: string, price: number, storeName: string) => {
      // Update local state optimistically
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          material_items: prev.material_items.map((item) =>
            item.material_id === materialId
              ? { ...item, real_unit_price: price, store_name: storeName }
              : item,
          ),
        };
      });

      // Queue update — merge with existing pending update for this item
      const existing = pendingUpdatesRef.current.material_items || [];
      const idx = existing.findIndex((u) => u.material_id === materialId);
      if (idx >= 0) {
        existing[idx].real_unit_price = price;
        existing[idx].store_name = storeName;
      } else {
        // Need to include units_needed for the DTO
        const currentItem = data?.material_items.find(
          (m) => m.material_id === materialId,
        );
        existing.push({
          material_id: materialId,
          units_needed: currentItem?.units_needed ?? 0,
          real_unit_price: price,
          store_name: storeName,
        });
      }
      pendingUpdatesRef.current.material_items = existing;
      hasPriceUpdatesRef.current = true;
      scheduleSave();
    },
    [data, scheduleSave],
  );

  const handleUpdateComplementQty = useCallback(
    (complementaryMaterialId: string, quantity: number) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          complementary_items: prev.complementary_items.map((item) =>
            item.complementary_material_id === complementaryMaterialId
              ? { ...item, quantity }
              : item,
          ),
        };
      });

      const existing = pendingUpdatesRef.current.complementary_items || [];
      const idx = existing.findIndex(
        (u) => u.complementary_material_id === complementaryMaterialId,
      );
      if (idx >= 0) {
        existing[idx].quantity = quantity;
      } else {
        existing.push({ complementary_material_id: complementaryMaterialId, quantity });
      }
      pendingUpdatesRef.current.complementary_items = existing;
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleRemoveComplement = useCallback(
    (complementaryMaterialId: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          complementary_items: prev.complementary_items.map((item) =>
            item.complementary_material_id === complementaryMaterialId
              ? { ...item, is_removed: true }
              : item,
          ),
        };
      });

      const existing = pendingUpdatesRef.current.complementary_items || [];
      const idx = existing.findIndex(
        (u) => u.complementary_material_id === complementaryMaterialId,
      );
      if (idx >= 0) {
        existing[idx].is_removed = true;
      } else {
        existing.push({ complementary_material_id: complementaryMaterialId, is_removed: true });
      }
      pendingUpdatesRef.current.complementary_items = existing;
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleRestoreComplement = useCallback(
    (complementaryMaterialId: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          complementary_items: prev.complementary_items.map((item) =>
            item.complementary_material_id === complementaryMaterialId
              ? { ...item, is_removed: false }
              : item,
          ),
        };
      });

      const existing = pendingUpdatesRef.current.complementary_items || [];
      const idx = existing.findIndex(
        (u) => u.complementary_material_id === complementaryMaterialId,
      );
      if (idx >= 0) {
        existing[idx].is_removed = false;
      } else {
        existing.push({ complementary_material_id: complementaryMaterialId, is_removed: false });
      }
      pendingUpdatesRef.current.complementary_items = existing;
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleUpdateComplementPrice = useCallback(
    (complementaryMaterialId: string, price: number, storeName: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          complementary_items: prev.complementary_items.map((item) =>
            item.complementary_material_id === complementaryMaterialId
              ? { ...item, real_unit_price: price, store_name: storeName }
              : item,
          ),
        };
      });

      const existing = pendingUpdatesRef.current.complementary_items || [];
      const idx = existing.findIndex(
        (u) => u.complementary_material_id === complementaryMaterialId,
      );
      if (idx >= 0) {
        existing[idx].real_unit_price = price;
        existing[idx].store_name = storeName;
      } else {
        existing.push({
          complementary_material_id: complementaryMaterialId,
          real_unit_price: price,
          store_name: storeName,
        });
      }
      pendingUpdatesRef.current.complementary_items = existing;
      hasPriceUpdatesRef.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  /**
   * Applique les derniers prix connus aux articles encore vides — **un seul
   * geste, déclenché par l'artisan** (leçon 18). Réutilise les mêmes
   * gestionnaires que la saisie manuelle : même `PATCH`, même rafraîchissement
   * du budget, aucun chemin d'écriture parallèle.
   */
  const handleRecallPrices = useCallback(() => {
    for (const { item, known } of recallable.materials) {
      handleUpdateMaterialPrice(
        item.material_id,
        known.real_unit_price,
        known.store_name ?? '',
      );
    }
    for (const { item, known } of recallable.complements) {
      handleUpdateComplementPrice(
        item.complementary_material_id,
        known.real_unit_price,
        known.store_name ?? '',
      );
    }
  }, [recallable, handleUpdateMaterialPrice, handleUpdateComplementPrice]);

  const downloadPdf = useCallback(async () => {
    await flushNow();
    setDownloading(true);
    setError('');
    try {
      const safeName = projectName.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim() || 'liste';
      await apiDownload(
        `/projects/${projectId}/shopping-list/export/pdf`,
        `liste-courses-${safeName}.pdf`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de télécharger le PDF'));
    } finally {
      setDownloading(false);
    }
  }, [projectId, projectName, flushNow]);

  /*
   * Emporter la liste chez soi ou la publier demande un compte : ce sont les
   * deux moments de conversion du parcours (E2-1). Les boutons restent visibles
   * et actifs pour l'invité — les cacher supprimerait l'envie en même temps que
   * l'action. L'API refuse de son côté (`ACCOUNT_REQUIRED`) : ces tests ne sont
   * qu'un raccourci d'interface, jamais la barrière.
   */
  const handleDownloadPdf = useCallback(() => {
    if (isGuest) {
      setPendingGuestAction('pdf');
      return;
    }
    void downloadPdf();
  }, [isGuest, downloadPdf]);

  const handleShare = useCallback(() => {
    if (isGuest) {
      setPendingGuestAction('share');
      return;
    }
    setShowSharePanel((v) => !v);
  }, [isGuest]);

  /**
   * Rejoue l'action qui a déclenché l'inscription. Sans cela, l'utilisateur qui
   * vient de créer son compte retombe sur sa liste et doit deviner qu'il faut
   * recliquer — on lui a fait payer le prix, autant lui livrer la marchandise.
   *
   * L'action rejouée est la version **sans garde** (`downloadPdf`) : au moment
   * où la modale annonce le succès, le rendu qui a capturé ce callback voyait
   * encore `isGuest === true`. Repasser par `handleDownloadPdf` rouvrirait donc
   * la modale à l'infini.
   */
  const handleGuestConverted = useCallback(() => {
    const action = pendingGuestAction;
    setPendingGuestAction(null);
    if (action === 'pdf') void downloadPdf();
    if (action === 'share') setShowSharePanel(true);
  }, [pendingGuestAction, downloadPdf]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setError('');
    try {
      const result = await apiPost<ShoppingListResponse>(
        `/projects/${projectId}/shopping-list/regenerate`,
        {},
      );
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de régénérer la liste'));
    } finally {
      setRegenerating(false);
      setShowRegenerateConfirm(false);
    }
  }, [projectId]);

  const handleFinalizeBudget = useCallback(async () => {
    setError('');
    try {
      const summary = await apiPost<BudgetSummary>(
        `/projects/${projectId}/shopping-list/budget-summary/finalize`,
        {},
      );
      setBudgetSummary(summary);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de finaliser le budget'));
    } finally {
      setShowFinalizeConfirm(false);
    }
  }, [projectId]);

  const handleComparePrices = useCallback(async () => {
    if (!priceComparisonAllowed) {
      showPaywall('price_comparison');
      return;
    }
    setComparing(true);
    setError('');
    try {
      const result = await apiPost<PriceComparisonResponse>(
        `/projects/${projectId}/shopping-list/compare-prices`,
        {},
      );
      setComparisonData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de comparer les prix'));
    } finally {
      setComparing(false);
    }
  }, [priceComparisonAllowed, projectId, showPaywall]);

  const handleComparisonApplied = useCallback(async () => {
    // Reload the shopping list to reflect applied prices
    try {
      const result = await apiGet<ShoppingListResponse>(
        `/projects/${projectId}/shopping-list`,
      );
      setData(result);
      setComparisonData(null);
      await loadBudgetSummary();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de recharger la liste'));
    }
  }, [projectId, loadBudgetSummary]);

  const handleShowPaywall = useCallback(() => {
    showPaywall('budget_tracking');
  }, [showPaywall]);

  /*
    Les deux sorties de l'étape lisent la liste **côté serveur** — le devis via
    `GET /shopping-list`, la clôture via son propre écran. Elles attendent donc
    que les saisies en attente soient parties (cf. `flushNow`).
  */
  const handleGoToQuote = useCallback(async () => {
    await flushNow();
    router.push(`/projects/${projectId}/quote/new`);
  }, [flushNow, projectId, router]);

  const handleGoToCloseout = useCallback(async () => {
    await flushNow();
    router.push(`/projects/${projectId}/shopping-list/closeout`);
  }, [flushNow, projectId, router]);

  if (isLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 rounded-[2rem]" />
        <Skeleton className="mt-6 h-48 rounded-[2rem]" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <FlowProgress
        step="prices"
        projectId={projectId}
        projectName={projectName}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-stone-950 sm:text-3xl">
          Liste de courses
        </h1>
        {saving && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
            Sauvegarde...
          </span>
        )}
      </div>

      {data && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            {downloading ? 'Téléchargement...' : 'Télécharger PDF'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
              <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
            </svg>
            Partager un lien
          </button>
          <button
            type="button"
            onClick={handleComparePrices}
            disabled={comparing}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.258a33.186 33.186 0 0 1 6.668.83.75.75 0 0 1-.336 1.461 31.28 31.28 0 0 0-1.103-.232l1.702 7.545a.75.75 0 0 1-.387.832A4.981 4.981 0 0 1 15 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 0 1-.387-.832l1.77-7.849a31.743 31.743 0 0 0-3.339-.254v11.505a20.01 20.01 0 0 1 3.78.501.75.75 0 1 1-.339 1.462A18.558 18.558 0 0 0 10 17.5c-1.442 0-2.845.165-4.191.477a.75.75 0 0 1-.339-1.462 20.01 20.01 0 0 1 3.78-.501V4.509c-1.129.026-2.243.112-3.34.254l1.771 7.85a.75.75 0 0 1-.387.83A4.981 4.981 0 0 1 5 14a4.981 4.981 0 0 1-2.294-.556.75.75 0 0 1-.387-.832L4.02 5.067c-.37.07-.738.148-1.103.232a.75.75 0 0 1-.336-1.462 33.053 33.053 0 0 1 6.668-.829V2.75A.75.75 0 0 1 10 2ZM5 12.662l-1.395-6.185a31.67 31.67 0 0 0-1.36.37L3.64 12.54a3.56 3.56 0 0 0 1.36.122Zm10 0a3.56 3.56 0 0 0 1.36-.122l1.395-5.693a31.67 31.67 0 0 0-1.36-.37L15 12.662Z" clipRule="evenodd" />
            </svg>
            {comparing ? 'Comparaison...' : 'Comparer les prix'}
          </button>
          {/*
            DATA-5 : la seule entrée vers la clôture, et elle est ouverte à
            tous. Avant, le seul chemin vers « chantier terminé » était le
            bouton « Finaliser le budget » du tableau de bord Pro, qui ne
            s'affiche que si chaque article porte un prix réel. Un compte free
            n'avait donc aucun moyen de fermer la boucle — ni le produit d'en
            recevoir la donnée.
          */}
          {closeoutAllowed && (
            <button
              type="button"
              onClick={handleGoToCloseout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Chantier terminé
            </button>
          )}
        </div>
      )}

      {showSharePanel && (
        <div className="mb-6">
          <ShareLinkPanel
            projectId={projectId}
            onClose={() => setShowSharePanel(false)}
          />
        </div>
      )}

      <GuestPromptModal
        isOpen={pendingGuestAction !== null}
        onClose={() => setPendingGuestAction(null)}
        onSuccess={handleGuestConverted}
      />

      {comparisonData && (
        <PriceComparisonPanel
          projectId={projectId}
          data={comparisonData}
          onApplied={handleComparisonApplied}
          onClose={() => setComparisonData(null)}
        />
      )}

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {data?.is_stale && (
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-800">
            L&apos;estimation a été mise à jour. La liste peut ne plus être à jour.
          </p>
          <button
            type="button"
            onClick={() => setShowRegenerateConfirm(true)}
            disabled={regenerating}
            className="ml-4 shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {regenerating ? 'Régénération...' : 'Régénérer'}
          </button>
        </div>
      )}

      {/*
        E4-4 — le geste qui remplace la ressaisie de tous les prix. Il n'apparaît
        que s'il a quelque chose à faire, et il ne touche que les articles encore
        vides : le rappel comble des trous, il n'écrase pas un relevé du jour.
      */}
      {data && recallableCount > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-700">
            Vous avez déjà relevé un prix pour{' '}
            <span className="font-semibold text-stone-900">
              {recallableCount} article{recallableCount > 1 ? 's' : ''}
            </span>{' '}
            de cette liste sur un chantier précédent.
          </p>
          <button
            type="button"
            onClick={handleRecallPrices}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
          >
            Reprendre mes derniers prix
          </button>
        </div>
      )}

      {data && (
        <>
          <BudgetDashboard
            summary={budgetSummary}
            budgetAllowed={budgetAllowed}
            onFinalize={() => setShowFinalizeConfirm(true)}
            onShowPaywall={handleShowPaywall}
          />

          <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                Matériaux à acheter
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {data.material_items.length} article
                {data.material_items.length > 1 ? 's' : ''}
              </span>
            </div>
            <ShoppingListMaterials
              items={data.material_items}
              budgetAllowed={budgetAllowed}
              buyLinks={buyLinks}
              knownPrices={knownMaterialPrices}
              onUpdateQuantity={handleUpdateMaterialQty}
              onResetQuantity={handleResetMaterialQty}
              onUpdatePrice={handleUpdateMaterialPrice}
              onShowPaywall={handleShowPaywall}
            />
          </section>

          {data.complementary_items.length > 0 && (
            <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
              <ShoppingListComplements
                items={data.complementary_items}
                budgetAllowed={budgetAllowed}
                knownPrices={knownComplementPrices}
                onUpdateQuantity={handleUpdateComplementQty}
                onRemove={handleRemoveComplement}
                onRestore={handleRestoreComplement}
                onUpdatePrice={handleUpdateComplementPrice}
                onShowPaywall={handleShowPaywall}
              />
            </section>
          )}
        </>
      )}

      {/*
        Sortie de l'étape « Prix » vers le devis (PRO-5).

        Elle était noyée dans la barre d'outils secondaire, et conditionnée à
        `subscription_tier.startsWith('contractor')` alors que la route serveur
        est gardée par `export_devis` : deux systèmes d'autorisation divergents,
        qui masquaient le bouton à des utilisateurs autorisés côté API. On lit
        désormais la même gate que le serveur.

        Le compteur de matériaux chiffrés rend visible le prérequis réel du
        devis : sans aucun prix saisi, `POST /quotes` produit un devis vide et
        le formulaire refuse la soumission — jusqu'ici sans que rien, à cette
        étape, ne l'annonce.
      */}
      {data && canQuote && (
        <StickyActionBar
          summary={
            <p className="text-sm text-stone-600">
              {pricedCount === 0
                ? 'Renseignez au moins un prix pour établir le devis.'
                : `${pricedCount} matériau${pricedCount > 1 ? 'x' : ''} chiffré${pricedCount > 1 ? 's' : ''} sur ${data.material_items.length}.`}
            </p>
          }
        >
          <button
            type="button"
            disabled={pricedCount === 0}
            onClick={handleGoToQuote}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Générer le devis
          </button>
        </StickyActionBar>
      )}

      <ConfirmDialog
        open={showRegenerateConfirm}
        title="Régénérer la liste"
        message="Les modifications manuelles seront perdues (les prix saisis seront conservés)."
        confirmLabel="Régénérer"
        busy={regenerating}
        onConfirm={handleRegenerate}
        onCancel={() => setShowRegenerateConfirm(false)}
      />

      <ConfirmDialog
        open={showFinalizeConfirm}
        title="Finaliser le budget"
        message="Le projet sera marqué comme terminé."
        confirmLabel="Finaliser"
        onConfirm={handleFinalizeBudget}
        onCancel={() => setShowFinalizeConfirm(false)}
      />
    </main>
  );
}
