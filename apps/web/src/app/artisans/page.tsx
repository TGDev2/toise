import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PlanCard } from '@/components/marketing/PlanCard';
import { AUDIENCE_DEFINITIONS, plansForAudience } from '@/lib/pricing';
import { COVERED_TRADES, TRADES_NOT_COVERED } from '@/lib/work-types';

export const metadata: Metadata = {
  title: 'Chiffréo pour les métiers de finition',
  description:
    'Peintre, carreleur, plaquiste, solier : mesures prises chez le client, quantités calculées, devis PDF conforme envoyé sur place. Contractor dès 19 €/mois.',
  alternates: { canonical: '/artisans' },
  openGraph: {
    title: 'Chiffréo pour les métiers de finition',
    description:
      'Chiffrez et envoyez un devis conforme depuis le chantier, pas le soir au bureau.',
    url: '/artisans',
  },
};

// Cette page porte le récit artisan, et elle seule. Il occupait auparavant une
// section au milieu de la landing particulier : la page d'accueil passait du
// « votre niveau de bricolage » au « devis PDF envoyé sur place » sans que
// personne ne sache plus à qui elle parlait.
const AUDIENCE = 'artisan' as const;
const CONTRACTOR_PLANS = plansForAudience(AUDIENCE);

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

export default function ArtisansPage() {
  const diy = AUDIENCE_DEFINITIONS.diy;

  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <MarketingHeader audience={AUDIENCE} switchTo="diy" />

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
                Voir le périmètre exact
              </a>
              .
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
              >
                Créer un compte
              </Link>
              <Link
                href="#offres"
                className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
              >
                Voir les offres Contractor
              </Link>
            </div>

            <p className="mt-4 text-sm text-stone-600">
              Sans engagement, annulable à tout moment.
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

        {/* Offres Contractor */}
        <section id="offres" className="mt-24 scroll-mt-8">
          <h2 className="text-3xl font-semibold text-stone-950">
            Une offre, tout le parcours
          </h2>
          <p className="mt-3 max-w-xl text-base text-stone-700">
            Chiffrage, devis conforme, fichier clients et facturation : tout est
            inclus, sans palier supérieur à débloquer.
          </p>
          <div className="mt-8 max-w-sm">
            {CONTRACTOR_PLANS.map((plan) => (
              <PlanCard key={plan.key} plan={plan} tone="highlighted" />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-stone-500">
            Sans engagement. Annulable à tout moment.{' '}
            <Link href="/pricing" className="underline hover:text-stone-800">
              Comparer avec les offres particuliers
            </Link>
          </p>
        </section>

        {/* CTA final */}
        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-10 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-stone-950">
            Votre prochain devis, envoyé depuis le chantier
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            Créez votre compte, renseignez votre profil (SIRET, TVA, mentions) et
            chiffrez votre première visite.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            >
              Créer un compte
            </Link>
            <Link
              href={diy.landingPath}
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
            >
              {diy.switchLabel}
            </Link>
          </div>
        </section>

        <MarketingFooter currentPath="/artisans" />
      </div>
    </main>
  );
}
