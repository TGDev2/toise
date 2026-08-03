import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PlanCard } from '@/components/marketing/PlanCard';
import {
  AUDIENCE_DEFINITIONS,
  ENTERPRISE_CONTACT_EMAIL,
  OFFER_PLANS,
  plansForAudience,
} from '@/lib/pricing';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Comparez les offres Chiffréo : Gratuit, Pro à 9,99 €/mois avec 7 jours d’essai, Contractor dès 19 €/mois pour les métiers de finition, Enterprise sur devis.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Chiffréo',
    description:
      'Gratuit, Pro à 9,99 €/mois avec essai de 7 jours, Contractor dès 19 €/mois, Enterprise sur devis.',
    url: '/pricing',
  },
};

const DIY_PLANS = plansForAudience('diy');
const ARTISAN_PLANS = plansForAudience('artisan');
const [ENTERPRISE_PLAN] = plansForAudience('enterprise');

/**
 * L'offre Enterprise est portée par un contrat annuel (`enterprise_agreements`),
 * pas par un prix Stripe : elle n'a pas de montant public et reste donc hors des
 * agrégats. Les inclure avec un `priceNumber` fictif fausserait `lowPrice`.
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
  {
    question: 'Comment fonctionne l’offre Enterprise ?',
    answer:
      'Elle repose sur un contrat annuel rattaché à votre organisation, et non sur un abonnement individuel : engagements de SLA et environnement dédié. Elle se met en place après échange avec nous.',
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
            Une échelle, trois publics
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            Le même moteur d&apos;estimation pour tout le monde. Ce qui change
            d&apos;un palier à l&apos;autre, c&apos;est ce que vous en faites
            ensuite : une liste d&apos;achats, un devis client, ou une
            intégration à vos propres outils.
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
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:max-w-3xl">
            {ARTISAN_PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                tone={plan.highlighted ? 'highlighted' : 'surface'}
                badge={plan.highlighted ? 'Populaire' : undefined}
              />
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

        {/* Enterprise */}
        {ENTERPRISE_PLAN && (
          <section
            id="enterprise"
            className="mt-24 scroll-mt-8 rounded-[2rem] bg-stone-950 p-8 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)] sm:p-10"
          >
            <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                  {AUDIENCE_DEFINITIONS.enterprise.title}
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  {ENTERPRISE_PLAN.name} — {ENTERPRISE_PLAN.priceLabel}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-stone-300">
                  {AUDIENCE_DEFINITIONS.enterprise.tagline}{' '}
                  {ENTERPRISE_PLAN.description}
                </p>
                <a
                  href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=${encodeURIComponent(
                    'Offre Enterprise Chiffréo',
                  )}`}
                  className="mt-7 inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-950 transition-all hover:-translate-y-0.5 hover:bg-stone-100 hover:shadow-md"
                >
                  {ENTERPRISE_PLAN.ctaLabel}
                </a>
                <p className="mt-3 text-xs text-stone-400">
                  {ENTERPRISE_CONTACT_EMAIL}
                </p>
              </div>
              <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-6 text-stone-300">
                {ENTERPRISE_PLAN.features.map((feature) => (
                  <li key={feature.label} className="flex gap-2">
                    <span aria-hidden className="text-amber-200">
                      ✓
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

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
