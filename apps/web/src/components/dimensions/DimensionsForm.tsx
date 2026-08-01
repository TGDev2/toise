'use client';

import { useCallback, useMemo, useState } from 'react';
import type { UnitSystem } from '@/lib/units';
import { metersToCm, cmToMeters, feetInchesToCm, cmToFeetInches } from '@/lib/units';
import type { Opening, RectSegment, ShapeSection, SurfaceExclusion } from '@/lib/surface';
import {
  wallArea,
  totalOpeningsArea,
  netWallArea,
  totalSurfaceArea,
  totalExclusionsArea,
  compositeFloorArea,
  compositeWallArea,
  compositeNetWallArea,
  sectionsToSegments,
  segmentsToSections,
} from '@/lib/surface';
import { getDimensionWarnings, getMissingFields } from '@/lib/dimension-validation';
import { DecimalInput, StickyActionBar } from '@/components/ui';
import { RoomPreview } from './RoomPreview';
import { OpeningsSection } from './OpeningsSection';
import { ExclusionsSection } from './ExclusionsSection';
import { ShapeSections } from './ShapeSections';

interface MetricValues {
  length: string;
  width: string;
  height: string;
}

interface ImperialValues {
  lengthFeet: string;
  lengthInches: string;
  widthFeet: string;
  widthInches: string;
  heightFeet: string;
  heightInches: string;
}

interface DimensionsFormProps {
  initialLengthCm?: number;
  initialWidthCm?: number;
  initialHeightCm?: number;
  initialOpenings?: Opening[];
  initialSegments?: RectSegment[];
  initialExclusions?: SurfaceExclusion[];
  /** CV-5 : dimensions mesurées par CV, badge d'incertitude affiché (mode métrique uniquement). */
  sourceIsCv?: boolean;
  lengthUncertaintyCm?: number | null;
  widthUncertaintyCm?: number | null;
  heightUncertaintyCm?: number | null;
  onSave: (
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    openings: Opening[],
    segments: RectSegment[],
    exclusions: SurfaceExclusion[],
  ) => Promise<void>;
  isSaving?: boolean;
  submitLabel?: string;
  savingLabel?: string;
}

// `text-base sm:text-sm` : sous 16 px, iOS Safari zoome à la prise de focus et
// oblige à dézoomer après chaque champ — soit trois fois rien que pour L/l/H.
const inputClass =
  'w-full min-h-12 rounded-2xl border border-stone-300 px-4 py-3 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

function uncertaintyHint(uncertaintyCm?: number | null): string | undefined {
  return uncertaintyCm && uncertaintyCm > 0
    ? `± ${Math.round(uncertaintyCm)} cm`
    : undefined;
}

function cmToMetricValues(lengthCm: number, widthCm: number, heightCm: number): MetricValues {
  return {
    length: lengthCm > 0 ? cmToMeters(lengthCm).toString() : '',
    width: widthCm > 0 ? cmToMeters(widthCm).toString() : '',
    height: heightCm > 0 ? cmToMeters(heightCm).toString() : '',
  };
}

function cmToImperialValues(lengthCm: number, widthCm: number, heightCm: number): ImperialValues {
  const l = cmToFeetInches(lengthCm);
  const w = cmToFeetInches(widthCm);
  const h = cmToFeetInches(heightCm);
  return {
    lengthFeet: lengthCm > 0 ? l.feet.toString() : '',
    lengthInches: lengthCm > 0 ? Math.round(l.inches).toString() : '',
    widthFeet: widthCm > 0 ? w.feet.toString() : '',
    widthInches: widthCm > 0 ? Math.round(w.inches).toString() : '',
    heightFeet: heightCm > 0 ? h.feet.toString() : '',
    heightInches: heightCm > 0 ? Math.round(h.inches).toString() : '',
  };
}

