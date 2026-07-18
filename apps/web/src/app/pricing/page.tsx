import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { PlanCtaButton } from '@/components/pricing/PlanCtaButton';
import {
  ALL_PAID_PLANS,
  CONTRACTOR_PLANS,
  FREE_PLAN,
  PRO_PLAN,
  type PricingPlan,
} from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Comparez les offres EstiMate : Gratuit, Pro à 9,99 €/mois avec 7 jours d’essai, et Contractor dès 50 €/mois pour les artisans.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs EstiMate',
    description:
      'Gratuit, Pro à 9,99 €/mois avec essai de 7 jours, Contractor dès 50 €/mois pour les artisans.',
    url: '/pricing',
  },
};

const ALL_PLANS = [FREE_PLAN, ...ALL_PAID_PLANS];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'EstiMate',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice: String(Math.min(...ALL_PLANS.map((plan) => plan.priceNumber))),
    highPrice: String(Math.max(...ALL_PLANS.map((plan) => plan.priceNumber))),
    offerCount: ALL_PLANS.length,
    offers: ALL_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.tier === 'contractor' ? `Contractor ${plan.name}` : plan.name,
      price: String(plan.priceNumber),
      priceCurrency: 'EUR',
    })),
  },
};

const FAQ_ITEMS = [
  {
    question: 'L’essai Pro est-il vraiment gratuit ?',
    answer:
      'Oui. Vous profitez de toutes les fonctionnalités Pro pendant 7 jours. Si vous annulez avant la fin de l’essai, rien ne vous est facturé.',
  },
  {
    question: 'Puis-je annuler à tout moment ?',
    answer:
      'Oui, les abonnements sont sans engagement. Vous pouvez annuler à tout moment depuis vos réglages ; votre accès reste actif jusqu’à la fin de la période en cours.',
  },
  {
    question: 'Puis-je changer d’offre ?',
    answer:
      'Oui. Vous pouvez passer d’une offre à l’autre depuis votre espace abonnement, la facturation s’ajuste automatiquement.',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer:
      'Le paiement est géré par Stripe, par carte bancaire, en toute sécurité. Nous ne stockons jamais vos données de paiement.',
  },
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-5 space-y-2 text-sm leading-6 text-stone-700">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <span aria-hidden className="text-[var(--accent)]">
            ✓
          </span>
          {feature}
        </li>
      ))}
    </ul>
  );
}

function PlanHeader({ plan }: { plan: PricingPlan }) {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-600">
        {plan.name}
      </p>
      <p className="mt-3 text-3xl font-semibold text-stone-950">
        {plan.priceLabel}
        {plan.period && (
          <span className="text-base font-normal text-stone-600">
            {plan.period}
          </span>
        )}
      </p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{plan.description}</p>
    </>
  );
}

export default function PricingPage() {
  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between py-6">
          <Link href="/">
            <Logo height={30} priority />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-800 hover:border-stone-500 hover:bg-white"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-950 sm:block"
            >
              Créer un compte
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            Des tarifs simples et transparents
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-stone-700">
            Commencez gratuitement, passez à Pro quand vous multipliez les
            projets, Contractor si vous êtes du métier. Sans engagement,
            annulable à tout moment.
          </p>
        </section>

        {/* Gratuit / Pro / Contractor */}
        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <div className="rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-7">
            <PlanHeader plan={FREE_PLAN} />
            <FeatureList features={FREE_PLAN.features} />
            <div className="mt-6">
              <PlanCtaButton
                planKey={FREE_PLAN.key}
                label={FREE_PLAN.ctaLabel}
                variant="outline"
              />
            </div>
          </div>

          <div className="relative rounded-[2rem] border-2 border-[var(--accent)] bg-white p-7 shadow-[0_15px_50px_rgba(29,107,87,0.15)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-medium text-white">
              Essai gratuit 7 jours
            </span>
            <PlanHeader plan={PRO_PLAN} />
            <FeatureList features={PRO_PLAN.features} />
            <div className="mt-6">
              <PlanCtaButton
                planKey={PRO_PLAN.key}
                apiPlanKey={PRO_PLAN.apiPlanKey}
                label={PRO_PLAN.ctaLabel}
                variant="accent"
              />
            </div>
          </div>

          <div className="rounded-[2rem] bg-stone-950 p-7 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              Contractor
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              dès 50 €
              <span className="text-base font-normal text-stone-300">
                /mois
              </span>
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Des outils professionnels pour les artisans : devis PDF conformes,
              fichier clients, chiffrage chez le client.
            </p>
            <ul className="mt-5 space-y-2 text-sm leading-6 text-stone-300">
              {['Devis PDF conformes (TVA, mentions)', 'Fichier clients intégré', 'Trois niveaux selon votre volume'].map(
                (feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-amber-200">
                      ✓
                    </span>
                    {feature}
                  </li>
                ),
              )}
            </ul>
            <a
              href="#contractor"
              className="mt-6 block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-950 transition-all hover:-translate-y-0.5 hover:bg-stone-100 hover:shadow-md"
            >
              Voir les offres Contractor
            </a>
          </div>
        </section>

        {/* Détail Contractor */}
        <section id="contractor" className="mt-24 scroll-mt-8">
          <h2 className="text-3xl font-semibold text-stone-950">
            Contractor : pour les artisans
          </h2>
          <p className="mt-3 max-w-xl text-base text-stone-700">
            Photo de la pièce, estimation des matériaux, devis PDF conforme
            envoyé avant de repartir. Trois niveaux selon la taille de votre
            activité.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {CONTRACTOR_PLANS.map((plan) => (
              <div
                key={plan.key}
                className={
                  plan.highlighted
                    ? 'relative rounded-[2rem] border-2 border-[var(--accent)] bg-white p-7 shadow-[0_15px_50px_rgba(29,107,87,0.15)]'
                    : 'rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-7'
                }
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-medium text-white">
                    Populaire
                  </span>
                )}
                <PlanHeader plan={plan} />
                <FeatureList features={plan.features} />
                <div className="mt-6">
                  <PlanCtaButton
                    planKey={plan.key}
                    apiPlanKey={plan.apiPlanKey}
                    label={plan.ctaLabel}
                    variant={plan.highlighted ? 'accent' : 'dark'}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-stone-500">
            Sans engagement. Annulable à tout moment.
          </p>
        </section>

        {/* FAQ */}
        <section className="mt-24">
          <h2 className="text-3xl font-semibold text-stone-950">
            Questions fréquentes
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-5"
              >
                <h3 className="text-base font-semibold text-stone-950">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-10 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-stone-950">
            Commencez gratuitement dès aujourd’hui
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            Deux projets offerts, aucune carte bancaire demandée. Passez à une
            offre payante quand votre chantier le demande.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            >
              Créer un compte gratuit
            </Link>
          </div>
        </section>

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-300/60 pt-8 text-sm text-stone-600 sm:flex-row">
          <p>© {new Date().getFullYear()} EstiMate</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-stone-950">
              Accueil
            </Link>
            <Link href="/calculateurs" className="hover:text-stone-950">
              Calculateurs gratuits
            </Link>
            <Link href="/cgu" className="hover:text-stone-950">
              CGU
            </Link>
            <Link href="/cgv" className="hover:text-stone-950">
              CGV
            </Link>
            <Link href="/privacy" className="hover:text-stone-950">
              Confidentialité
            </Link>
            <Link href="/mentions-legales" className="hover:text-stone-950">
              Mentions légales
            </Link>
            <Link href="/login" className="hover:text-stone-950">
              Se connecter
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
