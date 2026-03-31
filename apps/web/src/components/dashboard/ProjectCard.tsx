'use client';

import { useRouter } from 'next/navigation';
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
  const workTypeLabel =
    project.work_type && WORK_TYPE_LABELS[project.work_type]
      ? WORK_TYPE_LABELS[project.work_type]
      : 'Projet';
  const isReadOnly = project.is_read_only === true;

  return (
    <article className={`rounded-[2rem] border bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] ${isReadOnly ? 'border-stone-300 opacity-75' : 'border-stone-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {workTypeLabel}
            </p>
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M8 1a4.5 4.5 0 0 0-4.5 4.5V7H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V5.5A4.5 4.5 0 0 0 8 1Zm2.5 6V5.5a2.5 2.5 0 0 0-5 0V7h5Z" clipRule="evenodd" />
                </svg>
                Lecture seule
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Piece : {project.room_name}
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
            ? 'Voir les resultats'
            : project.dimensions
              ? 'Modifier les dimensions'
              : 'Definir les dimensions'}
        </button>
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
