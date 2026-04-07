'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface CommunityPhotoCompareProps {
  communityProjectId: string;
  beforePhotoIds: string[];
  afterPhotoIds: string[];
}

export function CommunityPhotoCompare({
  communityProjectId,
  beforePhotoIds,
  afterPhotoIds,
}: CommunityPhotoCompareProps) {
  const buildUrl = (photoId: string) =>
    `${API_URL}/community/${communityProjectId}/photos/${photoId}/file`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Before */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
          Avant
        </h3>
        {beforePhotoIds.length > 0 ? (
          <div className="grid gap-2">
            {beforePhotoIds.map((id) => (
              <img
                key={id}
                src={buildUrl(id)}
                alt="Avant travaux"
                className="w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl bg-stone-100">
            <span className="text-sm text-stone-400">Aucune photo</span>
          </div>
        )}
      </div>

      {/* After */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
          Apres
        </h3>
        {afterPhotoIds.length > 0 ? (
          <div className="grid gap-2">
            {afterPhotoIds.map((id) => (
              <img
                key={id}
                src={buildUrl(id)}
                alt="Apres travaux"
                className="w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl bg-stone-100">
            <span className="text-sm text-stone-400">Aucune photo</span>
          </div>
        )}
      </div>
    </div>
  );
}
