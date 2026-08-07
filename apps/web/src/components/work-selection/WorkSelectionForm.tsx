'use client';

import { useCallback, useState } from 'react';
import type {
  WorkTypeRef,
  WorkItemSelection,
  SavedWorkItem,
  WorkSelectionSuggestion,
} from '@/lib/work-types';
import { SKILL_LEVELS, WORK_TYPE_ICONS, DECLARED_QUANTITY_BASIS } from '@/lib/work-types';
import { DecimalInput, StickyActionBar } from '@/components/ui';
import { ContextualQuestions } from './ContextualQuestions';

interface WorkSelectionFormProps {
  workTypes: WorkTypeRef[];
  initialSelections?: SavedWorkItem[];
  /**
   * E4-4 — reprise de la pièce précédente ou du dernier chantier, appliquée
   * **uniquement** à une pièce encore vierge : ce que l'artisan a déjà
   * enregistré pour cette pièce prime toujours.
   */
  suggestion?: WorkSelectionSuggestion;
  /** E1-4 — hauteur de la pièce active, en mètres. Préremplit la hauteur de cloison. */
  roomHeightM?: number;
  onSave: (items: WorkItemSelection[]) => Promise<void>;
  isSaving: boolean;
}

interface DeclaredBasisValues {
  length_m: string;
  height_m: string;
  clad_faces: string;
}

const CLAD_FACES_OPTIONS = [
  { value: '2', label: 'Cloison, deux faces' },
  { value: '1', label: 'Doublage, une face' },
] as const;

const declaredFieldInputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none';

interface DeclaredBasisFieldsProps {
  workTypeId: string;
  values: DeclaredBasisValues;
  onChange: (field: keyof DeclaredBasisValues, value: string) => void;
  showErrors: boolean;
}

/**
 * E1-4 — assiette d'un ouvrage qu'on crée plutôt qu'on ne recouvre
 * (aujourd'hui : la cloison sèche). Réutilise `DecimalInput` (déjà le
 * composant de saisie décimale du tunnel, cf. `DimensionsForm`) et le motif
 * carte radio déjà utilisé ci-dessous pour le niveau de compétence.
 */
