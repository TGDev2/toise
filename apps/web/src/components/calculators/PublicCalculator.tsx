'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DimensionsForm } from '@/components/dimensions/DimensionsForm';
import { EstimationResults } from '@/components/estimation/EstimationResults';
import { SkillLevelSelector } from '@/components/estimation/SkillLevelSelector';
import { Alert } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost, apiPut } from '@/lib/api';
import type { CalculatorConfig, CalculatorVariant } from '@/lib/calculators';
import { getErrorMessage } from '@/lib/errors';
import type { EstimationLineItem } from '@/lib/estimation-types';
import type { Opening } from '@/lib/surface';

interface PublicCalculatorProps {
  config: CalculatorConfig;
}

interface PublicEstimateResponse {
  work_type_code: string;
  work_type_label: string;
  skill_level: string;
  total_items: number;
  items: EstimationLineItem[];
}

interface SavedDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  openings: Opening[];
}

const LOCAL_PROJECTS_KEY = 'estimate_local_projects';

function defaultParamValues(variant: CalculatorVariant): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of variant.params ?? []) {
    values[param.key] = param.defaultValue;
  }
  return values;
}

function buildCustomParams(
  variant: CalculatorVariant,
  paramValues: Record<string, string>,
): Record<string, unknown> | undefined {
  const params = variant.params ?? [];
  if (params.length === 0) return undefined;

  const custom: Record<string, unknown> = {};
  for (const param of params) {
    const value = paramValues[param.key] ?? param.defaultValue;
    custom[param.key] = param.key === 'number_of_coats' ? Number(value) : value;
  }
  return custom;
}

export function PublicCalculator({ config }: PublicCalculatorProps) {
  const { appUser, isGuest, startGuestSession } = useAuth();
  const router = useRouter();

  const [variantCode, setVariantCode] = useState(config.variants[0].code);
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    defaultParamValues(config.variants[0]),
  );
  const [items, setItems] = useState<EstimationLineItem[] | null>(null);
  const [savedDims, setSavedDims] = useState<SavedDimensions | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [error, setError] = useState('');

  const variant =
    config.variants.find((v) => v.code === variantCode) ?? config.variants[0];

  const handleVariantChange = (code: string) => {
    if (code === variantCode) return;
    const nextVariant = config.variants.find((v) => v.code === code);
    if (!nextVariant) return;
    setVariantCode(code);
    setParamValues(defaultParamValues(nextVariant));
    setItems(null);
    setError('');
  };

  const handleCompute = async (
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    openings: Opening[],
  ) => {
    setError('');
    setIsComputing(true);
    try {
      const response = await apiPost<PublicEstimateResponse>(
        '/public/calculators/estimate',
        {
          length_cm: lengthCm,
          width_cm: widthCm,
          height_cm: heightCm,
          openings: openings.map((o) => ({
            width_cm: o.width_cm,
            height_cm: o.height_cm,
            count: o.count,
          })),
          work_type_code: variant.code,
          skill_level: skillLevel,
          custom_params: buildCustomParams(variant, paramValues),
        },
      );
      setItems(response.items);
      setSavedDims({ lengthCm, widthCm, heightCm, openings });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de calculer l’estimation'));
    } finally {
      setIsComputing(false);
    }
  };

  const handleSaveProject = async () => {
    if (!savedDims) return;
    setError('');
    setIsSavingProject(true);
    try {
      if (appUser) {
        const created = await apiPost<{ id: string }>('/projects', {
          name: config.projectName,
          room_name: 'Ma pièce',
        });
        await apiPut(`/projects/${created.id}/dimensions`, {
          length_cm: savedDims.lengthCm,
          width_cm: savedDims.widthCm,
          height_cm: savedDims.heightCm,
        });
        for (const opening of savedDims.openings) {
          await apiPost(`/projects/${created.id}/openings`, {
            type: opening.type,
            width_cm: opening.width_cm,
            height_cm: opening.height_cm,
            count: opening.count,
          });
        }
        router.push(`/projects/${created.id}/work-selection`);
        return;
      }

      const draft = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        name: config.projectName,
        room_name: 'Ma pièce',
        work_type: variant.draftWorkType,
        length_m: savedDims.lengthCm / 100,
        width_m: savedDims.widthCm / 100,
        height_m: savedDims.heightCm / 100,
        openings: savedDims.openings,
        updated_at: new Date().toISOString(),
      };

      let existing: unknown[] = [];
      try {
        const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        existing = Array.isArray(parsed) ? parsed : [];
      } catch {
        existing = [];
      }
      localStorage.setItem(
        LOCAL_PROJECTS_KEY,
        JSON.stringify([draft, ...existing]),
      );

      if (!isGuest) {
        await startGuestSession();
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de sauvegarder le projet'));
    } finally {
      setIsSavingProject(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        {config.variants.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">
              Surface à traiter
            </legend>
            <div className="flex gap-1 rounded-2xl bg-stone-100 p-1">
              {config.variants.map((v) => (
                <label
                  key={v.code}
                  className={`flex-1 cursor-pointer rounded-xl px-4 py-2 text-center text-sm font-medium transition-colors ${
                    variantCode === v.code
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="calculator-variant"
                    value={v.code}
                    checked={variantCode === v.code}
                    onChange={() => handleVariantChange(v.code)}
                    className="sr-only"
                  />
                  {v.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-stone-700">
            Votre niveau
          </p>
          <SkillLevelSelector
            value={skillLevel}
            onChange={setSkillLevel}
            disabled={isComputing}
          />
        </div>

        {(variant.params ?? []).map((param) => (
          <div key={param.key}>
            <label
              htmlFor={`param-${param.key}`}
              className="mb-2 block text-sm font-medium text-stone-700"
            >
              {param.label}
            </label>
            <select
              id={`param-${param.key}`}
              value={paramValues[param.key] ?? param.defaultValue}
              onChange={(e) =>
                setParamValues((prev) => ({
                  ...prev,
                  [param.key]: e.target.value,
                }))
              }
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
        onSave={handleCompute}
        isSaving={isComputing}
        submitLabel="Calculer mon estimation"
        savingLabel="Calcul en cours..."
      />

      {error && <Alert variant="error">{error}</Alert>}

      {items && (
        <div className="space-y-6 border-t border-stone-200 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-stone-950">
              Votre estimation
            </h2>
            <p className="text-xs text-stone-500">
              Quantités de matériaux estimées — hors prix.
            </p>
          </div>

          <EstimationResults items={items} />

          <div className="rounded-2xl border border-[var(--accent)]/30 bg-white p-6 text-center">
            <h3 className="text-lg font-semibold text-stone-950">
              Gardez cette estimation sous la main
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
              Sauvegardez votre projet pour retrouver vos dimensions, affiner
              vos travaux et générer votre liste de courses complète.
            </p>
            <button
              type="button"
              onClick={handleSaveProject}
              disabled={isSavingProject}
              className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProject ? 'Sauvegarde...' : 'Sauvegarder mon projet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
