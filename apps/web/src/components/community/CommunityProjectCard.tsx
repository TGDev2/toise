'use client';

import Link from 'next/link';
import Image from 'next/image';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import type { CommunityProjectSummary } from '@/lib/community-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface CommunityProjectCardProps {
  project: CommunityProjectSummary;
}

export function CommunityProjectCard({ project }: CommunityProjectCardProps) {
  const workTypeLabel = WORK_TYPE_LABELS[project.work_type] ?? project.work_type;
  const publishedDate = project.published_at
    ? new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(project.published_at))
    : null;

  return (
    <Link
      href={`/community/${project.id}`}
      className="group block rounded-[2rem] border border-stone-200 bg-white/85 shadow-[0_20px_50px_rgba(67,39,15,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(67,39,15,0.12)]"
    >
      {project.thumbnail_url ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[2rem]">
          <Image
            src={`${API_URL}${project.thumbnail_url}`}
            alt={project.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-t-[2rem] bg-stone-100">
          <span className="text-4xl text-stone-300">&#128247;</span>
        </div>
      )}

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          {workTypeLabel}
        </p>
        <h3 className="mt-1.5 text-lg font-semibold text-stone-950 line-clamp-2">
          {project.title}
        </h3>

        <div className="mt-3 flex items-center gap-4 text-sm text-stone-500">
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-red-400"
            >
              <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0h-.002z" />
            </svg>
            {project.likes_count}
          </span>
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.97 1 5.396v5.209c0 1.424.993 2.64 2.43 2.872 1.202.194 2.437.326 3.693.393.066.01.13.057.168.113l2.209 3.314a.6.6 0 001 0l2.209-3.314a.252.252 0 01.168-.113 37.95 37.95 0 003.693-.393C17.007 13.245 18 12.028 18 10.605V5.396c0-1.424-.993-2.64-2.43-2.872A39.516 39.516 0 0010 2z"
                clipRule="evenodd"
              />
            </svg>
            {project.comments_count}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            par {project.user_display_name}
          </span>
          {publishedDate && (
            <span className="text-xs text-stone-400">{publishedDate}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
