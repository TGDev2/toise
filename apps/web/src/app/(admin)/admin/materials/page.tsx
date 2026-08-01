'use client';

import { CategoryTabs } from '@/components/admin/CategoryTabs';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface MaterialPackaging {
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
  is_eco: boolean;
  packagings: MaterialPackaging[];
  modified_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet',
  partition: 'Cloison',
  wall_covering: 'Revetement mural',
};

export default function MaterialsListPage() {
  const { isAdmin } = useAdminAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [ecoOnly, setEcoOnly] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (!showAll) params.set('is_active', 'true');
      if (ecoOnly) params.set('is_eco', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGet<Material[]>(`/admin/materials${query}`);
      setMaterials(data);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [category, showAll, ecoOnly]);

  useEffect(() => {
    if (isAdmin) fetchMaterials();
  }, [isAdmin, fetchMaterials]);

  if (!isAdmin) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Catalogue matériaux
        </h1>
        <Link
          href="/admin/materials/new"
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
        >
          Créer un matériau
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <CategoryTabs selected={category} onChange={setCategory} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={ecoOnly}
              onChange={(e) => setEcoOnly(e.target.checked)}
              className="rounded"
            />
            Éco uniquement
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Afficher les desactives
          </label>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[var(--foreground)]/60">
          Chargement...
        </p>
      ) : materials.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] p-8 text-center">
          <p className="text-[var(--foreground)]/60">
            {category
              ? `Aucun matériau disponible pour la categorie "${CATEGORY_LABELS[category] ?? category}".`
              : 'Aucun matériau dans le catalogue.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--foreground)]/10">
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Nom
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Categorie
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Unité
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Rendement
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Conditionnements
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => (
                <tr
                  key={mat.id}
                  className={`border-b border-[var(--foreground)]/5 transition-colors hover:bg-[var(--accent)]/5 ${
                    !mat.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/materials/${mat.id}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {mat.name}
                      </Link>
                      {mat.is_eco && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Éco
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {CATEGORY_LABELS[mat.category] ?? mat.category}
                  </td>
                  <td className="px-4 py-3">{mat.unit}</td>
                  <td className="px-4 py-3">{mat.yield_per_unit}</td>
                  <td className="px-4 py-3">{mat.packagings.length}</td>
                  <td className="px-4 py-3">
                    {mat.is_active ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Actif
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Désactivé
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--foreground)]/40">
        {materials.length} matériau{materials.length !== 1 ? 'x' : ''} affiche
        {materials.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
