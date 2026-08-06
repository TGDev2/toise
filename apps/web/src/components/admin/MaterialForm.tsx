'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'painting', label: 'Peinture' },
  { value: 'tiling', label: 'Carrelage' },
  { value: 'flooring', label: 'Parquet' },
  { value: 'partition', label: 'Cloison' },
  { value: 'wall_covering', label: 'Revêtement mural' },
];

const UNITS = [
  { value: 'L', label: 'Litres (L)' },
  { value: 'm2', label: 'Mètres carrés (m2)' },
  { value: 'm', label: 'Mètres linéaires (m)' },
  { value: 'kg', label: 'Kilogrammes (kg)' },
  { value: 'unit', label: 'Unité (pièce)' },
];

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'expert', label: 'Expert' },
];

interface PackagingRow {
  label: string;
  quantity_per_unit: string;
  unit: string;
}

interface WasteFactorRow {
  pose_type: string;
  skill_level: string;
  factor_percent: string;
}

export interface MaterialFormData {
  name: string;
  category: string;
  unit: string;
  yield_per_unit: number;
  is_eco: boolean;
  eco_label_fr?: string;
  packagings: { label: string; quantity_per_unit: number; unit: string }[];
  waste_factors?: {
    pose_type: string;
    skill_level: string;
    factor_percent: number;
  }[];
}

interface MaterialFormProps {
  initialData?: {
    name: string;
    category: string;
    unit: string;
    yield_per_unit: number;
    is_eco?: boolean;
    eco_label_fr?: string | null;
    packagings: { label: string; quantity_per_unit: number; unit: string }[];
    waste_factors?: {
      pose_type: string;
      skill_level: string;
      factor_percent: number;
    }[];
  };
  onSubmit: (data: MaterialFormData) => Promise<void>;
  isLoading: boolean;
  submitLabel?: string;
}

