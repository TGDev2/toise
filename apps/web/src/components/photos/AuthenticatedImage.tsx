'use client';

import { useEffect, useState } from 'react';
import { apiObjectUrl } from '@/lib/api';

interface AuthenticatedImageProps {
  /** Chemin d'API relatif, tel que sérialisé par le serveur (`/projects/...`). */
  path: string;
  alt: string;
  className?: string;
  /** Rendu de repli pendant le chargement et en cas d'échec. */
  fallback?: React.ReactNode;
}

/**
 * Affiche une image servie par une route **authentifiée**.
 *
 * Le `src` d'une balise `<img>` ne porte pas de Bearer : brancher directement
 * l'URL d'API donne un 401. On récupère donc les octets avec le jeton, puis on
 * affiche le `blob:` obtenu.
 *
 * Tout le soin est dans le cycle de vie : l'object URL est révoqué au démontage
 * **et** à chaque changement de `path`, et une réponse arrivée après un
 * changement de `path` est ignorée plutôt que peinte par-dessus la bonne (sans
 * quoi une grille de photos affiche la miniature du voisin, au hasard des
 * latences).
 */
export function AuthenticatedImage({
  path,
  alt,
  className,
  fallback = null,
}: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let created: string | null = null;

    apiObjectUrl(path)
      .then((url) => {
        if (revoked) {
          // `path` a changé (ou le composant est démonté) pendant la requête :
          // ce blob n'a plus de destinataire, il ne doit pas fuiter.
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!revoked) setObjectUrl(null);
      });

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
      setObjectUrl(null);
    };
  }, [path]);

  if (!objectUrl) return <>{fallback}</>;

  // `next/image` ne sait pas charger une `blob:` URL sans `unoptimized`, et il
  // n'y aurait rien à optimiser : les octets sont déjà en mémoire.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={alt} className={className} />;
}
