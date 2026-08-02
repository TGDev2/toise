'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { AUDIENCE_DEFINITIONS, type Audience } from '@/lib/pricing';

interface MarketingHeaderProps {
  /**
   * Audience servie par la page. Le lien de bascule vers l'autre landing en
   * découle : c'est le seul endroit où une surface reconnaît qu'une autre
   * audience existe, au lieu de lui consacrer une section au milieu de son
   * propre récit.
   */
  audience?: Audience;
  /** Audience vers laquelle proposer la bascule. Sans effet si égale à `audience`. */
  switchTo?: Audience;
  /**
   * Lien contextuel propre à la page (« Tous les calculateurs »). Occupe le même
   * emplacement que la bascule d'audience et l'emporte sur elle : l'en-tête
   * n'affiche jamais deux liens secondaires concurrents.
   */
  extraLink?: { href: string; label: string };
}

export function MarketingHeader({
  audience,
  switchTo,
  extraLink,
}: MarketingHeaderProps) {
  const { appUser, isGuest } = useAuth();
  const hasSession = Boolean(appUser) || isGuest;

  const switchDefinition =
    switchTo && switchTo !== audience ? AUDIENCE_DEFINITIONS[switchTo] : null;

  const bridge =
    extraLink ??
    (switchDefinition
      ? {
          href: switchDefinition.landingPath,
          label: switchDefinition.switchLabel,
        }
      : null);

  return (
    <header className="flex items-center justify-between gap-3 py-6">
      <Link href="/" aria-label="Accueil Chiffréo">
        <Logo height={30} />
      </Link>
      <nav className="flex items-center gap-3">
        {bridge && (
          <Link
            href={bridge.href}
            className="hidden text-sm font-semibold text-stone-700 hover:text-stone-950 sm:block"
          >
            {bridge.label}
          </Link>
        )}
        <Link
          href={hasSession ? '/dashboard' : '/login'}
          className="rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-800 hover:border-stone-500 hover:bg-white"
        >
          {hasSession ? 'Mon dashboard' : 'Se connecter'}
        </Link>
        {!hasSession && (
          <Link
            href="/register"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-950 sm:block"
          >
            Créer un compte
          </Link>
        )}
      </nav>
    </header>
  );
}
