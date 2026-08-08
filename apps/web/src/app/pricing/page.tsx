import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PlanCard } from '@/components/marketing/PlanCard';
import { AUDIENCE_DEFINITIONS, OFFER_PLANS, plansForAudience } from '@/lib/pricing';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Le chiffrage est gratuit et sans limite de chantiers. L’offre à 19 €/mois ajoute le devis PDF conforme, le fichier clients et la facturation, avec 7 jours d’essai.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Chiffréo',
    description:
      'Chiffrer est gratuit. Le devis conforme, le fichier clients et la facturation sont à 19 €/mois, avec 7 jours d’essai.',
    url: '/pricing',
  },
};

const ARTISAN_PLANS = plansForAudience('artisan');

/**
 * `priceNumber` reste `number | null` dans `OfferPlan` (une offre sur devis
 * pourrait revenir), donc le filtre reste nécessaire même si tous les paliers
 * actuels ont un prix public depuis le retrait d'Enterprise (E3-4).
 */
const PRICED_PLANS = OFFER_PLANS.filter(
  (plan): plan is typeof plan & { priceNumber: number } =>
    plan.priceNumber !== null,
);

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Chiffréo',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice: String(Math.min(...PRICED_PLANS.map((plan) => plan.priceNumber))),
    highPrice: String(Math.max(...PRICED_PLANS.map((plan) => plan.priceNumber))),
    offerCount: PRICED_PLANS.length,
    offers: PRICED_PLANS.map((plan) => ({
      '@type': 'Offer',
      // Le préfixe « Contractor » distinguait les paliers artisan de ceux du
      // particulier. Il n'y a plus qu'une audience (E3-1) : le préfixe ne
      // distinguait plus rien et aurait fini par publier « Contractor Gratuit ».
      name: plan.name,
      price: String(plan.priceNumber),
      priceCurrency: 'EUR',
    })),
  },
};

const FAQ_ITEMS = [
  {
    question: 'L’essai est-il vraiment gratuit ?',
    answer:
      'Le chiffrage, lui, n’est pas un essai : il est gratuit et sans limite de chantiers, sans carte bancaire. L’offre payante s’essaie 7 jours ; si vous annulez avant la fin, rien ne vous est facturé.',
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
    question: 'Qu’est-ce qui est payant ?',
    answer:
      'Tout le chiffrage est gratuit : métré, quantités, facteurs de perte, liste d’achats en conditionnements, budget. L’offre payante ajoute ce dont un professionnel a besoin pour facturer son client — devis PDF conformes, fichier clients et factures numérotées.',
  },
  {
    question: 'Chiffréo couvre-t-il tous les corps d’état ?',
    answer:
      'Non, et c’est assumé. Le moteur calcule des quantités à partir de surfaces : il couvre les ouvrages de finition (peinture, carrelage, parquet, cloison sèche, revêtement mural). La plomberie, l’électricité, l’isolation, la maçonnerie et la menuiserie ne sont pas chiffrables. Le devis porte par ailleurs un seul bloc de main-d’œuvre, pas un déboursé par corps d’état. Le détail figure sur la page d’accueil.',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer:
      'Le paiement est géré par Stripe, par carte bancaire, en toute sécurité. Nous ne stockons jamais vos données de paiement.',
  },
];

function AudienceHeading({
  audience,
}: {
  audience: keyof typeof AUDIENCE_DEFINITIONS;
}) {
  const definition = AUDIENCE_DEFINITIONS[audience];
  return (
    <>
      <h2 className="text-3xl font-semibold text-stone-950">
        {definition.title}
      </h2>
      <p className="mt-3 max-w-xl text-base text-stone-700">
        {definition.tagline}
      </p>
    </>
  );
}

export default function PricingPage() {
  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON_LD) }}
      />
      <div className="mx-auto w-full max-w-6xl">
        <MarketingHeader />

        {/* Hero */}
        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            Chiffrer est gratuit. Le devis conforme est payant.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            Le moteur d&apos;estimation est le même dans les deux offres, sans
            limite de chantiers. Ce qui change, c&apos;est ce que vous en faites
            ensuite : une liste d&apos;achats, ou un devis client opposable.
          </p>
        </section>

        {/* Artisans */}
        <section id="artisans" className="mt-20 scroll-mt-8">
          <AudienceHeading audience="artisan" />
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:max-w-3xl">
            {ARTISAN_PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                tone={plan.highlighted ? 'highlighted' : 'surface'}
                badge={
                  plan.trialDays
                    ? `Essai gratuit ${plan.trialDays} jours`
                    : undefined
                }
              />
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
            Périmètre chiffrable : ouvrages de finition uniquement (peinture,
            carrelage, parquet, cloison sèche, revêtement mural). Plomberie,
            électricité, isolation, maçonnerie et menuiserie sont hors
            périmètre.
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
            Chantiers illimités, aucune carte bancaire demandée. Passez à
            l&apos;offre payante le jour où vous devez envoyer un devis.
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

        <MarketingFooter currentPath="/pricing" />
      </div>
    </main>
  );
}
