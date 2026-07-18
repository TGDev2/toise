import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chiffréo — Estimation de matériaux de rénovation',
    short_name: 'Chiffréo',
    description:
      'Estimez précisément vos matériaux de rénovation : dimensions, travaux, liste d\'achat.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#efe7d6',
    theme_color: '#1d6b57',
    lang: 'fr',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
