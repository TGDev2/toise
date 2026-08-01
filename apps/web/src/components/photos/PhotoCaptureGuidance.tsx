'use client';

interface CaptureTip {
  title: string;
  text: string;
}

// BACKLOG CV-4 : conseils avant capture (angles, recul, lumiere, porte visible).
export const CAPTURE_TIPS: CaptureTip[] = [
  {
    title: 'Angles',
    text: 'Photographiez depuis les coins opposés de la pièce, en incluant le sol et le plafond.',
  },
  {
    title: 'Recul',
    text: 'Reculez-vous suffisamment pour capturer chaque mur en entier, sans zoomer.',
  },
  {
    title: 'Lumière',
    text: 'Privilégiez un bon éclairage naturel, évitez les contre-jours et le flash direct.',
  },
  {
    title: 'Porte visible',
    text: 'Gardez si possible une porte entière dans le cadre : elle sert de référence pour l’échelle.',
  },
];

interface PhotoCaptureGuidanceProps {
  onAcknowledge: () => void;
}

export function PhotoCaptureGuidance({
  onAcknowledge,
}: PhotoCaptureGuidanceProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm font-medium text-amber-800">
        Avant de commencer
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Quelques conseils pour des photos exploitables par l&apos;analyse :
      </p>

      <ul className="mt-3 space-y-2">
        {CAPTURE_TIPS.map((tip) => (
          <li key={tip.title} className="text-xs text-amber-800">
            <span className="font-medium">{tip.title} — </span>
            {tip.text}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 sm:w-auto"
      >
        Compris, commencer
      </button>
    </div>
  );
}
