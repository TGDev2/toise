'use client';

import type { ReactNode } from 'react';

interface StickyActionBarProps {
  /** Action principale de l'étape — rendue pleine largeur sur mobile. */
  children: ReactNode;
  /** Contenu secondaire affiché au-dessus du CTA (ex. total TTC en direct). */
  summary?: ReactNode;
  className?: string;
}

/**
 * Barre d'action collante en bas d'écran (PRO-5).
 *
 * Les CTA du tunnel vivaient en fin de page : « Enregistrer les dimensions »
 * était à ~1400 px de scroll dès qu'une pièce avait deux portes et une fenêtre,
 * et « Voir la liste de courses » sous quinze lignes de matériaux. Sur mobile
 * chez le client, chaque étape coûtait donc un scroll d'exploration avant même
 * de pouvoir avancer.
 *
 * `sticky` et non `fixed` : la barre reste dans le flux, donc elle ne recouvre
 * jamais la fin du contenu (pas de padding-bottom compensatoire à maintenir sur
 * chaque page) et elle se comporte correctement quand le clavier virtuel réduit
 * le viewport. `pb-[env(safe-area-inset-bottom)]` suppose `viewportFit: 'cover'`,
 * posé dans `app/layout.tsx`.
 *
 * `sm:` la barre redevient un bloc statique aligné à gauche : sur desktop le CTA
 * en fin de formulaire est la convention du repo, on ne la casse pas.
 */
export function StickyActionBar({
  children,
  summary,
  className = '',
}: StickyActionBarProps) {
  return (
    <div
      className={`sticky bottom-0 z-30 -mx-4 mt-6 border-t border-stone-200 bg-[var(--surface)]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none ${className}`}
    >
      {summary && <div className="mb-3 sm:mb-4">{summary}</div>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
        {children}
      </div>
    </div>
  );
}
