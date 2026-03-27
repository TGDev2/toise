'use client';

import { useCallback, useMemo, useState } from 'react';
import type { UnitSystem } from '@/lib/units';
import { metersToCm, cmToMeters, feetInchesToCm, cmToFeetInches } from '@/lib/units';
import { totalSurfaceArea } from '@/lib/surface';
import { getDimensionWarnings, getMissingFields } from '@/lib/dimension-validation';
import { RoomPreview } from './RoomPreview';

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
  onSave: (lengthCm: number, widthCm: number, heightCm: number) => Promise<void>;
  isSaving?: boolean;
}

const inputClass =
  'w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

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
  onSave,
  isSaving = false,
}: DimensionsFormProps) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [metric, setMetric] = useState<MetricValues>(
    cmToMetricValues(initialLengthCm, initialWidthCm, initialHeightCm),
  );
  const [imperial, setImperial] = useState<ImperialValues>(
    cmToImperialValues(initialLengthCm, initialWidthCm, initialHeightCm),
  );
  const [touched, setTouched] = useState(false);

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

  const surfaceCm2 = useMemo(() => {
    if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
      return totalSurfaceArea(lengthCm, widthCm, heightCm);
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);

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
    await onSave(lengthCm, widthCm, heightCm);
  };

  const warningForField = (field: 'length' | 'width' | 'height') =>
    warnings.find((w) => w.field === field);

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      {/* Left column: form inputs */}
      <div className="space-y-6">
        {/* Unit selector */}
        <fieldset>
          <legend className="text-sm font-medium text-stone-700 mb-2">
            Systeme d&apos;unites
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
                {unit === 'metric' ? 'Metres' : 'Pieds / Pouces'}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Dimension inputs */}
        {unitSystem === 'metric' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricField
              label="Longueur (m)"
              id="length"
              value={metric.length}
              onChange={(v) => setMetric((p) => ({ ...p, length: v }))}
              warning={warningForField('length')}
              showError={touched && missingFields.includes('Longueur')}
            />
            <MetricField
              label="Largeur (m)"
              id="width"
              value={metric.width}
              onChange={(v) => setMetric((p) => ({ ...p, width: v }))}
              warning={warningForField('width')}
              showError={touched && missingFields.includes('Largeur')}
            />
            <MetricField
              label="Hauteur (m)"
              id="height"
              value={metric.height}
              onChange={(v) => setMetric((p) => ({ ...p, height: v }))}
              warning={warningForField('height')}
              showError={touched && missingFields.includes('Hauteur')}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
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

        <button
          type="submit"
          disabled={isSaving || (touched && !isValid)}
          className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer les dimensions'}
        </button>
      </div>

      {/* Right column: preview + surface */}
      <div className="space-y-4">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-4">
          <RoomPreview
            lengthCm={lengthCm}
            widthCm={widthCm}
            unitSystem={unitSystem}
            className="w-full"
          />
        </div>

        {surfaceM2 > 0 && (
          <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Surface totale estimee
            </p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">
              {surfaceM2.toFixed(1)} m&sup2;
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Sol + plafond + 4 murs
            </p>
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
}

function MetricField({ label, id, value, onChange, warning, showError }: MetricFieldProps) {
  const errorId = `${id}-error`;
  const warningId = `${id}-warning`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
