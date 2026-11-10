import { WORK_TYPE_LABELS } from './project-types';
import type { CommunityProjectDetail } from './community-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface CommunityProjectMetadata {
  title: string;
  description: string;
  ogImageUrl: string | null;
}

function formatCost(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatSurface(lengthCm: number, widthCm: number): string {
  const surfaceM2 = (lengthCm / 100) * (widthCm / 100);
  return `${surfaceM2.toFixed(1)} m²`;
}

export function workTypeLabel(workType: string): string {
  return WORK_TYPE_LABELS[workType] ?? workType;
}

/**
 * Titre/description optimisés pour des requêtes du type « coût réel carrelage
 * salle de bain 8 m² » (COM-2) : construits depuis les données structurées
 * plutôt que depuis la description libre de l'auteur, pour garantir la
 * présence du type de travaux, de la surface et du coût réel.
 */
export function buildCommunityProjectMetadata(
  project: CommunityProjectDetail,
): CommunityProjectMetadata {
  const label = workTypeLabel(project.work_type);
  const surface = formatSurface(project.length_cm, project.width_cm);
  const cost = formatCost(project.total_cost_cents);

  // Pas de suffixe « | Toisé » ici : le layout racine l'ajoute déjà via
  // son title template (`%s | Toisé`) — le dupliquer produirait
  // « ... | Toisé | Toisé » dans l'onglet du navigateur.
  const title = `${label} : coût réel ${surface} – ${cost}`;

  const savings =
    project.budget_summary && project.budget_summary.savings_percent > 0
      ? ` (${project.budget_summary.savings_percent.toFixed(0)} % d'écart avec un achat pièce par pièce)`
      : '';

  const description =
    `Coût réel de ce projet de ${label.toLowerCase()} de ${surface} partagé ` +
    `par la communauté Toisé : ${cost} TTC${savings}. Photos avant/après ` +
    `et liste d'achats complète.`;

  const photoId = project.after_photo_ids[0] ?? project.before_photo_ids[0] ?? null;
  const communityProjectId = project.id;
  const ogImageUrl = photoId
    ? `${API_URL}/community/${communityProjectId}/photos/${photoId}/file`
    : null;

  return { title, description, ogImageUrl };
}

/** Données structurées Article (pas HowTo : aucune séquence d'étapes dans ces
 * données, et Google a restreint l'éligibilité rich-results de HowTo en 2023). */
export function buildCommunityProjectJsonLd(
  project: CommunityProjectDetail,
  canonicalUrl: string,
): Record<string, unknown> {
  const label = workTypeLabel(project.work_type);
  const surface = formatSurface(project.length_cm, project.width_cm);
  const { ogImageUrl } = buildCommunityProjectMetadata(project);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: project.title,
    url: canonicalUrl,
    ...(ogImageUrl ? { image: ogImageUrl } : {}),
    ...(project.published_at ? { datePublished: project.published_at } : {}),
    author: { '@type': 'Person', name: project.user_display_name },
    about: label,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Coût réel',
        value: formatCost(project.total_cost_cents),
      },
      { '@type': 'PropertyValue', name: 'Surface', value: surface },
      {
        '@type': 'PropertyValue',
        name: 'Durée',
        value: `${project.duration_days} jours`,
      },
    ],
  };
}
