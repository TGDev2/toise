'use client';

import type { CloseoutSummary } from '@/lib/closeout-types';
import { formatEuros, formatIsoDate } from '@/lib/closeout-types';

/**
 * DATA-5 — la réponse immédiate à la déclaration.
 *
 * Deux questions distinctes, deux chiffres distincts : « qu'est-ce qui me
 * reste sur les bras » (`surplus_value_total`) et « puis-je encore le rendre »
 * (`recoverable_amount`). Les confondre en un seul montant reviendrait à
 * promettre une reprise que ni l'enseigne ni la catégorie ne garantissent.
 */
export function CloseoutSummaryPanel({ summary }: { summary: CloseoutSummary }) {
  if (summary.lines_declared === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
        <p className="text-sm text-stone-600">
          Corrigez les quantités que vous avez réellement achetées. Nous vous
          dirons ce qu’il vous reste, ce qui est encore reprenable et où notre
          estimation s’est trompée.
        </p>
      </div>
    );
  }

  const hasSurplus = summary.surplus_lines > 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <p className="text-sm text-stone-500">
        {summary.lines_declared} ligne(s) déclarée(s) sur {summary.lines_total}
      </p>

      {!hasSurplus ? (
        <p className="mt-2 text-base text-stone-900">
          Rien ne vous reste sur les bras : vous n’avez rien acheté au-delà de
          l’estimation.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">
              Il vous reste sur les bras
            </p>
            <p className="text-2xl font-semibold text-stone-900">
              {formatEuros(summary.surplus_value_total)}
            </p>
            <p className="text-xs text-stone-500">
              sur {summary.surplus_lines} ligne(s)
              {summary.unpriced_surplus_lines > 0
                ? `, dont ${summary.unpriced_surplus_lines} sans prix saisi`
                : ''}
            </p>
          </div>

          {summary.recoverable_amount > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">
                Encore reprenable
              </p>
              <p className="text-xl font-semibold text-emerald-700">
                {formatEuros(summary.recoverable_amount)}
              </p>
              {summary.earliest_deadline ? (
                <p className="text-xs text-stone-500">
                  Première échéance : {formatIsoDate(summary.earliest_deadline)}
                </p>
              ) : null}
            </div>
          ) : null}

          {summary.restricted_amount > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700">
                Sous réserve
              </p>
              <p className="text-base font-medium text-amber-700">
                {formatEuros(summary.restricted_amount)}
              </p>
              <p className="text-xs text-stone-500">
                Catégories que les enseignes excluent couramment — peinture
                teintée en machine, conditionnement descellé.
              </p>
            </div>
          ) : null}

          {summary.unknown_amount > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">
                Enseigne inconnue
              </p>
              <p className="text-base font-medium text-stone-700">
                {formatEuros(summary.unknown_amount)}
              </p>
              <p className="text-xs text-stone-500">
                Nous ne publions aucun délai pour{' '}
                {summary.unknown_retailers.join(', ') || 'ces achats'} :
                vérifiez les conditions au dos de votre ticket.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
        Les délais affichés reproduisent les conditions publiées par chaque
        enseigne à la date indiquée. Ils ne valent pas engagement : confirmez en
        magasin.
      </p>
    </div>
  );
}
