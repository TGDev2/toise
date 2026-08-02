'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DimensionsForm } from '@/components/dimensions/DimensionsForm';
import { EstimationResults } from '@/components/estimation/EstimationResults';
import { Alert, DecimalInput, FIELD_BASE } from '@/components/ui';
import { usePublicAnalytics } from '@/hooks/useAnalytics';
import { apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Opening, RectSegment, SurfaceExclusion } from '@/lib/surface';
import {
  QUOTE_CHECK_PAGE,
  QUOTE_CHECK_WORK_TYPES,
  QUOTE_COHERENCE_WORDING,
  type QuoteCheckResponse,
  type QuoteCheckWorkType,
} from '@/lib/quote-check';

/**
 * Contrôle de cohérence d'un devis reçu (GTM-10).
 *
 * Ce composant n'écrit **aucune** phrase de verdict : elles vivent toutes dans
 * `lib/quote-check.ts`, où un test leur interdit le lexique tarifaire et
 * prescriptif. En écrire une ici la mettrait hors de portée du garde-fou — c'est
 * la porte par laquelle la dérive rentre à chaque fois (leçon 15).
 */

function defaultParamValues(
  workType: QuoteCheckWorkType,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of workType.params ?? []) {
    values[param.key] = param.defaultValue;
  }
  return values;
}

function buildCustomParams(
  workType: QuoteCheckWorkType,
  paramValues: Record<string, string>,
): Record<string, unknown> | undefined {
  const params = workType.params ?? [];
  if (params.length === 0) return undefined;

  const custom: Record<string, unknown> = {};
  for (const param of params) {
    const value = paramValues[param.key] ?? param.defaultValue;
    custom[param.key] = param.key === 'number_of_coats' ? Number(value) : value;
  }
  return custom;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const body = rounded.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return rounded > 0 ? `+ ${body} %` : `${body} %`.replace('-', '− ');
}

