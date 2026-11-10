import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import type { PaginatedCommunityProjects } from '@/lib/community-types';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import { CommunityGalleryGrid } from '@/components/community/CommunityGalleryGrid';
import { CommunityWorkTypeFilter } from '@/components/community/CommunityWorkTypeFilter';

const PAGE_SIZE = 12;

interface CommunityGalleryPageProps {
  searchParams: Promise<{ work_type?: string; page?: string }>;
}

function parseWorkType(raw: string | undefined): string | null {
  return raw && raw in WORK_TYPE_LABELS ? raw : null;
}

function parsePage(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export async function generateMetadata({
  searchParams,
}: CommunityGalleryPageProps): Promise<Metadata> {
  const workType = parseWorkType((await searchParams).work_type);
  const label = workType ? WORK_TYPE_LABELS[workType] : null;
  const canonical = workType ? `/community?work_type=${workType}` : '/community';

  // Pas de suffixe « | Toisé » dans `title` : le layout racine l'ajoute
  // déjà via son title template (`%s | Toisé`).
  const title = label
    ? `Galerie ${label.toLowerCase()} — coûts réels de travaux`
    : 'Galerie communauté — coûts réels de travaux';
  const description = label
    ? `Découvrez les projets de ${label.toLowerCase()} partagés par la communauté Toisé, avec leur coût réel et leur liste d'achats détaillée.`
    : "Découvrez les projets de rénovation partagés par la communauté Toisé : coût réel, photos avant/après et liste d'achats détaillée pour chaque projet.";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | Toisé`, description, url: canonical },
  };
}

export default async function CommunityGalleryPage({
  searchParams,
}: CommunityGalleryPageProps) {
  const params = await searchParams;
  const workType = parseWorkType(params.work_type);
  const page = parsePage(params.page);
  const filterQuery = workType ? `&work_type=${workType}` : '';

  const projects = await apiGet<PaginatedCommunityProjects>(
    `/community?page=${page}&limit=${PAGE_SIZE}${filterQuery}`,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Communauté
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Galerie des projets terminés
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            Découvrez les réalisations de la communauté et inspirez-vous pour
            vos prochains travaux.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
        >
          Accueil
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <CommunityWorkTypeFilter selected={workType} />
      </div>

      {/* Grid */}
      <div className="mt-6">
        <CommunityGalleryGrid projects={projects.data} />
      </div>

      {/* Pagination */}
      {projects.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link
              href={`/community?page=${page - 1}${filterQuery}`}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
            >
              &larr; Précédent
            </Link>
          ) : (
            <span className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-400 opacity-40">
              &larr; Précédent
            </span>
          )}
          <span className="text-sm text-stone-600">
            Page {projects.meta.page} / {projects.meta.totalPages}
          </span>
          {page < projects.meta.totalPages ? (
            <Link
              href={`/community?page=${page + 1}${filterQuery}`}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
            >
              Suivant &rarr;
            </Link>
          ) : (
            <span className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-400 opacity-40">
              Suivant &rarr;
            </span>
          )}
        </div>
      )}
    </main>
  );
}
