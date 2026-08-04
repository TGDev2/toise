'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * L'étape photo/analyse automatique est retirée du tunnel (ADR 0001 D2 : le
 * service de vision par ordinateur est débranché de la production). Cette
 * route reste en place — plutôt que supprimée — pour qu'un lien ou un
 * favori existant retombe proprement sur la saisie manuelle, seul chemin
 * désormais.
 */
export default function PhotosPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  useEffect(() => {
    router.replace(`/projects/${projectId}/dimensions`);
  }, [projectId, router]);

  return null;
}
