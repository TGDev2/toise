'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { ShoppingListResponse } from '@/lib/shopping-list-types';
import { ShoppingListMaterials } from '@/components/shopping-list/ShoppingListMaterials';
import { ShoppingListComplements } from '@/components/shopping-list/ShoppingListComplements';
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
