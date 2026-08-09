import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { GuestStartButton } from '@/components/marketing/GuestStartButton';
import { PlanCard } from '@/components/marketing/PlanCard';
import { plansForAudience } from '@/lib/pricing';
import { COVERED_TRADES, TRADES_NOT_COVERED } from '@/lib/work-types';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Chiffréo pour les métiers de finition',
  description:
    'Peintre, carreleur, plaquiste, solier : mesures prises chez le client, quantités calculées, devis PDF conforme envoyé sur place.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Chiffréo pour les métiers de finition',
    description:
      'Chiffrez et envoyez un devis conforme depuis le chantier, pas le soir au bureau.',
    url: '/',
  },
};

// Une seule audience, une seule surface. Ce récit vivait sur `/artisans` tant
// que `/` parlait au particulier ; E3-1 (ADR 0002 D4) a supprimé le palier DIY
// et sa landing, et `/artisans` redirige désormais ici.
const AUDIENCE = 'artisan' as const;
const PLANS = plansForAudience(AUDIENCE);

const QUOTE_FLOW = [
  {
    title: 'Mesures prises chez le client',
    description:
      'Longueur, largeur, hauteur : la saisie guidée gère les pièces en L, T ou U, les ouvertures et les zones à exclure, sur place.',
  },
  {
    title: 'Quantités et marge matériaux calculées',
    description:
      'Ouvertures déduites, pertes de coupe réelles selon le type de pose, conditionnements du marché français. Votre marge matériaux s’applique automatiquement.',
  },
  {
    title: 'Devis PDF conforme envoyé sur place',
    description:
      'TVA, HT/TTC, mentions légales obligatoires, numérotation. Le client repart avec son devis avant que vous ayez rangé le mètre.',
  },
];

const PRO_PROOF = [
  {
    title: 'Le chiffrage ne se fait plus le soir',
    description:
      'Un chiffrage de rénovation prend deux à trois heures au bureau. Ici il tient dans la visite : c’est la journée facturable que vous récupérez.',
  },
  {
    title: 'Des devis qui tiennent la route',
    description:
      'Mentions obligatoires, TVA, HT/TTC, conditions : le PDF généré est conforme, pas un tableur exporté.',
  },
  {
    title: 'Du devis accepté à la facture',
    description:
      'Le devis accepté devient une facture numérotée sans trou, avec ses mentions légales. Rien à ressaisir, aucun compteur à tenir à la main.',
  },
  {
    title: 'Vos clients au même endroit',
    description:
      'Fichier clients, historique des chantiers et des devis par client. Pas de second outil à tenir à jour.',
  },
];

/**
 * L'argument central du produit : pas la vitesse, la profondeur du calcul.
 * Chaque point correspond à une capacité socle réelle (voir `pricing.ts` et
 * `offer-catalogue.spec.ts`), pas à une promesse de justesse absolue — E2-3
 * interdit « quantité exacte » : le résultat reste une base à valider.
 */
const CALCULATION_DEPTH = [
  {
    title: 'La géométrie réelle de la pièce',
    description:
      'Décrochés, pièces en L, T ou U : le métré suit la forme réelle, pas un rectangle qui l’approxime.',
  },
  {
    title: 'Les ouvertures déduites',
    description:
      'Portes et fenêtres sont soustraites de la surface brute, automatiquement, sans les ressaisir en négatif.',
  },
  {
    title: 'Les pertes selon la pose et le niveau',
    description:
      'Le facteur de perte change avec le type de pose (droite, diagonale, à coupe perdue…) et le niveau de compétence déclaré — pas un pourcentage unique appliqué partout.',
  },
  {
    title: 'Des conditionnements du marché français',
    description:
      'La liste d’achats sort en unités vraiment vendues — sacs, pots, rouleaux, boîtes — pas en mètres carrés arrondis.',
  },
  {
    title: 'Une fiche fabricant derrière chaque ratio',
    description:
      'Le rendement ou le taux de perte affiché renvoie à sa source : vous savez d’où vient le chiffre, pas seulement le chiffre.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Le calcul est-il fiable ?',
    answer:
      'Le résultat est une base de commande, calculée et sourcée, que vous validez — pas une quantité que le logiciel décide à votre place. Elle tient compte de la géométrie réelle de la pièce, des ouvertures déduites, des pertes selon la pose et le niveau, et sort en conditionnements réellement vendus. Chaque ratio renvoie à sa fiche fabricant.',
  },
  {
    question: 'Combien de temps prend un devis ?',
    answer:
      'Chronométré sur des chantiers réels, écran par écran : de 36 secondes pour une pièce et un ouvrage à environ 1 min 15 pour un chantier de trois pièces — mesures, calcul des pertes et génération du devis compris.',
  },
  {
    question: 'Faut-il un compte ou une carte bancaire pour commencer ?',
    answer:
      'Non. Vous pouvez mesurer une pièce et chiffrer sans compte. Un compte n’est demandé qu’au moment de sauvegarder le chantier ou d’envoyer un devis — jamais de carte bancaire pour chiffrer.',
  },
  {
    question: 'Le chiffrage est-il vraiment gratuit et illimité ?',
    answer:
      'Oui, sur autant de chantiers que vous voulez. Le détail de ce qui est gratuit et de ce qui est payant est sur la page tarifs.',
  },
  {
    question: 'Que se passe-t-il quand je passe à l’offre payante ?',
    answer:
      'Vous gardez tout le gratuit et ajoutez le devis PDF conforme, le fichier clients et la facturation numérotée, pour 279 € HT par an — détail complet sur la page tarifs.',
  },
];

