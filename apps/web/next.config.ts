import type { NextConfig } from 'next';
import path from 'node:path';

// L'optimiseur d'images doit connaître l'hôte de l'API (photos servies par le backend).
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
);

const nextConfig: NextConfig = {
  output: 'standalone',
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
