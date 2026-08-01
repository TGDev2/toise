'use client';

import { useCallback, useState } from 'react';
import type {
  WorkTypeRef,
  WorkItemSelection,
  SavedWorkItem,
} from '@/lib/work-types';
import { SKILL_LEVELS, WORK_TYPE_ICONS } from '@/lib/work-types';
import { StickyActionBar } from '@/components/ui';
import { ContextualQuestions } from './ContextualQuestions';

interface WorkSelectionFormProps {
  workTypes: WorkTypeRef[];
  initialSelections?: SavedWorkItem[];
  onSave: (items: WorkItemSelection[]) => Promise<void>;
  isSaving: boolean;
}

export function WorkSelectionForm({
  workTypes,
  initialSelections = [],
  onSave,
  isSaving,
}: WorkSelectionFormProps) {
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(() => {
    return new Set(initialSelections.map((s) => s.work_type.id));
  });

  const [skillLevel, setSkillLevel] = useState<string>(() => {
    return initialSelections[0]?.skill_level ?? '';
  });

  const [customParams, setCustomParams] = useState<
    Record<string, Record<string, unknown>>
  >(() => {
    const params: Record<string, Record<string, unknown>> = {};
    for (const s of initialSelections) {
      if (Object.keys(s.custom_params).length > 0) {
        params[s.work_type.id] = s.custom_params;
      }
    }
    return params;
  });

  const [touched, setTouched] = useState(false);

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

  const hasAllRequiredContextualParams = useCallback(() => {
    for (const typeId of selectedTypeIds) {
      const wt = workTypes.find((w) => w.id === typeId);
      if (!wt) continue;
      const required = wt.contextual_questions.filter((q) => q.required);
      for (const q of required) {
        const val = customParams[typeId]?.[q.key];
        if (!val || val === '') return false;
      }
    }
    return true;
  }, [selectedTypeIds, workTypes, customParams]);

  const canSubmit = isValid && hasAllRequiredContextualParams();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched(true);
      if (!canSubmit) return;

      const items: WorkItemSelection[] = Array.from(selectedTypeIds).map(
        (typeId) => ({
          work_type_id: typeId,
          skill_level: skillLevel,
          custom_params: customParams[typeId] ?? {},
        }),
      );

      await onSave(items);
    },
    [canSubmit, selectedTypeIds, skillLevel, customParams, onSave],
  );

  const skillLevelInfo = SKILL_LEVELS.find((s) => s.value === skillLevel);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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
              </div>
            );
          })}
        </div>

        {touched && selectedTypeIds.size === 0 && (
          <p className="mt-3 text-sm text-red-600">
            Veuillez sélectionner au moins un type de travaux.
          </p>
        )}
      </div>

      {/* Skill level */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-stone-900">
          Niveau de competence
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
            Veuillez sélectionner votre niveau de competence.
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
