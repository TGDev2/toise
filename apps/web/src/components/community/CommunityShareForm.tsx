'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface PhotoOption {
  id: string;
  url: string;
  thumbnail_url: string | null;
}

interface CommunityShareFormProps {
  projectId: string;
  photos: PhotoOption[];
  onSuccess: () => void;
}

interface MaterialInput {
  name: string;
  quantity: string;
}

export function CommunityShareForm({
  projectId,
  photos,
  onSuccess,
}: CommunityShareFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState<MaterialInput[]>([
    { name: '', quantity: '' },
  ]);
  const [totalCostEuros, setTotalCostEuros] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [beforePhotoIds, setBeforePhotoIds] = useState<string[]>([]);
  const [afterPhotoIds, setAfterPhotoIds] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

  const togglePhoto = (
    photoId: string,
    list: string[],
    setList: (ids: string[]) => void,
  ) => {
    if (list.includes(photoId)) {
      setList(list.filter((id) => id !== photoId));
    } else {
      setList([...list, photoId]);
    }
  };

  const addMaterial = () => {
    setMaterials((prev) => [...prev, { name: '', quantity: '' }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMaterial = (
    index: number,
    field: 'name' | 'quantity',
    value: string,
  ) => {
    setMaterials((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!gdprConsent) {
      setError('Vous devez accepter le partage de vos donnees.');
      return;
    }

    const costCents = Math.round(parseFloat(totalCostEuros) * 100);
    if (isNaN(costCents) || costCents < 0) {
      setError('Le cout total doit etre un nombre valide.');
      return;
    }

    const days = parseInt(durationDays, 10);
    if (isNaN(days) || days < 1) {
      setError('La duree doit etre au moins 1 jour.');
      return;
    }

    const filteredMaterials = materials.filter(
      (m) => m.name.trim() && m.quantity.trim(),
    );

    setSubmitting(true);
    try {
      await apiPost('/community', {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        materials_list: filteredMaterials,
        total_cost_cents: costCents,
        duration_days: days,
        before_photo_ids: beforePhotoIds,
        after_photo_ids: afterPhotoIds,
        gdpr_consent: true,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de soumettre le projet'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <label className="block space-y-2">
        <span className="text-sm font-medium text-stone-700">
          Titre de la publication *
        </span>
        <input
          type="text"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Renovation salle de bain - carrelage mural"
          className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </label>

      {/* Description */}
      <label className="block space-y-2">
        <span className="text-sm font-medium text-stone-700">
          Description (optionnel)
        </span>
        <textarea
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Decrivez votre projet, les difficultes rencontrees, vos conseils..."
          className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </label>

      {/* Cost and Duration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-stone-700">
            Cout total (EUR) *
          </span>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={totalCostEuros}
            onChange={(e) => setTotalCostEuros(e.target.value)}
            placeholder="350.00"
            className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-stone-700">
            Duree du projet (jours) *
          </span>
          <input
            type="number"
            required
            min="1"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="5"
            className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
      </div>

      {/* Materials */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-stone-700">
          Materiaux utilises
        </span>
        {materials.map((mat, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={mat.name}
              onChange={(e) => updateMaterial(idx, 'name', e.target.value)}
              placeholder="Nom du materiau"
              className="flex-1 rounded-2xl border border-stone-300 px-4 py-2 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <input
              type="text"
              value={mat.quantity}
              onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)}
              placeholder="Quantite"
              className="w-32 rounded-2xl border border-stone-300 px-4 py-2 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {materials.length > 1 && (
              <button
                type="button"
                onClick={() => removeMaterial(idx)}
                className="rounded-full px-3 py-2 text-sm text-red-500 hover:bg-red-50"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addMaterial}
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          + Ajouter un materiau
        </button>
      </div>

      {/* Photo selection - Before */}
      {photos.length > 0 && (
        <>
          <div className="space-y-3">
            <span className="text-sm font-medium text-stone-700">
              Photos &quot;Avant&quot;
            </span>
            <p className="text-xs text-stone-500">
              Selectionnez les photos montrant l&apos;etat avant les travaux.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    togglePhoto(photo.id, beforePhotoIds, setBeforePhotoIds)
                  }
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                    beforePhotoIds.includes(photo.id)
                      ? 'border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={`${API_URL}${photo.thumbnail_url ?? photo.url}`}
                    alt="Photo du projet"
                    className="h-full w-full object-cover"
                  />
                  {beforePhotoIds.includes(photo.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                        Avant
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Photo selection - After */}
          <div className="space-y-3">
            <span className="text-sm font-medium text-stone-700">
              Photos &quot;Apres&quot;
            </span>
            <p className="text-xs text-stone-500">
              Selectionnez les photos montrant le resultat final.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    togglePhoto(photo.id, afterPhotoIds, setAfterPhotoIds)
                  }
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                    afterPhotoIds.includes(photo.id)
                      ? 'border-emerald-500'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={`${API_URL}${photo.thumbnail_url ?? photo.url}`}
                    alt="Photo du projet"
                    className="h-full w-full object-cover"
                  />
                  {afterPhotoIds.includes(photo.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                        Apres
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* GDPR Consent */}
      <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <input
          type="checkbox"
          checked={gdprConsent}
          onChange={(e) => setGdprConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-stone-300 text-[var(--accent)] focus:ring-[var(--accent)]"
        />
        <span className="text-sm text-stone-600">
          J&apos;accepte que les informations de mon projet (photos, dimensions,
          materiaux, cout) soient partagees publiquement dans la galerie
          communautaire. Je peux retirer ma publication a tout moment. *
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !gdprConsent}
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Envoi en cours...' : 'Soumettre a la communaute'}
      </button>
    </form>
  );
}
