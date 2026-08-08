import type { NextConfig } from 'next';
import path from 'node:path';

// L'optimiseur d'images doit connaître l'hôte de l'API (photos servies par le backend).
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
);

const nextConfig: NextConfig = {
  output: 'standalone',
  /**
   * `/artisans` portait le récit artisan tant que `/` parlait au particulier.
   * E3-1 (ADR 0002 D4) a supprimé le palier DIY et sa landing : le récit
   * artisan **est** la page d'accueil, et l'ancienne URL a été indexée (elle
   * figurait au sitemap avec une priorité de 0,8). D'où un 308 permanent
   * plutôt qu'un 404, qui aurait jeté ce qu'elle a acquis.
   *
   * Une redirection statique se déclare ici et non dans un `middleware.ts` :
   * le projet n'a aucun runtime edge, et en ajouter un pour une règle fixe
   * coûterait à chaque requête du site.
   */
  async redirects() {
    return [{ source: '/artisans', destination: '/', permanent: true }];
  },
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: apiUrl.hostname,
        port: apiUrl.port,
      },
    ],
  },
  experimental: {
    cpus: 1,
    workerThreads: true,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
    turbopackPluginRuntimeStrategy: 'workerThreads',
  },
};

export default nextConfig;
