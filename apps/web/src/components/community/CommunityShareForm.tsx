'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { BudgetSummary } from '@/lib/shopping-list-types';
import { AuthenticatedImage } from '@/components/photos/AuthenticatedImage';

interface PhotoOption {
  id: string;
  url: string;
  thumbnail_url: string | null;
}

interface CommunityShareFormProps {
  projectId: string;
  photos: PhotoOption[];
  // COM-1 : le coût réel vient toujours de la liste d'achats finalisée du
  // projet — plus de saisie manuelle. Le parent ne rend ce formulaire que
  // lorsque ce résumé est disponible et finalisé.
  budgetSummary: BudgetSummary;
  onSuccess: () => void;
}

export function CommunityShareForm({
  projectId,
  photos,
  budgetSummary,
  onSuccess,
}: CommunityShareFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [beforePhotoIds, setBeforePhotoIds] = useState<string[]>([]);
  const [afterPhotoIds, setAfterPhotoIds] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!gdprConsent) {
      setError('Vous devez accepter le partage de vos données.');
      return;
    }

    const days = parseInt(durationDays, 10);
    if (isNaN(days) || days < 1) {
      setError('La durée doit être au moins 1 jour.');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/community', {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
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
          placeholder="Ex : Rénovation salle de bain - carrelage mural"
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

      {/* Coût réel (COM-1 : figé depuis la liste d'achats finalisée, non modifiable) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-xs font-medium text-emerald-700">
            Coût réel (liste d&apos;achats)
          </span>
          <p className="mt-1 text-lg font-semibold text-emerald-900">
            {budgetSummary.total_real_cost.toFixed(2)} EUR
          </p>
          {budgetSummary.savings_amount > 0 && (
            <p className="mt-0.5 text-xs text-emerald-700">
              {budgetSummary.savings_percent.toFixed(1)} % d&apos;économies vs.
              un achat sans optimisation
            </p>
          )}
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-stone-700">
            Durée du projet (jours) *
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

      {/* Photo selection - Before */}
      {photos.length > 0 && (
        <>
          <div className="space-y-3">
            <span className="text-sm font-medium text-stone-700">
              Photos &quot;Avant&quot;
            </span>
            <p className="text-xs text-stone-500">
              Sélectionnez les photos montrant l&apos;etat avant les travaux.
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
                      ? 'border-[var(--accent)]'
                      : 'border-transparent'
                  }`}
                >
                  <AuthenticatedImage
                    path={photo.thumbnail_url ?? photo.url}
                    alt="Photo du projet"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {beforePhotoIds.includes(photo.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent)]/20">
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white">
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
              Photos &quot;Après&quot;
            </span>
            <p className="text-xs text-stone-500">
              Sélectionnez les photos montrant le résultat final.
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
                  <AuthenticatedImage
                    path={photo.thumbnail_url ?? photo.url}
                    alt="Photo du projet"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {afterPhotoIds.includes(photo.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                        Après
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
          matériaux, coût) soient partagees publiquement dans la galerie
          communautaire. Je peux retirer ma publication à tout moment. *
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !gdprConsent}
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Envoi en cours...' : 'Soumettre a la communauté'}
      </button>
    </form>
  );
}
