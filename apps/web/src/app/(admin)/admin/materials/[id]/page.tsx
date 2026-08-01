'use client';

import {
  MaterialForm,
  type MaterialFormData,
} from '@/components/admin/MaterialForm';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
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

interface EcoEquivalence {
  id: string;
  eco_material_id: string;
  ecoMaterial: {
    id: string;
    name: string;
    category: string;
    eco_label_fr: string | null;
  };
}

interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  yield_per_unit: number;
  is_active: boolean;
  is_eco: boolean;
  eco_label_fr: string | null;
  modified_by: string | null;
  modified_at: string | null;
  packagings: Packaging[];
  waste_factors: WasteFactor[];
  eco_equivalents: EcoEquivalence[];
}

interface EcoCandidate {
  id: string;
  name: string;
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
  const [ecoCandidates, setEcoCandidates] = useState<EcoCandidate[]>([]);
  const [selectedEcoCandidateId, setSelectedEcoCandidateId] = useState('');
  const [ecoLinkBusy, setEcoLinkBusy] = useState(false);

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

  // Candidats d'équivalence éco : matériaux actifs, éco, de même catégorie,
  // pas déjà liés. Non pertinent pour un matériau lui-même éco (bloqué côté
  // serveur — cf. materials.service.ts::linkEcoEquivalent).
  useEffect(() => {
    if (!material || material.is_eco) {
      setEcoCandidates([]);
      return;
    }
    const linkedIds = new Set(material.eco_equivalents.map((e) => e.eco_material_id));
    apiGet<Material[]>(
      `/admin/materials?category=${material.category}&is_active=true&is_eco=true`,
    )
      .then((data) => {
        setEcoCandidates(
          data
            .filter((m) => m.id !== material.id && !linkedIds.has(m.id))
            .map((m) => ({ id: m.id, name: m.name })),
        );
      })
      .catch(() => setEcoCandidates([]));
  }, [material]);

  const handleLinkEquivalent = async () => {
    if (!selectedEcoCandidateId) return;
    setEcoLinkBusy(true);
    try {
      await apiPost(`/admin/materials/${id}/eco-equivalent`, {
        eco_material_id: selectedEcoCandidateId,
      });
      setSelectedEcoCandidateId('');
      await fetchMaterial();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de lier l'équivalence",
      );
    } finally {
      setEcoLinkBusy(false);
    }
  };

  const handleUnlinkEquivalent = async (ecoMaterialId: string) => {
    setEcoLinkBusy(true);
    try {
      await apiDelete(`/admin/materials/${id}/eco-equivalent/${ecoMaterialId}`);
      await fetchMaterial();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de délier l'équivalence",
      );
    } finally {
      setEcoLinkBusy(false);
    }
  };

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
          is_eco: material.is_eco,
          eco_label_fr: material.eco_label_fr,
          packagings: material.packagings,
          waste_factors: material.waste_factors,
        }}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        submitLabel="Mettre à jour"
      />

      {!material.is_eco && (
        <div className="mt-8 max-w-3xl rounded-2xl bg-[var(--surface)] p-6">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Équivalents éco
          </h2>

          {material.eco_equivalents.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {material.eco_equivalents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--foreground)]/10 px-3 py-2 text-sm"
                >
                  <span>
                    {e.ecoMaterial.name}
                    {e.ecoMaterial.eco_label_fr ? ` — ${e.ecoMaterial.eco_label_fr}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnlinkEquivalent(e.eco_material_id)}
                    disabled={ecoLinkBusy}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
                  >
                    Délier
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-[var(--foreground)]/60">
              Aucun équivalent éco lié pour le moment.
            </p>
          )}

          <div className="flex items-center gap-3">
            <select
              value={selectedEcoCandidateId}
              onChange={(e) => setSelectedEcoCandidateId(e.target.value)}
              disabled={ecoCandidates.length === 0}
              className="flex-1 rounded-lg border border-[var(--foreground)]/20 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">
                {ecoCandidates.length === 0
                  ? 'Aucun matériau éco disponible dans cette catégorie'
                  : '-- Choisir un matériau éco --'}
              </option>
              {ecoCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLinkEquivalent}
              disabled={!selectedEcoCandidateId || ecoLinkBusy}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              Lier
            </button>
          </div>
        </div>
      )}

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
