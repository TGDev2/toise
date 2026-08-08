'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectSummary, WORK_TYPE_LABELS } from '@/lib/project-types';
import { StatusBadge } from './StatusBadge';

interface ProjectCardProps {
  project: ProjectSummary;
  onDelete: (id: string) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getProjectRoute(project: ProjectSummary): string {
  if (project.status === 'estimated' || project.status === 'completed') {
    return `/projects/${project.id}/estimate`;
  }
  return `/projects/${project.id}/dimensions`;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const { appUser } = useAuth();
  const isContractor = appUser?.subscription_tier?.startsWith('contractor') ?? false;
  const workTypeLabel =
    project.work_type && WORK_TYPE_LABELS[project.work_type]
      ? WORK_TYPE_LABELS[project.work_type]
      : 'Projet';

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {workTypeLabel}
            </p>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Pièce : {project.room_name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={project.status} />
          <span className="text-xs text-stone-400">
            {formatDate(project.updated_at)}
          </span>
        </div>
      </div>

      {project.dimensions && (
        <div className="mt-5 grid grid-cols-3 gap-3 text-sm text-stone-700">
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Longueur
            </p>
            <p className="mt-2 font-semibold">
              {(project.dimensions.length_cm / 100).toFixed(2)} m
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Largeur
            </p>
            <p className="mt-2 font-semibold">
              {(project.dimensions.width_cm / 100).toFixed(2)} m
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Hauteur
            </p>
            <p className="mt-2 font-semibold">
              {(project.dimensions.height_cm / 100).toFixed(2)} m
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push(getProjectRoute(project))}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
        >
          {project.status === 'estimated' || project.status === 'completed'
            ? 'Voir les résultats'
            : project.dimensions
              ? 'Modifier les dimensions'
              : 'Définir les dimensions'}
        </button>
        {project.status === 'completed' && (
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}/share`)}
            className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            Partager dans la communauté
          </button>
        )}
        {isContractor && (
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}/site-tracking`)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-stone-50"
          >
            Suivi de chantier
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:-translate-y-0.5 hover:bg-red-50"
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}
