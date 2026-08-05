import { NextResponse } from 'next/server';

/**
 * Sonde de vivacité du serveur web, et surface de la version déployée.
 *
 * `force-dynamic` n'est pas un détail : une route rendue statiquement
 * répondrait depuis le cache de build, donc répondrait encore alors que le
 * serveur Next ne rend plus rien — exactement le cas qu'un healthcheck doit
 * détecter. Elle figerait en prime `APP_VERSION` au moment du build du .next,
 * avant même que l'étage `runner` de l'image ne la connaisse.
 *
 * `APP_VERSION` vient de l'image (cf. `apps/web/Dockerfile`), jamais de
 * l'environnement de lancement : c'est ce qui permet au test de fumée de la CD
 * d'attester du contenu réellement déployé et pas de l'intention du compose.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.APP_VERSION ?? 'dev',
  });
}
