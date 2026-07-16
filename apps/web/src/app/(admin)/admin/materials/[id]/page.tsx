'use client';

import {
  MaterialForm,
  type MaterialFormData,
} from '@/components/admin/MaterialForm';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiGet, apiPatch, apiPut } from '@/lib/api';
import { Alert, ConfirmDialog, Skeleton } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface WasteFactor {
  id: string;
  pose_type: string;
  skill_level: string;
  factor_percent: number;
}

interface Packaging {
  id: string;
  label: string;
  quantity_per_unit: number;
  unit: string;
}

interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  yield_per_unit: number;
  is_active: boolean;
  modified_by: string | null;
  modified_at: string | null;
  packagings: Packaging[];
  waste_factors: WasteFactor[];
}

export default function EditMaterialPage() {
  const { isAdmin } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [error, setError] = useState('');

  const fetchMaterial = useCallback(async () => {
    try {
      const data = await apiGet<Material>(`/admin/materials/${id}`);
      setMaterial(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible de charger le matériau',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) fetchMaterial();
  }, [isAdmin, fetchMaterial]);

  const handleSubmit = async (data: MaterialFormData) => {
    setIsSubmitting(true);
    try {
      await apiPut(`/admin/materials/${id}`, data);
      router.push('/admin/materials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await apiPatch(`/admin/materials/${id}/deactivate`);
      router.push('/admin/materials');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la désactivation',
      );
      setShowDeactivateConfirm(false);
    } finally {
      setDeactivating(false);
    }
  };

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="py-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
      </div>
    );
  }

  if (error && !material) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!material) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Modifier : {material.name}
        </h1>
        {material.is_active && (
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            disabled={deactivating}
            className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Désactiver
          </button>
        )}
        {!material.is_active && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-500">
            Désactivé
          </span>
        )}
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {material.modified_at && (
        <p className="mb-4 text-xs text-[var(--foreground)]/50">
          Dernière modification :{' '}
          {new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(material.modified_at))}
        </p>
      )}

      <MaterialForm
        initialData={{
          name: material.name,
          category: material.category,
          unit: material.unit,
          yield_per_unit: material.yield_per_unit,
          packagings: material.packagings,
          waste_factors: material.waste_factors,
        }}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        submitLabel="Mettre à jour"
      />

      <ConfirmDialog
        open={showDeactivateConfirm}
        title="Désactiver ce matériau"
        message="Il ne sera plus utilisé dans les calculs futurs."
        confirmLabel="Désactiver"
        destructive
        busy={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setShowDeactivateConfirm(false)}
      />
    </div>
  );
}
