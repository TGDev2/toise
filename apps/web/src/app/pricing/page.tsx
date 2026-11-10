import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PlanCard } from '@/components/marketing/PlanCard';
import { AUDIENCE_DEFINITIONS, OFFER_PLANS, plansForAudience } from '@/lib/pricing';
import { serializeJsonLd } from '@/lib/json-ld';
import { COVERED_TRADES, TRADES_NOT_COVERED } from '@/lib/work-types';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Le chiffrage est gratuit et sans limite de chantiers. L’offre à 279 € HT par an, en annuel uniquement, ajoute le devis PDF conforme, le fichier clients et la facturation — 30 jours satisfait ou remboursé.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Toisé',
    description:
      'Chiffrer est gratuit. Le devis conforme, le fichier clients et la facturation sont à 279 € HT par an, avec 30 jours satisfait ou remboursé.',
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
  name: 'Toisé',
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
      // La périodicité est publiée, et pas seulement affichée. Un `price: 279`
      // nu se lit par défaut comme un prix unitaire ou mensuel : c'est ce que
      // reprendraient les agrégateurs, et un prix mal périodisé dans une donnée
      // structurée est une promesse fausse que personne ne relit.
      ...(plan.period === '/an'
        ? {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: String(plan.priceNumber),
              priceCurrency: 'EUR',
              billingDuration: 1,
              billingIncrement: 1,
              unitCode: 'ANN',
            },
          }
        : {}),
    })),
  },
};

const FAQ_ITEMS = [
  {
    question: 'Pourquoi le chiffrage est-il gratuit ?',
    answer:
      'Parce que la frontière ne passe pas par un quota, mais par le geste : calculer est gratuit, produire un document opposable — devis conforme, facture — est payant. Un compte gratuit limité à un ou deux chantiers empêcherait la seule démonstration qui compte : constater, sur plusieurs chantiers réels, qu’il n’y a ni reste ni manque. Le chiffrage illimité n’est donc pas une générosité, c’est le protocole d’essai — sans carte bancaire, et sans date de fin.',
  },
  {
    question: 'Comment fonctionne le « 30 jours satisfait ou remboursé » ?',
    answer:
      'Vous en faites la demande depuis votre espace abonnement, sans avoir à vous justifier. Le remboursement est intégral et part immédiatement ; votre abonnement est résilié dans la foulée, et vous revenez au chiffrage gratuit et illimité. Le délai court à compter de chaque prélèvement, reconduction annuelle comprise.',
  },
  {
    question: 'Puis-je annuler à tout moment ?',
    answer:
      'Oui. L’abonnement est annuel, sans reconduction forcée : vous pouvez résilier quand vous voulez depuis vos réglages, et votre accès reste actif jusqu’à la fin de l’année en cours. Nous vous prévenons par e-mail 30 jours avant chaque reconduction.',
  },
  {
    question: 'Pourquoi seulement de l’annuel ?',
    answer:
      'Parce que ce que vend l’offre payante — devis conformes, fichier clients, factures numérotées — se juge sur une saison de chantiers, pas sur trois semaines. Un engagement annuel nous permet aussi de tenir un prix bas sans coût de relance mensuelle. La garantie de 30 jours est la contrepartie : vous ne vous engagez pour un an qu’après avoir pu tout essayer, et vous récupérez votre argent si ça ne vous convient pas.',
  },
  {
    question: 'Quels métiers sont couverts ?',
    answer:
      'Le moteur calcule des quantités à partir de surfaces : peintre, carreleur, plaquiste, solier, poseur de parquet, poseur de revêtement mural. La plomberie, l’électricité, l’isolation, la maçonnerie et la menuiserie ne sont pas chiffrables — et le devis porte un seul bloc de main-d’œuvre, pas un déboursé par corps d’état. Si votre activité repose sur ces lots hors périmètre, un logiciel de devis tous corps d’état vous servira mieux que Toisé. Détail complet ci-dessous.',
  },
  {
    question: 'Que se passe-t-il en 2027 pour la facture électronique ?',
    answer:
      'L’obligation d’émission de factures électroniques et d’e-reporting s’applique aux TPE et petites entreprises à partir du 1er septembre 2027. Toisé n’est pas une plateforme agréée (PA) — aucun éditeur ne peut transmettre une facture électronique B2B sans passer par l’une d’elles. D’ici là, la facture PDF que vous générez est conforme au droit en vigueur (mentions obligatoires, numérotation continue et inaltérable) et reste utilisable telle quelle. La décision de raccordement à une PA est prise avant le 31 octobre 2026 ; si elle n’est pas en production avant le 1er mars 2027, un export de repli (que vous déposez vous-même dans votre propre PA) prend le relais. Dans tous les cas, vous ne perdez jamais la capacité de facturer conformément.',
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
            Deux offres, une seule décision. Le moteur d&apos;estimation est le
            même dans les deux, sans limite de chantiers. Ce qui change, c&apos;est
            ce que vous en faites ensuite : une liste d&apos;achats, ou un devis
            client opposable.
          </p>
        </section>

        {/* Périmètre chiffrable — avant le prix */}
        <section id="perimetre" className="mt-20 scroll-mt-8">
          <h2 className="text-3xl font-semibold text-stone-950">
            Ce que Toisé chiffre, et ce qu&apos;il ne chiffre pas
          </h2>
          <p className="mt-3 max-w-2xl text-base text-stone-700">
            Le moteur calcule des quantités à partir de surfaces : murs, sol,
            plafond, ouvertures déduites. Il couvre donc les ouvrages de
            finition, et le devis porte un bloc de main-d&apos;œuvre (taux
            horaire × heures, ou forfait) — pas un déboursé sec par corps
            d&apos;état. Autant le savoir avant de choisir une offre.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-900/15 bg-emerald-50/60 p-6">
              <h3 className="text-base font-semibold text-emerald-950">
                Métiers couverts
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
                {COVERED_TRADES.map((trade) => (
                  <li key={trade.label} className="flex gap-2">
                    <span aria-hidden className="text-emerald-700">
                      ✓
                    </span>
                    {trade.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-stone-300/80 bg-white/80 p-6">
              <h3 className="text-base font-semibold text-stone-950">
                Hors périmètre
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-600">
                {TRADES_NOT_COVERED.map((trade) => (
                  <li key={trade} className="flex gap-2">
                    <span aria-hidden className="text-stone-400">
                      —
                    </span>
                    {trade}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-stone-500">
                Si votre activité repose sur ces lots, un logiciel de devis tous
                corps d&apos;état vous servira mieux que Toisé.
              </p>
            </div>
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
                badge={
                  plan.refundWindowDays
                    ? `${plan.refundWindowDays} jours satisfait ou remboursé`
                    : undefined
                }
              />
            ))}
          </div>
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