export function MaterialForm({
  initialData,
  onSubmit,
  isLoading,
  submitLabel = 'Enregistrer',
}: MaterialFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [unit, setUnit] = useState(initialData?.unit ?? '');
  const [yieldPerUnit, setYieldPerUnit] = useState(
    initialData?.yield_per_unit?.toString() ?? '',
  );
  const [isEco, setIsEco] = useState(initialData?.is_eco ?? false);
  const [ecoLabelFr, setEcoLabelFr] = useState(
    initialData?.eco_label_fr ?? '',
  );

  const [packagings, setPackagings] = useState<PackagingRow[]>(
    initialData?.packagings?.map((p) => ({
      label: p.label,
      quantity_per_unit: p.quantity_per_unit.toString(),
      unit: p.unit,
    })) ?? [{ label: '', quantity_per_unit: '', unit: '' }],
  );

  const [wasteFactors, setWasteFactors] = useState<WasteFactorRow[]>(
    initialData?.waste_factors?.map((wf) => ({
      pose_type: wf.pose_type,
      skill_level: wf.skill_level,
      factor_percent: wf.factor_percent.toString(),
    })) ?? [],
  );

  const [error, setError] = useState('');

  const addPackaging = () =>
    setPackagings([...packagings, { label: '', quantity_per_unit: '', unit: '' }]);

  const removePackaging = (index: number) => {
    if (packagings.length <= 1) return;
    setPackagings(packagings.filter((_, i) => i !== index));
  };

  const updatePackaging = (
    index: number,
    field: keyof PackagingRow,
    value: string,
  ) => {
    const updated = [...packagings];
    updated[index] = { ...updated[index], [field]: value };
    setPackagings(updated);
  };

  const addWasteFactor = () =>
    setWasteFactors([
      ...wasteFactors,
      { pose_type: '', skill_level: '', factor_percent: '' },
    ]);

  const removeWasteFactor = (index: number) =>
    setWasteFactors(wasteFactors.filter((_, i) => i !== index));

  const updateWasteFactor = (
    index: number,
    field: keyof WasteFactorRow,
    value: string,
  ) => {
    const updated = [...wasteFactors];
    updated[index] = { ...updated[index], [field]: value };
    setWasteFactors(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !category || !unit || !yieldPerUnit) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (isEco && !ecoLabelFr.trim()) {
      setError(
        'Le libellé éco est requis lorsque le matériau est marqué éco-responsable.',
      );
      return;
    }

    const validPackagings = packagings.filter(
      (p) => p.label && p.quantity_per_unit && p.unit,
    );
    if (validPackagings.length === 0) {
      setError('Ajoutez au moins un conditionnement.');
      return;
    }

    const validWasteFactors = wasteFactors.filter(
      (wf) => wf.pose_type && wf.skill_level && wf.factor_percent,
    );

    try {
      await onSubmit({
        name,
        category,
        unit,
        yield_per_unit: parseFloat(yieldPerUnit),
        is_eco: isEco,
        eco_label_fr: isEco ? ecoLabelFr.trim() : undefined,
        packagings: validPackagings.map((p) => ({
          label: p.label,
          quantity_per_unit: parseFloat(p.quantity_per_unit),
          unit: p.unit,
        })),
        waste_factors:
          validWasteFactors.length > 0
            ? validWasteFactors.map((wf) => ({
                pose_type: wf.pose_type,
                skill_level: wf.skill_level,
                factor_percent: parseFloat(wf.factor_percent),
              }))
            : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-[var(--foreground)]/20 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none';
  const labelClass = 'block text-sm font-medium text-[var(--foreground)] mb-1';

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            maxLength={255}
            required
          />
        </div>
        <div>
          <label className={labelClass}>
            Catégorie <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">-- Choisir --</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Unité de mesure <span className="text-red-500">*</span>
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">-- Choisir --</option>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Rendement par unité <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={yieldPerUnit}
            onChange={(e) => setYieldPerUnit(e.target.value)}
            className={inputClass}
            step="0.0001"
            min="0.0001"
            required
          />
        </div>
      </div>

      {/* Éco-responsabilité (PLAT-3) */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={isEco}
            onChange={(e) => setIsEco(e.target.checked)}
            className="rounded"
          />
          Matériau éco-responsable
        </label>
        {isEco && (
          <div className="mt-2">
            <label className={labelClass}>
              Justification éco (affichée aux utilisateurs){' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ecoLabelFr}
              onChange={(e) => setEcoLabelFr(e.target.value)}
              placeholder="Ex: Peinture sans COV, écolabel NF Environnement"
              className={inputClass}
              maxLength={255}
            />
          </div>
        )}
      </div>

      {/* Packagings */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Conditionnements <span className="text-red-500">*</span>
        </h3>
        <div className="space-y-3">
          {packagings.map((pkg, index) => (
            <div key={index} className="flex items-start gap-3">
              <input
                type="text"
                placeholder="Label (ex: Pot 2.5 L)"
                value={pkg.label}
                onChange={(e) =>
                  updatePackaging(index, 'label', e.target.value)
                }
                className={`${inputClass} flex-1`}
              />
              <input
                type="number"
                placeholder="Quantité"
                value={pkg.quantity_per_unit}
                onChange={(e) =>
                  updatePackaging(index, 'quantity_per_unit', e.target.value)
                }
                className={`${inputClass} w-28`}
                step="0.0001"
                min="0.0001"
              />
              <input
                type="text"
                placeholder="Unité"
                value={pkg.unit}
                onChange={(e) =>
                  updatePackaging(index, 'unit', e.target.value)
                }
                className={`${inputClass} w-20`}
              />
              <button
                type="button"
                onClick={() => removePackaging(index)}
                disabled={packagings.length <= 1}
                className="mt-1 text-sm text-red-500 hover:text-red-700 disabled:opacity-30"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPackaging}
          className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          + Ajouter un conditionnement
        </button>
      </div>

      {/* Waste factors */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Facteurs de perte
        </h3>
        <div className="space-y-3">
          {wasteFactors.map((wf, index) => (
            <div key={index} className="flex items-start gap-3">
              <input
                type="text"
                placeholder="Type de pose"
                value={wf.pose_type}
                onChange={(e) =>
                  updateWasteFactor(index, 'pose_type', e.target.value)
                }
                className={`${inputClass} flex-1`}
              />
              <select
                value={wf.skill_level}
                onChange={(e) =>
                  updateWasteFactor(index, 'skill_level', e.target.value)
                }
                className={`${inputClass} w-40`}
              >
                <option value="">-- Niveau --</option>
                {SKILL_LEVELS.map((sl) => (
                  <option key={sl.value} value={sl.value}>
                    {sl.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="% perte"
                value={wf.factor_percent}
                onChange={(e) =>
                  updateWasteFactor(index, 'factor_percent', e.target.value)
                }
                className={`${inputClass} w-24`}
                step="0.01"
                min="0"
                max="100"
              />
              <button
                type="button"
                onClick={() => removeWasteFactor(index)}
                className="mt-1 text-sm text-red-500 hover:text-red-700"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addWasteFactor}
          className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          + Ajouter un facteur de perte
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {isLoading ? 'Enregistrement...' : submitLabel}
      </button>
    </form>
  );
}