function formatSurface(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²`;
}

export function QuoteCheckForm() {
  const { track } = usePublicAnalytics();

  useEffect(() => {
    track('quote_check_viewed', { slug: QUOTE_CHECK_PAGE.slug });
  }, [track]);

  const [workTypeCode, setWorkTypeCode] = useState(
    QUOTE_CHECK_WORK_TYPES[0].code,
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    defaultParamValues(QUOTE_CHECK_WORK_TYPES[0]),
  );
  const [declaredSurface, setDeclaredSurface] = useState('');
  const [result, setResult] = useState<QuoteCheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const workType =
    QUOTE_CHECK_WORK_TYPES.find((w) => w.code === workTypeCode) ??
    QUOTE_CHECK_WORK_TYPES[0];

  const handleWorkTypeChange = (code: string) => {
    if (code === workTypeCode) return;
    const next = QUOTE_CHECK_WORK_TYPES.find((w) => w.code === code);
    if (!next) return;
    setWorkTypeCode(code);
    setParamValues(defaultParamValues(next));
    setResult(null);
    setError('');
  };

  const handleCheck = async (
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    openings: Opening[],
    segments: RectSegment[],
    // Sixième argument : `DimensionsForm` déduit ces aires dans son aperçu en
    // direct. Un appelant qui n'en déclare que cinq reste assignable et
    // TypeScript ne dit rien — c'est ainsi que le chemin public a un jour
    // chiffré une surface plus grande que celle affichée (GTM-9).
    exclusions: SurfaceExclusion[],
  ) => {
    const declared = Number(declaredSurface);
    if (!Number.isFinite(declared) || declared <= 0) {
      setError('Indiquez la quantité que porte le devis, en m².');
      return;
    }

    setError('');
    setIsChecking(true);
    try {
      const response = await apiPost<QuoteCheckResponse>('/public/quote-check', {
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
        openings: openings.map((o) => ({
          width_cm: o.width_cm,
          height_cm: o.height_cm,
          count: o.count,
        })),
        segments: segments.length > 0 ? segments : undefined,
        exclusions: exclusions.length > 0 ? exclusions : undefined,
        work_type_code: workType.code,
        custom_params: buildCustomParams(workType, paramValues),
        declared_surface_m2: declared,
      });
      setResult(response);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de vérifier ce devis'));
    } finally {
      setIsChecking(false);
    }
  };

  const wording = result ? QUOTE_COHERENCE_WORDING[result.status] : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="quote-work-type"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Ouvrage porté par le devis
          </label>
          <select
            id="quote-work-type"
            value={workTypeCode}
            onChange={(e) => handleWorkTypeChange(e.target.value)}
            className={FIELD_BASE}
          >
            {QUOTE_CHECK_WORK_TYPES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="quote-declared-surface"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Quantité inscrite au devis ({workType.unitLabel})
          </label>
          <DecimalInput
            id="quote-declared-surface"
            value={declaredSurface}
            onValueChange={setDeclaredSurface}
            placeholder="46"
            className={FIELD_BASE}
          />
        </div>

        {(workType.params ?? []).map((param) => (
          <div key={param.key}>
            <label
              htmlFor={`quote-param-${param.key}`}
              className="mb-2 block text-sm font-medium text-stone-700"
            >
              {param.label}
            </label>
            <select
              id={`quote-param-${param.key}`}
              value={paramValues[param.key] ?? param.defaultValue}
              onChange={(e) =>
                setParamValues((prev) => ({
                  ...prev,
                  [param.key]: e.target.value,
                }))
              }
              className={FIELD_BASE}
            >
              {param.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <DimensionsForm
        onSave={handleCheck}
        isSaving={isChecking}
        submitLabel="Vérifier les quantités"
        savingLabel="Vérification en cours..."
      />

      {error && <Alert variant="error">{error}</Alert>}

      {result && wording && (
        <div className="space-y-6 border-t border-stone-200 pt-8">
          <section
            aria-label="Résultat de la vérification"
            className={`rounded-2xl border p-6 ${
              wording.tone === 'attention'
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-stone-200 bg-white'
            }`}
          >
            <h2 className="text-xl font-semibold text-stone-950">
              {wording.headline}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {wording.body}
            </p>

            {result.implied_waste_percent !== null && (
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">
                    Surface à traiter
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-stone-950">
                    {formatSurface(result.net_surface_m2)}
                  </dd>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatSurface(result.gross_surface_m2)} bruts, moins{' '}
                    {formatSurface(result.deducted_m2)} déduits
                  </p>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">
                    Quantité au devis
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-stone-950">
                    {formatSurface(result.declared_surface_m2)}
                  </dd>
                  <p className="mt-1 text-xs text-stone-500">
                    soit {formatPercent(result.implied_waste_percent)} de marge
                  </p>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">
                    Marge de référence
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-stone-950">
                    {result.reference.min_percent} à{' '}
                    {result.reference.max_percent} %
                  </dd>
                  <p className="mt-1 text-xs text-stone-500">
                    {result.reference.is_default
                      ? 'aucune référence de pose pour cet ouvrage : marge générique'
                      : `pose ${result.reference.pose_type === 'diagonal' ? 'en diagonale' : 'droite'}, du débutant au confirmé`}
                  </p>
                </div>
              </dl>
            )}

            {wording.caveat && (
              <p className="mt-6 border-t border-stone-200/80 pt-4 text-sm leading-6 text-stone-600">
                {wording.caveat}
              </p>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-stone-950">
                Ce que cette pièce demande en matériaux
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                À recouper avec les lignes de fourniture du devis, quand il en
                détaille.
              </p>
            </div>
            <EstimationResults items={result.items} />
          </section>

          <p className="text-sm text-stone-600">
            Vous envisagez de le faire vous-même ?{' '}
            <Link
              href="/calculateurs"
              className="font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Les calculateurs gratuits
            </Link>{' '}
            reprennent ce calcul en liste d’achats.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-stone-200/80 bg-white/80 p-6">
        <h2 className="text-base font-semibold text-stone-950">
          {QUOTE_CHECK_PAGE.lumpSum.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {QUOTE_CHECK_PAGE.lumpSum.body}
        </p>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          {QUOTE_CHECK_PAGE.lumpSum.ask}
        </p>
      </section>
    </div>
  );
}
