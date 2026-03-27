'use client';

import type { UnitSystem } from '@/lib/units';
import { cmToMeters, cmToFeetInches } from '@/lib/units';

interface RoomPreviewProps {
  lengthCm: number;
  widthCm: number;
  unitSystem: UnitSystem;
  className?: string;
}

function formatDimension(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}' ${Math.round(inches)}"`;
  }
  return `${cmToMeters(cm).toFixed(2)} m`;
}

export function RoomPreview({
  lengthCm,
  widthCm,
  unitSystem,
  className = '',
}: RoomPreviewProps) {
  const isValid = lengthCm > 0 && widthCm > 0;

  const viewBoxW = 400;
  const viewBoxH = 300;
  const padding = 50;

  const maxW = viewBoxW - padding * 2;
  const maxH = viewBoxH - padding * 2;

  let rectW = maxW;
  let rectH = maxH;

  if (isValid) {
    const ratio = lengthCm / widthCm;
    if (ratio > maxW / maxH) {
      rectW = maxW;
      rectH = maxW / ratio;
    } else {
      rectH = maxH;
      rectW = maxH * ratio;
    }
  }

  const rectX = (viewBoxW - rectW) / 2;
  const rectY = (viewBoxH - rectH) / 2;

  const ariaLabel = isValid
    ? `Vue de dessus de la piece : ${formatDimension(lengthCm, unitSystem)} x ${formatDimension(widthCm, unitSystem)}`
    : 'Apercu de la piece (dimensions non definies)';

  return (
    <svg
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      {isValid ? (
        <>
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            fill="#fafaf9"
            stroke="#a8a29e"
            strokeWidth="2"
          />
          {/* Length label (bottom) */}
          <text
            x={viewBoxW / 2}
            y={rectY + rectH + 30}
            textAnchor="middle"
            className="fill-stone-700 text-xs"
            fontSize="13"
          >
            {formatDimension(lengthCm, unitSystem)}
          </text>
          {/* Width label (right) */}
          <text
            x={rectX + rectW + 30}
            y={viewBoxH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-stone-700 text-xs"
            fontSize="13"
            transform={`rotate(90, ${rectX + rectW + 30}, ${viewBoxH / 2})`}
          >
            {formatDimension(widthCm, unitSystem)}
          </text>
        </>
      ) : (
        <>
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            fill="none"
            stroke="#a8a29e"
            strokeWidth="2"
            strokeDasharray="8 4"
          />
          <text
            x={viewBoxW / 2}
            y={viewBoxH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-stone-400"
            fontSize="14"
          >
            Saisissez les dimensions
          </text>
        </>
      )}
    </svg>
  );
}
