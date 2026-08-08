'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';

interface MarketingHeaderProps {
  /**
   * Lien contextuel propre à la page (« Tous les calculateurs »).
   *
   * Cet emplacement portait aussi la bascule d'audience, du temps où `/` parlait
   * au particulier et `/artisans` à l'artisan. E3-1 a fusionné les deux
   * surfaces : il n'existe plus qu'une audience, donc plus rien vers quoi
   * basculer.
   */
  extraLink?: { href: string; label: string };
}

export function MarketingHeader({ extraLink }: MarketingHeaderProps) {
  const { appUser, isGuest } = useAuth();
  const hasSession = Boolean(appUser) || isGuest;

  const bridge = extraLink ?? null;

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
