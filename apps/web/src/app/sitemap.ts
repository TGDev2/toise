import type { MetadataRoute } from 'next';
import { CALCULATOR_SLUGS } from '@/lib/calculators';
import { apiGet } from '@/lib/api';
import type { PaginatedCommunityProjects } from '@/lib/community-types';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// L'API plafonne `limit` à 50 (cf. ListCommunityQueryDto) et la galerie
// communauté grandit avec le temps sans borne connue à l'avance : on pagine
// jusqu'à épuisement, avec un plafond de sécurité pour ne jamais boucler
// indéfiniment si l'API renvoie une pagination incohérente.
const COMMUNITY_PAGE_SIZE = 50;
const COMMUNITY_MAX_PAGES = 20;

export const revalidate = 3600;

async function communityProjectEntries(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  try {
    for (let page = 1; page <= COMMUNITY_MAX_PAGES; page += 1) {
      const result = await apiGet<PaginatedCommunityProjects>(
        `/community?page=${page}&limit=${COMMUNITY_PAGE_SIZE}`,
      );

      for (const project of result.data) {
        entries.push({
          url: `${BASE_URL}/community/${project.id}`,
          lastModified: project.published_at ?? undefined,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }

      if (page >= result.meta.totalPages) break;
    }
  } catch {
    // Dégrade vers les entrées statiques plutôt que de faire échouer
    // /sitemap.xml si l'API est momentanément indisponible.
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/calculateurs`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...CALCULATOR_SLUGS.map((slug) => ({
      url: `${BASE_URL}/calculateurs/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${BASE_URL}/community`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...(await communityProjectEntries()),
    {
      url: `${BASE_URL}/login`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/register`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/cgu`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/cgv`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/mentions-legales`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}
