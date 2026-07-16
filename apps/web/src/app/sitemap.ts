import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'monthly',
      priority: 1,
    },
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
  ];
}
