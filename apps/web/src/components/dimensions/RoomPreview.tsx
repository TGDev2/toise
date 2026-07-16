'use client';

import type { UnitSystem } from '@/lib/units';
import type { Opening } from '@/lib/surface';
import { cmToMeters, cmToFeetInches } from '@/lib/units';

interface RoomPreviewProps {
  lengthCm: number;
  widthCm: number;
  unitSystem: UnitSystem;
  openings?: Opening[];
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
  openings = [],
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
    ? `Vue de dessus de la pièce : ${formatDimension(lengthCm, unitSystem)} x ${formatDimension(widthCm, unitSystem)}`
    : 'Aperçu de la pièce (dimensions non définies)';

  // Compute opening indicators along walls
  const doors = openings.filter((o) => o.type === 'door');
  const windows = openings.filter((o) => o.type === 'window');

  // Scale factor: pixels per cm (based on length for bottom wall)
  const pxPerCmLength = isValid ? rectW / lengthCm : 0;
  const pxPerCmWidth = isValid ? rectH / widthCm : 0;

  // Place doors along bottom wall, windows along left wall
  function getDoorIndicators() {
    if (!isValid) return [];
    const indicators: Array<{ x: number; y: number; w: number; key: string }> = [];
    let offset = 20; // start offset in px from left edge of bottom wall
    for (let di = 0; di < doors.length; di++) {
      const door = doors[di];
      for (let ci = 0; ci < door.count; ci++) {
        const w = door.width_cm * pxPerCmLength;
        const clampedW = Math.min(w, rectW * 0.3);
        if (offset + clampedW > rectW - 10) break;
        indicators.push({
          x: rectX + offset,
          y: rectY + rectH,
          w: clampedW,
          key: `door-${di}-${ci}`,
        });
        offset += clampedW + 10;
      }
    }
    return indicators;
  }

  function getWindowIndicators() {
    if (!isValid) return [];
    const indicators: Array<{ x: number; y: number; h: number; key: string }> = [];
    let offset = 20;
    for (let wi = 0; wi < windows.length; wi++) {
      const win = windows[wi];
      for (let ci = 0; ci < win.count; ci++) {
        const h = win.width_cm * pxPerCmWidth;
        const clampedH = Math.min(h, rectH * 0.3);
        if (offset + clampedH > rectH - 10) break;
        indicators.push({
          x: rectX,
          y: rectY + offset,
          h: clampedH,
          key: `window-${wi}-${ci}`,
        });
        offset += clampedH + 10;
      }
    }
    return indicators;
  }

  const doorIndicators = getDoorIndicators();
  const windowIndicators = getWindowIndicators();

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

          {/* Door indicators on bottom wall */}
          {doorIndicators.map((d) => {
            const arcR = Math.min(d.w, 20);
            return (
              <g key={d.key}>
                {/* Gap in wall */}
                <line
                  x1={d.x}
                  y1={d.y}
                  x2={d.x + d.w}
                  y2={d.y}
                  stroke="#fafaf9"
                  strokeWidth="4"
                />
                {/* Door arc */}
                <path
                  d={`M ${d.x} ${d.y} A ${arcR} ${arcR} 0 0 0 ${d.x + arcR} ${d.y + arcR}`}
                  fill="none"
                  stroke="#78716c"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                {/* Door leaf line */}
                <line
                  x1={d.x}
                  y1={d.y}
                  x2={d.x}
                  y2={d.y + arcR}
                  stroke="#78716c"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* Window indicators on left wall */}
          {windowIndicators.map((w) => (
            <g key={w.key}>
              {/* Gap in wall */}
              <line
                x1={w.x}
                y1={w.y}
                x2={w.x}
                y2={w.y + w.h}
                stroke="#fafaf9"
                strokeWidth="4"
              />
              {/* Window triple-line symbol */}
              <line
                x1={w.x - 3}
                y1={w.y}
                x2={w.x - 3}
                y2={w.y + w.h}
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
              <line
                x1={w.x}
                y1={w.y}
                x2={w.x}
                y2={w.y + w.h}
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
              <line
                x1={w.x + 3}
                y1={w.y}
                x2={w.x + 3}
                y2={w.y + w.h}
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
            </g>
          ))}

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
