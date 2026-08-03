import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import type { CommunityProjectDetail } from '@/lib/community-types';
import { costedUnits } from '@/lib/shopping-list-types';
import { serializeJsonLd } from '@/lib/json-ld';
import {
  buildCommunityProjectJsonLd,
  buildCommunityProjectMetadata,
} from '@/lib/community-seo';
import { CommunityPhotoCompare } from '@/components/community/CommunityPhotoCompare';
import { CommunityDetailActions } from '@/components/community/CommunityDetailActions';
import { CommunityComments } from '@/components/community/CommunityComments';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function formatCost(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

interface CommunityDetailPageProps {
  params: Promise<{ id: string }>;
}

async function fetchProject(id: string): Promise<CommunityProjectDetail> {
  try {
    return await apiGet<CommunityProjectDetail>(`/community/${id}`);
  } catch (err: unknown) {
    if (
      err instanceof ApiError &&
      typeof err.details.statusCode === 'number' &&
      [400, 404].includes(err.details.statusCode)
    ) {
      notFound();
    }
    throw err;
  }
}

export async function generateMetadata({
  params,
}: CommunityDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await fetchProject(id);
  const { title, description, ogImageUrl } =
    buildCommunityProjectMetadata(project);
  const canonical = `/community/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Chiffréo`,
      description,
      url: canonical,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default async function CommunityDetailPage({
  params,
}: CommunityDetailPageProps) {
  const { id } = await params;
  const project = await fetchProject(id);
  const workTypeLabel = WORK_TYPE_LABELS[project.work_type] ?? project.work_type;
  const jsonLd = buildCommunityProjectJsonLd(
    project,
    `${SITE_URL}/community/${id}`,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Back link */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
      >
        &larr; Retour à la galerie
      </Link>

      {/* Header */}
      <div className="mt-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {workTypeLabel}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          {project.title}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          par {project.user_display_name}
          {project.published_at &&
            ` - ${new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }).format(new Date(project.published_at))}`}
        </p>

        <CommunityDetailActions
          communityProjectId={id}
          initialLikesCount={project.likes_count}
        />
      </div>

      {/* Description */}
      {project.description && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
            {project.description}
          </p>
        </div>
      )}

      {/* Photos */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="mb-4 text-lg font-semibold text-stone-950">
          Photos avant / après
        </h2>
        <CommunityPhotoCompare
          communityProjectId={id}
          beforePhotoIds={project.before_photo_ids}
          afterPhotoIds={project.after_photo_ids}
        />
      </div>

      {/* Project info */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Informations du projet
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Coût total
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {formatCost(project.total_cost_cents)}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Durée
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {project.duration_days} jour{project.duration_days > 1 ? 's' : ''}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Dimensions
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-950">
              {(project.length_cm / 100).toFixed(1)} x{' '}
              {(project.width_cm / 100).toFixed(1)} m
              {project.height_cm != null &&
                ` x ${(project.height_cm / 100).toFixed(1)} m`}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Type de travaux
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {workTypeLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Liste d'achats réelle (COM-1) */}
      {project.purchase_list ? (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">
              Liste d&apos;achats réelle
            </h2>
            {project.budget_summary && project.budget_summary.savings_amount > 0 && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {formatEuros(project.budget_summary.savings_amount)} d&apos;économies
                ({project.budget_summary.savings_percent.toFixed(1)} %)
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {project.purchase_list.material_items.map((item) => (
              <div
                key={item.material_id}
                className="flex flex-col gap-1 rounded-xl bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {item.material_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {costedUnits(item)} x {item.packaging_label}
                    {item.store_name ? ` · ${item.store_name}` : ''}
                  </p>
                </div>
                {item.real_unit_price != null && (
                  <span className="text-sm font-semibold text-stone-950">
                    {formatEuros(item.real_unit_price * costedUnits(item))}
                  </span>
                )}
              </div>
            ))}
          </div>

          {project.budget_summary && (
            <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-sm text-stone-500">Coût total réel</span>
              <span className="text-lg font-semibold text-stone-950">
                {formatEuros(project.budget_summary.total_real_cost)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 text-sm text-stone-500 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          Détails des achats non disponibles pour cette publication.
        </div>
      )}

      {/* Comments */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <CommunityComments communityProjectId={id} />
      </div>
    </main>
  );
}
