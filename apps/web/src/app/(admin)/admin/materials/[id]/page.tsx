'use client';

import {
  MaterialForm,
  type MaterialFormData,
} from '@/components/admin/MaterialForm';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiGet, apiPatch, apiPut } from '@/lib/api';
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
  const [error, setError] = useState('');

  const fetchMaterial = useCallback(async () => {
    try {
      const data = await apiGet<Material>(`/admin/materials/${id}`);
      setMaterial(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible de charger le materiau',
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
    if (!confirm('Desactiver ce materiau ? Il ne sera plus utilise dans les calculs futurs.')) {
      return;
    }
    setDeactivating(true);
    try {
      await apiPatch(`/admin/materials/${id}/deactivate`);
      router.push('/admin/materials');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la desactivation',
      );
    } finally {
      setDeactivating(false);
    }
  };

  if (!isAdmin) return null;

  if (loading) {
    return (
      <p className="py-8 text-center text-[var(--foreground)]/60">
        Chargement...
      </p>
    );
  }

  if (error && !material) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
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
            onClick={handleDeactivate}
            disabled={deactivating}
            className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {deactivating ? 'Desactivation...' : 'Desactiver'}
          </button>
        )}
        {!material.is_active && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
            Desactive
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {material.modified_at && (
        <p className="mb-4 text-xs text-[var(--foreground)]/50">
          Derniere modification :{' '}
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
        submitLabel="Mettre a jour"
      />
    </div>
  );
}
