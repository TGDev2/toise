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
    return [
      { source: '/artisans', destination: '/', permanent: true },
      /**
       * `/verifier-un-devis` outillait un particulier contre le devis d'un
       * artisan — c'est-à-dire contre le client payant (ADR 0001 D1). E4-4 l'a
       * retirée. La destination est `/calculateurs` et non `/` : l'intention qui
       * menait ici est « combien faut-il pour cette pièce ? », à quoi les
       * calculateurs répondent, là où `/` porte le discours d'abonnement
       * artisan.
       *
       * Contrairement à `/artisans`, cette URL n'a **jamais été indexée** — le
       * site n'est pas en ligne (épic E6). La règle est donc une précaution, pas
       * une conservation d'acquis : elle coûte une ligne statique et couvre le
       * cas où le slug aurait circulé.
       */
      {
        source: '/verifier-un-devis',
        destination: '/calculateurs',
        permanent: true,
      },
    ];
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
  // Le contrôle de types du build ignore les fichiers de test — voir
  // `tsconfig.build.json` pour le pourquoi et la mesure. Les tests restent
  // vérifiés par le `tsc --noEmit` qui précède `next build`.
  typescript: {
    tsconfigPath: 'tsconfig.build.json',
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