function DeclaredBasisFields({
  workTypeId,
  values,
  onChange,
  showErrors,
}: DeclaredBasisFieldsProps) {
  const length = Number.parseFloat(values.length_m);
  const height = Number.parseFloat(values.height_m);
  const lengthInvalid = !values.length_m || !Number.isFinite(length) || length <= 0;
  const heightInvalid = !values.height_m || !Number.isFinite(height) || height <= 0;
  const facesInvalid = values.clad_faces !== '1' && values.clad_faces !== '2';

  const lengthId = `declared-length-m-${workTypeId}`;
  const heightId = `declared-height-m-${workTypeId}`;

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div>
        <label
          htmlFor={lengthId}
          className="mb-1 block text-sm font-medium text-stone-700"
        >
          Linéaire à créer (m)
          <span className="ml-1 text-red-500">*</span>
        </label>
        <DecimalInput
          id={lengthId}
          value={values.length_m}
          onValueChange={(v) => onChange('length_m', v)}
          className={declaredFieldInputClass}
        />
        {showErrors && lengthInvalid && (
          <p className="mt-1 text-sm text-red-600">
            Veuillez indiquer un linéaire supérieur à zéro.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={heightId}
          className="mb-1 block text-sm font-medium text-stone-700"
        >
          Hauteur (m)
          <span className="ml-1 text-red-500">*</span>
        </label>
        <DecimalInput
          id={heightId}
          value={values.height_m}
          onValueChange={(v) => onChange('height_m', v)}
          className={declaredFieldInputClass}
        />
        {showErrors && heightInvalid && (
          <p className="mt-1 text-sm text-red-600">
            Veuillez indiquer une hauteur supérieure à zéro.
          </p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700">
          Faces à parementer
          <span className="ml-1 text-red-500">*</span>
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          {CLAD_FACES_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                values.clad_faces === opt.value
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name={`declared-clad-faces-${workTypeId}`}
                value={opt.value}
                checked={values.clad_faces === opt.value}
                onChange={(e) => onChange('clad_faces', e.target.value)}
                className="accent-[var(--accent)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Choisissez « cloison » pour une paroi neuve visible des deux côtés,
          et « doublage » pour habiller un mur existant d&rsquo;un seul côté.
        </p>
        {showErrors && facesInvalid && (
          <p className="mt-1 text-sm text-red-600">
            Veuillez choisir le nombre de faces à parementer.
          </p>
        )}
      </div>
    </div>
  );
}

export function WorkSelectionForm({
  workTypes,
  initialSelections = [],
  suggestion,
  roomHeightM,
  onSave,
  isSaving,
}: WorkSelectionFormProps) {
  const applied = initialSelections.length === 0 ? suggestion : undefined;

  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(() => {
    if (applied) return new Set(applied.work_type_ids);
    return new Set(initialSelections.map((s) => s.work_type.id));
  });

  const [skillLevel, setSkillLevel] = useState<string>(() => {
    if (applied) return applied.skill_level;
    return initialSelections[0]?.skill_level ?? '';
  });

  const [customParams, setCustomParams] = useState<
    Record<string, Record<string, unknown>>
  >(() => {
    if (applied) return { ...applied.custom_params };
    const params: Record<string, Record<string, unknown>> = {};
    for (const s of initialSelections) {
      if (Object.keys(s.custom_params).length > 0) {
        params[s.work_type.id] = s.custom_params;
      }
    }
    return params;
  });

  const [declaredBasis, setDeclaredBasis] = useState<
    Record<string, DeclaredBasisValues>
  >(() => {
    const result: Record<string, DeclaredBasisValues> = {};
    for (const s of initialSelections) {
      if (
        s.declared_length_m != null ||
        s.declared_height_m != null ||
        s.declared_clad_faces != null
      ) {
        result[s.work_type.id] = {
          length_m: s.declared_length_m != null ? String(s.declared_length_m) : '',
          height_m: s.declared_height_m != null ? String(s.declared_height_m) : '',
          clad_faces:
            s.declared_clad_faces != null ? String(s.declared_clad_faces) : '',
        };
      }
    }
    return result;
  });

  const [touched, setTouched] = useState(false);

  /**
   * Valeurs effectives d'un ouvrage à assiette déclarée : ce qui a été saisi,
   * ou à défaut la hauteur de la pièce pour `height_m` — jamais une chaîne
   * vide écrite en dur, qui écraserait ce repli au prochain rendu.
   */
  const getDeclaredBasisValue = useCallback(
    (typeId: string): DeclaredBasisValues => {
      const stored = declaredBasis[typeId];
      return {
        length_m: stored?.length_m ?? '',
        height_m:
          stored?.height_m ?? (roomHeightM != null ? String(roomHeightM) : ''),
        clad_faces: stored?.clad_faces ?? '',
      };
    },
    [declaredBasis, roomHeightM],
  );

  const handleDeclaredBasisChange = useCallback(
    (workTypeId: string, field: keyof DeclaredBasisValues, value: string) => {
      setDeclaredBasis((prev) => ({
        ...prev,
        [workTypeId]: { ...getDeclaredBasisValue(workTypeId), [field]: value },
      }));
    },
    [getDeclaredBasisValue],
  );

  const toggleWorkType = useCallback((id: string) => {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleContextualChange = useCallback(
    (workTypeId: string, key: string, value: string) => {
      setCustomParams((prev) => ({
        ...prev,
        [workTypeId]: {
          ...(prev[workTypeId] ?? {}),
          [key]: value,
        },
      }));
    },
    [],
  );

  const isValid = selectedTypeIds.size > 0 && skillLevel !== '';

  /**
   * Les ouvrages dont une question requise reste sans réponse, par leur libellé.
   *
   * E1-7 — la liste, et non un booléen. « Calculer » se désactive dès le premier
   * clic quand une réponse manque, et jusqu'ici **sans rien dire** : l'écran
   * porte un message pour l'absence d'ouvrage et un pour l'absence de niveau,
   * aucun pour une question restée sur « -- Choisir -- ». La revue d'E1-6 avait
   * déjà nommé la variante cloison sèche du même défaut (« dont la validation
   * bloque Calculer sans rien dire »).
   *
   * Ce lot le rend franchement visible en donnant une question requise au
   * carrelage mural et au parquet : deux ouvrages de plus derrière un bouton
   * qui s'éteint sans motif. D'où le message ci-dessous, qui nomme l'ouvrage —
   * sur un écran à sept tuiles, « une réponse manque » n'aiderait personne.
   */
  const workTypesMissingParams = useCallback((): string[] => {
    const missing: string[] = [];
    for (const typeId of selectedTypeIds) {
      const wt = workTypes.find((w) => w.id === typeId);
      if (!wt) continue;
      const required = wt.contextual_questions.filter((q) => q.required);
      for (const q of required) {
        const val = customParams[typeId]?.[q.key];
        if (!val || val === '') {
          missing.push(wt.label_fr);
          break;
        }
      }
    }
    return missing;
  }, [selectedTypeIds, workTypes, customParams]);

  const hasAllRequiredContextualParams = useCallback(
    () => workTypesMissingParams().length === 0,
    [workTypesMissingParams],
  );

  const hasValidDeclaredBasis = useCallback(() => {
    for (const typeId of selectedTypeIds) {
      const wt = workTypes.find((w) => w.id === typeId);
      if (!wt || wt.quantity_basis !== DECLARED_QUANTITY_BASIS) continue;
      const basis = getDeclaredBasisValue(typeId);
      const length = Number.parseFloat(basis.length_m);
      const height = Number.parseFloat(basis.height_m);
      if (!basis.length_m || !Number.isFinite(length) || length <= 0) return false;
      if (!basis.height_m || !Number.isFinite(height) || height <= 0) return false;
      if (basis.clad_faces !== '1' && basis.clad_faces !== '2') return false;
    }
    return true;
  }, [selectedTypeIds, workTypes, getDeclaredBasisValue]);

  const canSubmit =
    isValid && hasAllRequiredContextualParams() && hasValidDeclaredBasis();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched(true);
      if (!canSubmit) return;

      const items: WorkItemSelection[] = Array.from(selectedTypeIds).map(
        (typeId) => {
          const wt = workTypes.find((w) => w.id === typeId);
          const item: WorkItemSelection = {
            work_type_id: typeId,
            skill_level: skillLevel,
            custom_params: customParams[typeId] ?? {},
          };
          if (wt?.quantity_basis === DECLARED_QUANTITY_BASIS) {
            const basis = getDeclaredBasisValue(typeId);
            item.declared_length_m = Number.parseFloat(basis.length_m);
            item.declared_height_m = Number.parseFloat(basis.height_m);
            item.declared_clad_faces = Number.parseInt(basis.clad_faces, 10);
          }
          return item;
        },
      );

      await onSave(items);
    },
    [
      canSubmit,
      selectedTypeIds,
      workTypes,
      skillLevel,
      customParams,
      getDeclaredBasisValue,
      onSave,
    ],
  );

  const skillLevelInfo = SKILL_LEVELS.find((s) => s.value === skillLevel);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/*
        E4-4 : la reprise est annoncée. Des tuiles pré-cochées sans un mot
        seraient un choix que l'artisan n'a pas fait — et `skill_level` change
        les quantités.
      */}
      {applied && (
        <p className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm text-stone-700">
          Repris de{' '}
          <span className="font-semibold text-stone-900">
            {applied.source === 'room'
              ? 'la pièce précédente'
              : 'votre dernier chantier'}
          </span>{' '}
          — modifiable.
        </p>
      )}

      {/* Work type selection */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-stone-900">
          Type de travaux
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Sélectionnez un ou plusieurs types de travaux prévus.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {workTypes.map((wt) => {
            const isSelected = selectedTypeIds.has(wt.id);
            return (
              <div key={wt.id}>
                <button
                  type="button"
                  onClick={() => toggleWorkType(wt.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-md'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-2xl" role="img" aria-label={wt.label_fr}>
                    {WORK_TYPE_ICONS[wt.code] ?? '\u{1F527}'}
                  </span>
                  <span className="text-sm font-medium text-stone-800">
                    {wt.label_fr}
                  </span>
                </button>

                {isSelected &&
                  wt.contextual_questions.length > 0 && (
                    <ContextualQuestions
                      questions={wt.contextual_questions}
                      values={customParams[wt.id] ?? {}}
                      onChange={(key, value) =>
                        handleContextualChange(wt.id, key, value)
                      }
                    />
                  )}

                {isSelected && wt.quantity_basis === DECLARED_QUANTITY_BASIS && (
                  <DeclaredBasisFields
                    workTypeId={wt.id}
                    values={getDeclaredBasisValue(wt.id)}
                    onChange={(field, value) =>
                      handleDeclaredBasisChange(wt.id, field, value)
                    }
                    showErrors={touched}
                  />
                )}
              </div>
            );
          })}
        </div>

        {touched && selectedTypeIds.size === 0 && (
          <p className="mt-3 text-sm text-red-600">
            Veuillez sélectionner au moins un type de travaux.
          </p>
        )}

        {touched && workTypesMissingParams().length > 0 && (
          <p className="mt-3 text-sm text-red-600">
            Répondez aux questions marquées d’une étoile pour :{' '}
            {workTypesMissingParams().join(', ')}.
          </p>
        )}
      </div>

      {/* Skill level */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-stone-900">
          Niveau de compétence
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          {SKILL_LEVELS.map((level) => {
            const isSelected = skillLevel === level.value;
            return (
              <label
                key={level.value}
                className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-md'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="skill_level"
                  value={level.value}
                  checked={isSelected}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm font-medium text-stone-800">
                  {level.label}
                </span>
              </label>
            );
          })}
        </div>

        {skillLevelInfo?.description && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {skillLevelInfo.description}
          </p>
        )}

        {touched && skillLevel === '' && (
          <p className="mt-3 text-sm text-red-600">
            Veuillez sélectionner votre niveau de compétence.
          </p>
        )}
      </div>

      {/*
        Le CTA vivait dans un `flex justify-end`, donc collé au bord droit sous
        ~900 px de tuiles à 390 px. Barre collante, pleine largeur sur mobile.
      */}
      <StickyActionBar>
        <button
          type="submit"
          disabled={isSaving || (touched && !canSubmit)}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement...' : 'Calculer'}
        </button>
      </StickyActionBar>
    </form>
  );
}
