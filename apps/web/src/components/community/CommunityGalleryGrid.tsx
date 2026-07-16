'use client';

import type { CommunityProjectSummary } from '@/lib/community-types';
import { CommunityProjectCard } from './CommunityProjectCard';

interface CommunityGalleryGridProps {
  projects: CommunityProjectSummary[];
}

export function CommunityGalleryGrid({ projects }: CommunityGalleryGridProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
        <h2 className="text-xl font-semibold text-stone-950">
          Aucun projet dans la galerie
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Soyez le premier a partager votre projet terminé avec la communauté !
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <CommunityProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
