'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPatch, apiPost, apiDownload } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { ShoppingListResponse } from '@/lib/shopping-list-types';
import { ShoppingListMaterials } from '@/components/shopping-list/ShoppingListMaterials';
import { ShoppingListComplements } from '@/components/shopping-list/ShoppingListComplements';
import { ShareLinkPanel } from '@/components/shopping-list/ShareLinkPanel';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function ShoppingListPage() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [data, setData] = useState<ShoppingListResponse | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<{
    material_items?: { material_id: string; work_item_id: string; units_needed: number }[];
    complementary_items?: { complementary_material_id: string; quantity?: number; is_removed?: boolean }[];
  }>({});

  const flushUpdates = useCallback(async () => {
    const updates = pendingUpdatesRef.current;
    if (!updates.material_items?.length && !updates.complementary_items?.length) {
      return;
    }

    pendingUpdatesRef.current = {};
    setSaving(true);
    try {
      const result = await apiPatch<ShoppingListResponse>(
        `/projects/${projectId}/shopping-list`,
        updates,
      );
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de sauvegarder'));
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(flushUpdates, 300);
  }, [flushUpdates]);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const [project, shoppingList] = await Promise.all([
          apiGet<{ name: string }>(`/projects/${projectId}`),
          apiGet<ShoppingListResponse>(`/projects/${projectId}/shopping-list`),
        ]);
        setProjectName(project.name);
        setData(shoppingList);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger la liste'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [appUser, isLoading, projectId, router]);

  const handleUpdateMaterialQty = useCallback(
    (materialId: string, workItemId: string, units: number) => {
      // Update local state optimistically
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          material_items: prev.material_items.map((item) =>
            item.material_id === materialId && item.work_item_id === workItemId
              ? {
                  ...item,
                  units_needed: units,
                  is_manually_adjusted: units !== item.original_units_needed,
                }
              : item,
          ),
        };
      });

      // Queue update
      const existing = pendingUpdatesRef.current.material_items || [];
      const idx = existing.findIndex(
        (u) => u.material_id === materialId && u.work_item_id === workItemId,
      );
      if (idx >= 0) {
        existing[idx].units_needed = units;
      } else {
        existing.push({ material_id: materialId, work_item_id: workItemId, units_needed: units });
      }
      pendingUpdatesRef.current.material_items = existing;
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleResetMaterialQty = useCallback(
    (materialId: string, workItemId: string) => {
      const item = data?.material_items.find(
        (m) => m.material_id === materialId && m.work_item_id === workItemId,
      );
      if (item) {
        handleUpdateMaterialQty(materialId, workItemId, item.original_units_needed);
      }
    },
    [data, handleUpdateMaterialQty],
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

  const handleDownloadPdf = useCallback(async () => {
    setDownloading(true);
    setError('');
    try {
      const safeName = projectName.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim() || 'liste';
      await apiDownload(
        `/projects/${projectId}/shopping-list/export/pdf`,
        `liste-courses-${safeName}.pdf`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de telecharger le PDF'));
    } finally {
      setDownloading(false);
    }
  }, [projectId, projectName]);

  const handleRegenerate = useCallback(async () => {
    if (!confirm('Regenerer la liste ? Les modifications manuelles seront perdues.')) {
      return;
    }
    setRegenerating(true);
    setError('');
    try {
      const result = await apiPost<ShoppingListResponse>(
        `/projects/${projectId}/shopping-list/regenerate`,
        {},
      );
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de regenerer la liste'));
    } finally {
      setRegenerating(false);
    }
  }, [projectId]);

  if (isLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}/estimate`)}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour a l&apos;estimation
        </button>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-stone-950">
            Liste de courses
          </h1>
          {saving && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
              Sauvegarde...
            </span>
          )}
        </div>
        {projectName && (
          <p className="mt-1 text-sm text-stone-500">{projectName}</p>
        )}
      </div>

      {data && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            {downloading ? 'Telechargement...' : 'Telecharger PDF'}
          </button>
          <button
            type="button"
            onClick={() => setShowSharePanel((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
              <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
            </svg>
            Partager un lien
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-400 shadow-sm opacity-50 cursor-not-allowed"
            title="Bientot disponible"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
              <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
            </svg>
            Envoyer par email
          </button>
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

      {error && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data?.is_stale && (
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-800">
            L&apos;estimation a ete mise a jour. La liste peut ne plus etre a jour.
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="ml-4 shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {regenerating ? 'Regeneration...' : 'Regenerer'}
          </button>
        </div>
      )}

      {data && (
        <>
          <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                Materiaux a acheter
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {data.material_items.length} article
                {data.material_items.length > 1 ? 's' : ''}
              </span>
            </div>
            <ShoppingListMaterials
              items={data.material_items}
              onUpdateQuantity={handleUpdateMaterialQty}
              onResetQuantity={handleResetMaterialQty}
            />
          </section>

          {data.complementary_items.length > 0 && (
            <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
              <ShoppingListComplements
                items={data.complementary_items}
                onUpdateQuantity={handleUpdateComplementQty}
                onRemove={handleRemoveComplement}
                onRestore={handleRestoreComplement}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