export function DimensionsForm({
  initialLengthCm = 0,
  initialWidthCm = 0,
  initialHeightCm = 0,
  initialOpenings = [],
  initialSegments,
  initialExclusions = [],
  sourceIsCv = false,
  lengthUncertaintyCm,
  widthUncertaintyCm,
  heightUncertaintyCm,
  onSave,
  isSaving = false,
  submitLabel = 'Enregistrer les dimensions',
  savingLabel = 'Enregistrement...',
}: DimensionsFormProps) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [metric, setMetric] = useState<MetricValues>(
    cmToMetricValues(initialLengthCm, initialWidthCm, initialHeightCm),
  );
  const [imperial, setImperial] = useState<ImperialValues>(
    cmToImperialValues(initialLengthCm, initialWidthCm, initialHeightCm),
  );
  const [touched, setTouched] = useState(false);
  const [openings, setOpenings] = useState<Opening[]>(initialOpenings);
  const [exclusions, setExclusions] = useState<SurfaceExclusion[]>(initialExclusions);
  const [sections, setSections] = useState<ShapeSection[]>(() =>
    initialSegments && initialSegments.length > 1
      ? segmentsToSections(initialLengthCm, initialWidthCm, initialSegments)
      : [],
  );
  const [showZeroOpeningsSuggestion, setShowZeroOpeningsSuggestion] = useState(false);

  const getCm = useCallback((): { lengthCm: number; widthCm: number; heightCm: number } => {
    if (unitSystem === 'metric') {
      return {
        lengthCm: Math.round(metersToCm(Number.parseFloat(metric.length) || 0)),
        widthCm: Math.round(metersToCm(Number.parseFloat(metric.width) || 0)),
        heightCm: Math.round(metersToCm(Number.parseFloat(metric.height) || 0)),
      };
    }
    return {
      lengthCm: Math.round(
        feetInchesToCm(
          Number.parseFloat(imperial.lengthFeet) || 0,
          Number.parseFloat(imperial.lengthInches) || 0,
        ),
      ),
      widthCm: Math.round(
        feetInchesToCm(
          Number.parseFloat(imperial.widthFeet) || 0,
          Number.parseFloat(imperial.widthInches) || 0,
        ),
      ),
      heightCm: Math.round(
        feetInchesToCm(
          Number.parseFloat(imperial.heightFeet) || 0,
          Number.parseFloat(imperial.heightInches) || 0,
        ),
      ),
    };
  }, [unitSystem, metric, imperial]);

  const { lengthCm, widthCm, heightCm } = getCm();

  const warnings = useMemo(
    () => getDimensionWarnings(lengthCm, widthCm, heightCm),
    [lengthCm, widthCm, heightCm],
  );

  const missingFields = useMemo(
    () => getMissingFields({ lengthCm, widthCm, heightCm }),
    [lengthCm, widthCm, heightCm],
  );

  const hasDimensions = lengthCm > 0 && widthCm > 0 && heightCm > 0;
  const isComposite = sections.length > 0;

  const segments = useMemo<RectSegment[]>(
    () =>
      hasDimensions && isComposite
        ? sectionsToSegments(lengthCm, widthCm, sections)
        : [],
    [hasDimensions, isComposite, lengthCm, widthCm, sections],
  );

  const floorCm2 = useMemo(() => {
    if (!hasDimensions) return 0;
    return isComposite ? compositeFloorArea(segments) : lengthCm * widthCm;
  }, [hasDimensions, isComposite, segments, lengthCm, widthCm]);

  const grossWallCm2 = useMemo(() => {
    if (!hasDimensions) return 0;
    return isComposite
      ? compositeWallArea(segments, heightCm)
      : wallArea(lengthCm, widthCm, heightCm);
  }, [hasDimensions, isComposite, segments, lengthCm, widthCm, heightCm]);

  const openingsAreaCm2 = useMemo(() => totalOpeningsArea(openings), [openings]);

  const exclusionsAreaCm2 = useMemo(
    () => totalExclusionsArea(exclusions, 'wall'),
    [exclusions],
  );

  const netWallAfterOpeningsCm2 = Math.max(0, grossWallCm2 - openingsAreaCm2);

  const netWallCm2 = useMemo(() => {
    if (!hasDimensions) return 0;
    return isComposite
      ? compositeNetWallArea(segments, heightCm, openings, exclusionsAreaCm2)
      : netWallArea(lengthCm, widthCm, heightCm, openings, exclusionsAreaCm2);
  }, [
    hasDimensions,
    isComposite,
    segments,
    lengthCm,
    widthCm,
    heightCm,
    openings,
    exclusionsAreaCm2,
  ]);

  const surfaceCm2 = useMemo(() => {
    if (!hasDimensions) return 0;
    return isComposite
      ? 2 * floorCm2 + grossWallCm2
      : totalSurfaceArea(lengthCm, widthCm, heightCm);
  }, [
    hasDimensions,
    isComposite,
    floorCm2,
    grossWallCm2,
    lengthCm,
    widthCm,
    heightCm,
  ]);

  const surfaceM2 = surfaceCm2 / 10_000;
  const isValid = missingFields.length === 0;

  const handleUnitChange = (newUnit: UnitSystem) => {
    if (newUnit === unitSystem) return;
    const cm = getCm();
    if (newUnit === 'imperial') {
      setImperial(cmToImperialValues(cm.lengthCm, cm.widthCm, cm.heightCm));
    } else {
      setMetric(cmToMetricValues(cm.lengthCm, cm.widthCm, cm.heightCm));
    }
    setUnitSystem(newUnit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    if (openings.length === 0 && !showZeroOpeningsSuggestion) {
      setShowZeroOpeningsSuggestion(true);
      return;
    }
    setShowZeroOpeningsSuggestion(false);
    await onSave(lengthCm, widthCm, heightCm, openings, segments, exclusions);
  };

  const handleAddOpening = useCallback((opening: Opening) => {
    setOpenings((prev) => [...prev, opening]);
    setShowZeroOpeningsSuggestion(false);
  }, []);

  const handleUpdateOpening = useCallback((index: number, opening: Opening) => {
    setOpenings((prev) => prev.map((o, i) => (i === index ? opening : o)));
  }, []);

  const handleRemoveOpening = useCallback((index: number) => {
    setOpenings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddExclusion = useCallback((exclusion: SurfaceExclusion) => {
    setExclusions((prev) => [...prev, exclusion]);
  }, []);

  const handleUpdateExclusion = useCallback(
    (index: number, exclusion: SurfaceExclusion) => {
      setExclusions((prev) => prev.map((e, i) => (i === index ? exclusion : e)));
    },
    [],
  );

  const handleRemoveExclusion = useCallback((index: number) => {
    setExclusions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSection = useCallback((section: ShapeSection) => {
    setSections((prev) => [...prev, section]);
  }, []);

  const handleUpdateSection = useCallback(
    (index: number, section: ShapeSection) => {
      setSections((prev) => prev.map((s, i) => (i === index ? section : s)));
    },
    [],
  );

  const handleRemoveSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const warningForField = (field: 'length' | 'width' | 'height') =>
    warnings.find((w) => w.field === field);

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      {/* Left column: form inputs */}
      <div className="space-y-6">
        {/* Unit selector */}
        <fieldset>
          <legend className="text-sm font-medium text-stone-700 mb-2">
            Système d&apos;unités
          </legend>
          <div className="flex gap-1 rounded-2xl bg-stone-100 p-1">
            {(['metric', 'imperial'] as const).map((unit) => (
              <label
                key={unit}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  unitSystem === unit
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <input
                  type="radio"
                  name="unit-system"
                  value={unit}
                  checked={unitSystem === unit}
                  onChange={() => handleUnitChange(unit)}
                  className="sr-only"
                />
                {unit === 'metric' ? 'Mètres' : 'Pieds / Pouces'}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Dimension inputs */}
        {unitSystem === 'metric' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricField
              label="Longueur (m)"
              id="length"
              value={metric.length}
              onChange={(v) => setMetric((p) => ({ ...p, length: v }))}
              warning={warningForField('length')}
              showError={touched && missingFields.includes('Longueur')}
              hint={sourceIsCv ? uncertaintyHint(lengthUncertaintyCm) : undefined}
            />
            <MetricField
              label="Largeur (m)"
              id="width"
              value={metric.width}
              onChange={(v) => setMetric((p) => ({ ...p, width: v }))}
              warning={warningForField('width')}
              showError={touched && missingFields.includes('Largeur')}
              hint={sourceIsCv ? uncertaintyHint(widthUncertaintyCm) : undefined}
            />
            <MetricField
              label="Hauteur (m)"
              id="height"
              value={metric.height}
              onChange={(v) => setMetric((p) => ({ ...p, height: v }))}
              warning={warningForField('height')}
              showError={touched && missingFields.includes('Hauteur')}
              hint={sourceIsCv ? uncertaintyHint(heightUncertaintyCm) : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ImperialField
              label="Longueur"
              idPrefix="length"
              feet={imperial.lengthFeet}
              inches={imperial.lengthInches}
              onFeetChange={(v) => setImperial((p) => ({ ...p, lengthFeet: v }))}
              onInchesChange={(v) => setImperial((p) => ({ ...p, lengthInches: v }))}
              warning={warningForField('length')}
              showError={touched && missingFields.includes('Longueur')}
            />
            <ImperialField
              label="Largeur"
              idPrefix="width"
              feet={imperial.widthFeet}
              inches={imperial.widthInches}
              onFeetChange={(v) => setImperial((p) => ({ ...p, widthFeet: v }))}
              onInchesChange={(v) => setImperial((p) => ({ ...p, widthInches: v }))}
              warning={warningForField('width')}
              showError={touched && missingFields.includes('Largeur')}
            />
            <ImperialField
              label="Hauteur"
              idPrefix="height"
              feet={imperial.heightFeet}
              inches={imperial.heightInches}
              onFeetChange={(v) => setImperial((p) => ({ ...p, heightFeet: v }))}
              onInchesChange={(v) => setImperial((p) => ({ ...p, heightInches: v }))}
              warning={warningForField('height')}
              showError={touched && missingFields.includes('Hauteur')}
            />
          </div>
        )}

        {/* Openings section */}
        <OpeningsSection
          openings={openings}
          onAdd={handleAddOpening}
          onUpdate={handleUpdateOpening}
          onRemove={handleRemoveOpening}
          grossWallAreaCm2={grossWallCm2}
        />

        {/* Surfaces à exclure (crédence, demi-mur, plinthes…) */}
        <ExclusionsSection
          exclusions={exclusions}
          onAdd={handleAddExclusion}
          onUpdate={handleUpdateExclusion}
          onRemove={handleRemoveExclusion}
          netWallAreaCm2={netWallAfterOpeningsCm2}
        />

        {/* Non-rectangular room sections (décroché) */}
        <ShapeSections
          sections={sections}
          onAdd={handleAddSection}
          onUpdate={handleUpdateSection}
          onRemove={handleRemoveSection}
        />

        {showZeroOpeningsSuggestion && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              Vous n&apos;avez pas ajoute de portes ou fenêtres. Souhaitez-vous continuer ?
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={() => setShowZeroOpeningsSuggestion(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
              >
                Ajouter des ouvertures
              </button>
            </div>
          </div>
        )}

        {/*
          Le CTA était en fin de colonne : avec deux portes, une fenêtre et une
          exclusion, il tombait à ~1400 px de scroll sur un écran de 390 px.
          Collé en bas, il reste sous le pouce quelle que soit la longueur du
          formulaire — et le récapitulatif de surface le suit, pour valider une
          mesure sans avoir à remonter.
        */}
        <StickyActionBar
          summary={
            surfaceM2 > 0 ? (
              <p className="text-sm text-stone-600 sm:hidden">
                Surface estimée{' '}
                <span className="font-semibold text-stone-900">
                  {surfaceM2.toFixed(2).replace('.', ',')} m²
                </span>
              </p>
            ) : undefined
          }
        >
          <button
            type="submit"
            disabled={isSaving || (touched && !isValid)}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? savingLabel : submitLabel}
          </button>
        </StickyActionBar>
      </div>

      {/* Right column: preview + surface */}
      <div className="space-y-4">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-4">
          <RoomPreview
            lengthCm={lengthCm}
            widthCm={widthCm}
            unitSystem={unitSystem}
            openings={openings}
            segments={segments}
            className="w-full"
          />
        </div>

        {surfaceM2 > 0 && (
          <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Surface totale estimée
            </p>
            <p className="text-2xl font-semibold text-stone-900">
              {surfaceM2.toFixed(1)} m&sup2;
            </p>
            <p className="text-xs text-stone-500">
              Sol + plafond + 4 murs
            </p>

            {grossWallCm2 > 0 && (
              <div className="border-t border-stone-200 pt-3 space-y-1">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Surface brute des murs</span>
                  <span>{(grossWallCm2 / 10_000).toFixed(1)} m&sup2;</span>
                </div>
                {openingsAreaCm2 > 0 && (
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>Ouvertures</span>
                    <span>- {(openingsAreaCm2 / 10_000).toFixed(1)} m&sup2;</span>
                  </div>
                )}
                {exclusionsAreaCm2 > 0 && (
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>Zones exclues</span>
                    <span>- {(exclusionsAreaCm2 / 10_000).toFixed(1)} m&sup2;</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-stone-900">
                  <span>Surface nette des murs</span>
                  <span>{(netWallCm2 / 10_000).toFixed(1)} m&sup2;</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

/* ---- Sub-components ---- */

interface MetricFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  warning?: { message: string };
  showError: boolean;
  /** Incertitude de mesure CV-5, ex. « ± 8 cm ». */
  hint?: string;
}

function MetricField({ label, id, value, onChange, warning, showError, hint }: MetricFieldProps) {
  const errorId = `${id}-error`;
  const warningId = `${id}-warning`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {hint && <span className="ml-1.5 font-normal text-stone-400">{hint}</span>}
      </label>
      {/*
        PRO-5 : `DecimalInput` (type=text + inputMode=decimal) et non
        `type="number"` — sur un clavier français la touche décimale est une
        virgule, que `type="number"` rejette en renvoyant une chaîne vide.
        « 3,5 m » se transformait donc en 0 m sans le moindre signal.
      */}
      <DecimalInput
        id={id}
        value={value}
        onValueChange={onChange}
        enterKeyHint="next"
        aria-describedby={showError ? errorId : warning ? warningId : undefined}
        className={inputClass}
      />
      {showError && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          Ce champ est obligatoire
        </p>
      )}
      {!showError && warning && (
        <p id={warningId} role="alert" className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
          {warning.message}
        </p>
      )}
    </div>
  );
}

interface ImperialFieldProps {
  label: string;
  idPrefix: string;
  feet: string;
  inches: string;
  onFeetChange: (value: string) => void;
  onInchesChange: (value: string) => void;
  warning?: { message: string };
  showError: boolean;
}

function ImperialField({
  label,
  idPrefix,
  feet,
  inches,
  onFeetChange,
  onInchesChange,
  warning,
  showError,
}: ImperialFieldProps) {
  const errorId = `${idPrefix}-error`;
  const warningId = `${idPrefix}-warning`;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`${idPrefix}-feet`} className="sr-only">
            {label} (pieds)
          </label>
          <input
            id={`${idPrefix}-feet`}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="pi"
            value={feet}
            onChange={(e) => onFeetChange(e.target.value)}
            aria-describedby={showError ? errorId : warning ? warningId : undefined}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`${idPrefix}-inches`} className="sr-only">
            {label} (pouces)
          </label>
          <input
            id={`${idPrefix}-inches`}
            type="number"
            inputMode="numeric"
            min="0"
            max="11"
            step="1"
            placeholder="po"
            value={inches}
            onChange={(e) => onInchesChange(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          Ce champ est obligatoire
        </p>
      )}
      {!showError && warning && (
        <p id={warningId} role="alert" className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
          {warning.message}
        </p>
      )}
    </div>
  );
}
