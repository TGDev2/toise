'use client';

/**
 * Gelé (ADR 0001 D3, §5) : `cost_benchmark` est refusée à tous les paliers en
 * base, donc plus branché sur `shopping-list/page.tsx` — l'afficher ne
 * produirait qu'une promesse « Passer à Pro » qui ne se débloque jamais.
 * Conservé pour une réouverture éventuelle, conditionnée aux données.
 */

import type {
  BenchmarkPosition,
  CostBenchmarkResponse,
} from '@/lib/cost-benchmark-types';

interface CostBenchmarkPanelProps {
  benchmark: CostBenchmarkResponse | null;
  /** Le chargement a échoué — à distinguer d'une cohorte insuffisante. */
  benchmarkFailed: boolean;
  benchmarkAllowed: boolean;
  onShowPaywall: () => void;
}

const SHELL =
  'mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]';

/**
 * La méthode est écrite à l'écran plutôt que promise : c'est ce qui rend
 * l'attente lisible comme une attente, et non comme une panne.
 */
const METHOD_NOTE =
  'Matériaux uniquement, consommables exclus. Chaque médiane agrège au moins 10 chantiers portés par 5 entreprises différentes, avec un maximum de 3 chantiers par entreprise — aucun coût individuel n’est exposé.';

const POSITION_STYLES: Record<
  BenchmarkPosition,
  { badge: string; headline: string }
> = {
  below: { badge: 'bg-emerald-100 text-emerald-800', headline: 'text-emerald-700' },
  around: { badge: 'bg-stone-100 text-stone-700', headline: 'text-stone-900' },
  above: { badge: 'bg-amber-100 text-amber-800', headline: 'text-amber-700' },
};

function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** « 18 % de moins », « 7 % de plus », « dans la médiane ». */
function formatDelta(deltaPercent: number, position: BenchmarkPosition): string {
  if (position === 'around') return 'dans la médiane';
  const rounded = Math.abs(deltaPercent).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  });
  return `${rounded} % de ${position === 'below' ? 'moins' : 'plus'}`;
}

/**
 * BACKLOG DATA-4. Aucun chiffre n'est affiché tant que le serveur n'a pas
 * **effectivement** une médiane à opposer : une cohorte sous le k-anonymat ne
 * produit rien, et « pas encore de référence » vaut mieux qu'un chiffre bâti
 * sur trois chantiers. Les ouvrages sans référence sont nommés plutôt que
 * passés sous silence — sinon le total se lirait comme portant sur tout le
 * chantier.
 *
 * Quatre états, tous distincts à l'écran, parce qu'ils appellent quatre gestes
 * différents de la part de l'utilisateur : hors palier (souscrire), en panne
 * (réessayer), en attente de cohorte (ne rien faire, revenir), publié. Les
 * confondre dans un `return null` faisait passer une fonction facturée pour un
 * bug, et un bug pour une fonction qui attend ses données.
 */
export function CostBenchmarkPanel({
  benchmark,
  benchmarkFailed,
  benchmarkAllowed,
  onShowPaywall,
}: CostBenchmarkPanelProps) {
  if (!benchmarkAllowed) {
    return (
      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Benchmark de coûts
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Situez le coût de votre chantier face à la médiane anonymisée des
              projets similaires.
            </p>
          </div>
          <button
            type="button"
            onClick={onShowPaywall}
            className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Passer à Pro
          </button>
        </div>
      </section>
    );
  }

  if (benchmarkFailed) {
    return (
      <section className={SHELL}>
        <h2 className="text-lg font-semibold text-stone-900">
          Benchmark de coûts
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Comparaison indisponible pour le moment. Rechargez la page pour
          réessayer — votre liste d&apos;achats n&apos;est pas affectée.
        </p>
      </section>
    );
  }

  // Premier rendu, avant la réponse : rien plutôt qu'un squelette qui clignote.
  if (!benchmark) return null;

  if (!benchmark.available || !benchmark.overall) {
    return (
      <section className={SHELL}>
        <h2 className="text-lg font-semibold text-stone-900">
          Benchmark de coûts
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Pas encore de référence pour vos ouvrages
          {benchmark.work_types_without_reference.length > 0
            ? ` (${benchmark.work_types_without_reference.join(', ')})`
            : ''}
          . La médiane n&apos;est publiée qu&apos;une fois assez de chantiers
          comparables terminés par assez d&apos;entreprises différentes pour
          qu&apos;aucune dépense ne soit identifiable.
        </p>
        <p className="mt-4 text-xs text-stone-400">{METHOD_NOTE}</p>
      </section>
    );
  }

  const { overall, comparisons } = benchmark;
  const styles = POSITION_STYLES[overall.position];

  return (
    <section className={SHELL}>
      <h2 className="text-lg font-semibold text-stone-900">
        Benchmark de coûts
      </h2>

      <p className={`mt-3 text-2xl font-bold ${styles.headline}`}>
        {overall.position === 'around'
          ? 'Votre chantier est dans la médiane des projets similaires'
          : `Votre chantier coûte ${formatDelta(
              overall.delta_percent,
              overall.position,
            )} que la médiane des projets similaires`}
      </p>
      <p className="mt-1 text-sm text-stone-500">
        {formatEur(overall.cost)} EUR de matériaux, contre{' '}
        {formatEur(overall.reference_cost)} EUR aux tarifs médians.
      </p>

      <ul className="mt-5 divide-y divide-stone-100 border-t border-stone-100">
        {comparisons.map((c) => (
          <li
            key={`${c.work_type_code}-${c.surface_band}`}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">
                {c.work_type_label}
                <span className="ml-2 text-xs font-normal text-stone-500">
                  {c.surface_band_label}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatEur(c.cost_per_m2)} EUR/m² — médiane{' '}
                {formatEur(c.median_cost_per_m2)} EUR/m² sur {c.sample_size}{' '}
                chantiers de {c.organization_count} entreprises
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                POSITION_STYLES[c.position].badge
              }`}
            >
              {formatDelta(c.delta_percent, c.position)}
            </span>
          </li>
        ))}
      </ul>

      {benchmark.work_types_without_reference.length > 0 && (
        <p className="mt-4 text-xs text-stone-500">
          Sans référence pour l&apos;instant :{' '}
          {benchmark.work_types_without_reference.join(', ')} — pas encore assez
          de chantiers comparables pour publier une médiane anonyme.
        </p>
      )}

      <p className="mt-4 text-xs text-stone-400">{METHOD_NOTE}</p>
    </section>
  );
}
