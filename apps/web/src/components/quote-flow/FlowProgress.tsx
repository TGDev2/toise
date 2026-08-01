'use client';

import Link from 'next/link';
import {
  QUOTE_FLOW_STEPS,
  QUOTE_FLOW_TOTAL,
  quoteFlowStepLabel,
  quoteFlowStepNumber,
  type QuoteFlowStepKey,
} from '@/lib/quote-flow';

interface FlowProgressProps {
  step: QuoteFlowStepKey;
  projectId: string;
  /** Cible du retour ; par défaut l'étape précédente du tunnel. */
  backHref?: string;
  /** Nom du chantier, affiché quand la place le permet. */
  projectName?: string;
}

/**
 * Repère de progression du tunnel (PRO-5).
 *
 * Remplace les liens « ← Retour » que chaque page réimplémentait en `text-sm`
 * sans padding (cible tactile d'environ 20 px, sous le seuil des 44 px), et
 * répond à la question que le parcours ne traitait nulle part : où j'en suis,
 * combien il reste. `sticky` en haut : le repère survit au scroll des pages
 * longues (dimensions, liste de matériaux) sans coûter de hauteur permanente.
 *
 * Les étapes déjà franchies sont cliquables (retour arrière = correction d'une
 * mesure ou d'un travail) ; les suivantes ne le sont pas — l'étape « Devis » est
 * gardée par `export_devis` côté serveur, et les étapes intermédiaires ont
 * chacune des prérequis que la barre n'a pas à connaître.
 */
export function FlowProgress({
  step,
  projectId,
  backHref,
  projectName,
}: FlowProgressProps) {
  const current = quoteFlowStepNumber(step);
  const previous = QUOTE_FLOW_STEPS[current - 2];
  const resolvedBack =
    backHref ??
    (previous
      ? `/projects/${projectId}/${previous.segment}`
      : '/dashboard');

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-stone-200 bg-[var(--surface)]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:mx-0 sm:rounded-b-2xl">
      <div className="flex min-h-14 items-center gap-2">
        <Link
          href={resolvedBack}
          aria-label={
            previous ? `Retour à l'étape ${previous.label}` : 'Retour au tableau de bord'
          }
          className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">
            Étape {current} / {QUOTE_FLOW_TOTAL} · {quoteFlowStepLabel(step)}
          </p>
          {projectName && (
            <p className="truncate text-xs text-stone-500">{projectName}</p>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={QUOTE_FLOW_TOTAL}
        aria-valuenow={current}
        aria-label="Progression du devis"
        className="flex gap-1 pb-2"
      >
        {QUOTE_FLOW_STEPS.map((s, index) => (
          <span
            key={s.key}
            className={`h-1 flex-1 rounded-full ${
              index < current ? 'bg-[var(--accent)]' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