const CHRONO_STAT =
  'Chronométré sur trois scénarios réels : de 36 secondes (une pièce, un ouvrage) à environ 1 min 15 (trois pièces, deux ouvrages) de temps d’écran, mesures et calcul des pertes compris.';

const JSON_LD_SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Chiffréo',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Chiffrage gratuit et illimité pour les métiers de finition — devis PDF conforme et facturation en offre payante.',
  offers: PLANS.filter(
    (plan): plan is typeof plan & { priceNumber: number } =>
      plan.priceNumber !== null,
  ).map((plan) => ({
    '@type': 'Offer',
    name: plan.name,
    price: String(plan.priceNumber),
    priceCurrency: 'EUR',
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
};

const JSON_LD_FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON_LD_SOFTWARE) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON_LD_FAQ) }}
      />
      <div className="mx-auto w-full max-w-6xl">
        <MarketingHeader />

        {/* Hero */}
        <section className="mt-6 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
              Métiers de finition
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
              Chiffrez chez le client, pas le soir au bureau.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-stone-700">
              Mesures de la pièce, estimation des matériaux, devis PDF conforme
              (TVA, HT/TTC, mentions) envoyé avant de repartir. Fichier clients
              et facturation suivent derrière.
            </p>

            <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">
              Chiffréo chiffre les ouvrages de finition —{' '}
              {COVERED_TRADES.map((trade) => trade.label.toLowerCase()).join(
                ', ',
              )}
              . Ce n&apos;est pas un logiciel de devis tous corps d&apos;état.{' '}
              <a href="#perimetre" className="underline hover:text-stone-900">
                Voir le périmètre couvert
              </a>
              .
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GuestStartButton />
              <Link
                href="#offres"
                className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
              >
                Voir les offres
              </Link>
            </div>

            <p className="mt-4 text-sm text-stone-600">
              Le chiffrage est gratuit et sans carte bancaire : votre brouillon
              devient un compte au moment de la sauvegarde.
            </p>
          </div>

          {/* Parcours devis-minute */}
          <div className="rounded-[2rem] bg-stone-950 p-7 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
              Le parcours devis-minute
            </p>
            <ol className="mt-5 space-y-4">
              {QUOTE_FLOW.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="shrink-0 text-sm font-semibold text-amber-200">
                      {index + 1}.
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-stone-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-stone-400">
              {CHRONO_STAT}
            </p>
          </div>
        </section>

        {/* Profondeur du calcul */}
        <section className="mt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
            Ce que le moteur calcule vraiment
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-stone-950">
            La profondeur du calcul, pas juste la vitesse
          </h2>
          <p className="mt-3 max-w-2xl text-base text-stone-700">
            Le résultat est une base de commande, calculée et sourcée, que
            vous validez — pas une quantité que le logiciel décide à votre
            place.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CALCULATION_DEPTH.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-5"
              >
                <h3 className="text-base font-semibold text-stone-950">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Preuve */}
        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(67,39,15,0.10)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
            Ce que ça change dans la semaine
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-stone-950">
            Le temps que vous ne passez plus à chiffrer
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PRO_PROOF.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-5"
              >
                <h3 className="text-base font-semibold text-stone-950">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Périmètre chiffrable */}
        <section id="perimetre" className="mt-24 scroll-mt-8">
          <h2 className="text-3xl font-semibold text-stone-950">
            Ce que Chiffréo chiffre, et ce qu&apos;il ne chiffre pas
          </h2>
          <p className="mt-3 max-w-2xl text-base text-stone-700">
            Le moteur calcule des quantités à partir de surfaces : murs, sol,
            plafond, ouvertures déduites. Il couvre donc les ouvrages de
            finition, et le devis porte un bloc de main-d&apos;œuvre (taux
            horaire × heures, ou forfait) — pas un déboursé sec par corps
            d&apos;état. Autant le savoir avant de payer.
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
                corps d&apos;état vous servira mieux que Chiffréo.
              </p>
            </div>
          </div>
        </section>

        {/* Offres */}
        <section id="offres" className="mt-24 scroll-mt-8">
          <h2 className="text-3xl font-semibold text-stone-950">
            Chiffrer est gratuit. Le devis conforme est payant.
          </h2>
          <p className="mt-3 max-w-xl text-base text-stone-700">
            Métré, quantités, pertes et liste d&apos;achat : sans limite de
            chantiers et sans compte payant. Le devis PDF conforme, le fichier
            clients et la facturation sont dans l&apos;offre payante.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                tone={plan.highlighted ? 'highlighted' : 'surface'}
                maxFeatures={5}
                badge={
                  plan.refundWindowDays
                    ? `${plan.refundWindowDays} jours satisfait ou remboursé`
                    : undefined
                }
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Sans engagement. Annulable à tout moment.{' '}
            <Link href="/pricing" className="underline hover:text-stone-800">
              Voir le détail des offres
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
            Votre prochain devis, envoyé depuis le chantier
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            Chiffrez une première visite sans compte. Pour envoyer le devis,
            créez votre compte et renseignez votre profil (SIRET, TVA,
            mentions).
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <GuestStartButton />
            <Link
              href="/register"
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
            >
              Créer un compte
            </Link>
          </div>
        </section>

        <MarketingFooter currentPath="/" />
      </div>
    </main>
  );
}
