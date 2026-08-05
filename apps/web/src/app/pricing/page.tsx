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
    'Comparez les offres Chiffréo : Gratuit, Pro à 9,99 €/mois et Artisan à 19 €/mois pour les métiers de finition, tous deux avec 7 jours d’essai.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Chiffréo',
    description:
      'Gratuit, Pro à 9,99 €/mois, Artisan à 19 €/mois — essai de 7 jours sur les deux offres payantes.',
    url: '/pricing',
  },
};

const DIY_PLANS = plansForAudience('diy');
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
      name:
        plan.audience === 'artisan' ? `Contractor ${plan.name}` : plan.name,
      price: String(plan.priceNumber),
      priceCurrency: 'EUR',
    })),
  },
};

const FAQ_ITEMS = [
  {
    question: 'L’essai est-il vraiment gratuit ?',
    answer:
      'Oui, sur Pro comme sur Artisan. Vous profitez de toutes les fonctionnalités de l’offre choisie pendant 7 jours. Si vous annulez avant la fin de l’essai, rien ne vous est facturé.',
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
    question: 'Quelle offre choisir : Pro ou Contractor ?',
    answer:
      'Pro s’adresse aux particuliers qui rénovent chez eux : estimation, liste d’achats, budget. Contractor ajoute ce dont un professionnel a besoin pour facturer son client — devis conformes, fichier clients et factures numérotées.',
  },
  {
    question: 'Contractor couvre-t-il tous les corps d’état ?',
    answer:
      'Non, et c’est assumé. Le moteur calcule des quantités à partir de surfaces : il couvre les ouvrages de finition (peinture, carrelage, parquet, cloison sèche, revêtement mural). La plomberie, l’électricité, l’isolation, la maçonnerie et la menuiserie ne sont pas chiffrables. Le devis porte par ailleurs un seul bloc de main-d’œuvre, pas un déboursé par corps d’état. Le détail figure sur la page artisans.',
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
            Une échelle, deux publics
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            Le même moteur d&apos;estimation pour tout le monde. Ce qui change
            d&apos;un palier à l&apos;autre, c&apos;est ce que vous en faites
            ensuite : une liste d&apos;achats, ou un devis client.
          </p>
        </section>

        {/* Particuliers */}
        <section id="particuliers" className="mt-20 scroll-mt-8">
          <AudienceHeading audience="diy" />
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:max-w-3xl">
            {DIY_PLANS.map((plan) => (
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
        </section>

        {/* Artisans */}
        <section id="artisans" className="mt-24 scroll-mt-8">
          <AudienceHeading audience="artisan" />
          <div className="mt-8 max-w-sm">
            {ARTISAN_PLANS.map((plan) => (
              <PlanCard key={plan.key} plan={plan} tone="highlighted" />
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
            Périmètre chiffrable : ouvrages de finition uniquement (peinture,
            carrelage, parquet, cloison sèche, revêtement mural). Plomberie,
            électricité, isolation, maçonnerie et menuiserie sont hors
            périmètre.
          </p>
          <p className="mt-3 text-sm text-stone-600">
            <Link
              href={AUDIENCE_DEFINITIONS.artisan.landingPath}
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Voir la page artisans →
            </Link>
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

        <MarketingFooter currentPath="/pricing" />
      </div>
    </main>
  );
}
