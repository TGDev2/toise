import { PlanCtaButton } from '@/components/pricing/PlanCtaButton';
import type { OfferPlan } from '@/lib/pricing';

type Tone = 'surface' | 'highlighted' | 'dark';

interface PlanCardProps {
  plan: OfferPlan;
  tone?: Tone;
  /** Pastille affichée au-dessus de la carte (« Essai gratuit 7 jours », « Populaire »). */
  badge?: string;
  /** Limite le nombre de lignes affichées — aperçu de landing vs page tarifs complète. */
  maxFeatures?: number;
  /** Remplace le CTA de checkout, pour une offre sans parcours d'achat en ligne. */
  cta?: React.ReactNode;
}

const CARD_CLASSES: Record<Tone, string> = {
  surface: 'rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-7',
  highlighted:
    'relative rounded-[2rem] border-2 border-[var(--accent)] bg-white p-7 shadow-[0_15px_50px_rgba(29,107,87,0.15)]',
  dark: 'rounded-[2rem] bg-stone-950 p-7 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)]',
};

const NAME_CLASSES: Record<Tone, string> = {
  surface: 'text-stone-600',
  highlighted: 'text-stone-600',
  dark: 'text-amber-200/80',
};

const PRICE_CLASSES: Record<Tone, string> = {
  surface: 'text-stone-950',
  highlighted: 'text-stone-950',
  dark: 'text-white',
};

const BODY_CLASSES: Record<Tone, string> = {
  surface: 'text-stone-700',
  highlighted: 'text-stone-700',
  dark: 'text-stone-300',
};

const CHECK_CLASSES: Record<Tone, string> = {
  surface: 'text-[var(--accent)]',
  highlighted: 'text-[var(--accent)]',
  dark: 'text-amber-200',
};

export function PlanCard({
  plan,
  tone = 'surface',
  badge,
  maxFeatures,
  cta,
}: PlanCardProps) {
  const features = maxFeatures ? plan.features.slice(0, maxFeatures) : plan.features;
  const hiddenCount = plan.features.length - features.length;

  return (
    <div className={tone === 'highlighted' ? CARD_CLASSES[tone] : `relative ${CARD_CLASSES[tone]}`}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-medium text-white">
          {badge}
        </span>
      )}

      <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${NAME_CLASSES[tone]}`}>
        {plan.name}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${PRICE_CLASSES[tone]}`}>
        {plan.priceLabel}
        {plan.period && (
          <span className={`text-base font-normal ${BODY_CLASSES[tone]}`}>
            {plan.period}
          </span>
        )}
      </p>
      <p className={`mt-2 text-sm leading-6 ${BODY_CLASSES[tone]}`}>
        {plan.description}
      </p>

      <ul className={`mt-5 space-y-2 text-sm leading-6 ${BODY_CLASSES[tone]}`}>
        {features.map((feature) => (
          <li key={feature.label} className="flex gap-2">
            <span aria-hidden className={CHECK_CLASSES[tone]}>
              ✓
            </span>
            {feature.label}
          </li>
        ))}
        {hiddenCount > 0 && (
          <li className={`pl-6 text-xs ${BODY_CLASSES[tone]}`}>
            et {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} sur la page tarifs
          </li>
        )}
      </ul>

      <div className="mt-6">
        {cta ?? (
          <PlanCtaButton
            planKey={plan.key}
            apiPlanKey={plan.apiPlanKey}
            label={plan.ctaLabel}
            variant={
              tone === 'highlighted' ? 'accent' : tone === 'dark' ? 'light' : 'outline'
            }
          />
        )}
      </div>
    </div>
  );
}
