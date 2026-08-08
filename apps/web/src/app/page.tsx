'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PlanCard } from '@/components/marketing/PlanCard';
import { AUDIENCE_DEFINITIONS, plansForAudience } from '@/lib/pricing';

// Cette page sert une seule audience : le particulier qui rénove chez lui.
// L'offre artisan a sa propre surface (/artisans) — elle occupait auparavant une
// section au milieu de ce récit, ce qui faisait passer la page du « votre niveau
// de bricolage » au « devis PDF envoyé sur place » sans que personne ne sache
// plus à qui elle s'adressait.
const AUDIENCE = 'diy' as const;
const DIY_PLANS = plansForAudience(AUDIENCE);

const demoListItems = [
  { label: 'Peinture murale mate blanche', detail: '1 pot 10 L + 1 pot 2,5 L' },
  { label: 'Sous-couche universelle', detail: '1 pot 10 L' },
  { label: 'Ruban de masquage 50 m', detail: '2 rouleaux' },
  { label: 'Bâche de protection 4 × 5 m', detail: '1 unité' },
];

const steps = [
  {
    title: 'Mesurez votre pièce',
    description:
      'Longueur, largeur, hauteur, ouvertures : la saisie guidée gère les pièces en L, T ou U et déduit portes et fenêtres.',
  },
  {
    title: 'Décrivez vos travaux',
    description:
      'Peinture, carrelage, sol, cloison… Indiquez le type de pose et votre niveau de bricolage : les pertes en dépendent.',
  },
  {
    title: 'Obtenez votre base de commande',
    description:
      'Le moteur déduit les ouvertures, applique les pertes de coupe du catalogue et compte les couches. Pas de forfait « +10 % au pif ».',
  },
  {
    title: 'Achetez juste ce qu’il faut',
    description:
      'Liste d’achats optimisée par conditionnement (pots, cartons, lés), budget estimé, export PDF et partage en un lien.',
  },
];

const proofPoints = [
  {
    title: 'Des pertes calculées, pas forfaitaires',
    description:
      'Chaque matériau a son facteur de perte selon le type de pose et votre niveau : de 5 % pour une pose droite experte à 20 % pour une pose en diagonale débutant.',
  },
  {
    title: 'Un catalogue français réel',
    description:
      'Produits, rendements et conditionnements réels du marché français : pots de 0,5 à 10 L, cartons de carrelage, lés de revêtement. Le calcul tombe sur ce qui existe en rayon.',
  },
  {
    title: 'Les ouvertures sont déduites',
    description:
      'Portes et fenêtres sont soustraites des surfaces à traiter, pièce par pièce. C’est souvent là que se cache le pot de trop.',
  },
  {
    title: 'Des pièces réelles, pas des rectangles',
    description:
      'Formes en L, T ou U, ouvertures déduites et zones à exclure : la saisie colle à la pièce telle qu’elle est, pas à une approximation rectangulaire.',
  },
];

export default function HomePage() {
  const { appUser, isGuest, isLoading, startGuestSession } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasSession = Boolean(appUser) || isGuest;

  const handleStartProject = async () => {
    setError('');

    if (hasSession) {
      router.push('/dashboard');
      return;
    }

    setLoading(true);
    try {
      await startGuestSession();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de démarrer le mode invité'));
    } finally {
      setLoading(false);
    }
  };

  const primaryCta = (extraClass = '') => (
    <button
      type="button"
      onClick={handleStartProject}
      disabled={loading || isLoading}
      className={`rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${extraClass}`}
    >
      {loading
        ? 'Démarrage...'
        : hasSession
          ? 'Reprendre mon projet'
          : 'Essayer sans compte'}
    </button>
  );

  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <MarketingHeader audience={AUDIENCE} switchTo="artisan" />

        {/* Hero */}
        <section className="mt-6 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
              Une base de commande calculée et sourcée
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
              Chiffrez vos matériaux sur la pièce réelle, pas au jugé.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-stone-700">
              Sur un chantier amateur, une part des pots, cartons et rouleaux
              finit à la cave. Chiffréo part de vos mesures — ouvertures
              déduites, pertes de coupe, couches — et vous propose une base de
              commande chiffrée, dont vous voyez le détail. À vous de la valider
              avant d&apos;acheter.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {primaryCta()}
              {!hasSession && (
                <Link
                  href="/register"
                  className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
                >
                  Créer un compte
                </Link>
              )}
            </div>

            <p className="mt-4 text-sm text-stone-600">
              Sans carte bancaire, sans inscription : votre brouillon devient un
              compte au moment de la sauvegarde.
            </p>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Aperçu de liste générée */}
          <div className="rounded-[2rem] bg-stone-950 p-7 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)] sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                Exemple de liste générée
              </p>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-stone-100">
                Chambre 12 m²
              </span>
            </div>
            <p className="mt-4 text-sm text-stone-300">
              Peinture murs + plafond, 2 couches, niveau débutant
            </p>
            <ul className="mt-5 space-y-3">
              {demoListItems.map((item) => (
                <li
                  key={item.label}
                  className="flex items-baseline justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="text-sm font-medium text-white">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-sm text-amber-200">
                    {item.detail}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-baseline justify-between border-t border-white/10 pt-4">
              <span className="text-sm text-stone-300">
                Ouvertures déduites · pertes incluses
              </span>
              <span className="text-lg font-semibold text-white">
                Budget estimé : 186 €
              </span>
            </div>
          </div>
        </section>

        {/* Parcours */}
        <section className="mt-24">
          <h2 className="max-w-2xl text-3xl font-semibold text-stone-950">
            De la mesure à la liste d&apos;achats en quatre étapes
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-6 shadow-[0_15px_50px_rgba(67,39,15,0.08)]"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-stone-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Preuve */}
        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(67,39,15,0.10)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
            D&apos;où vient le chiffre
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-stone-950">
            Un calcul que vous pouvez vérifier ligne par ligne
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {proofPoints.map((point) => (
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

        {/* Tarifs */}
        <section className="mt-24">
          <h2 className="text-3xl font-semibold text-stone-950">
            Des tarifs simples
          </h2>
          <p className="mt-3 max-w-xl text-base text-stone-700">
            Commencez gratuitement, passez à Pro quand vous enchaînez les
            chantiers. Sans engagement, annulable à tout moment.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {DIY_PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                tone={plan.highlighted ? 'highlighted' : 'surface'}
                badge={
                  plan.trialDays ? `Essai gratuit ${plan.trialDays} jours` : undefined
                }
                maxFeatures={4}
              />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Voir le détail des tarifs →
            </Link>
            <Link
              href={AUDIENCE_DEFINITIONS.artisan.landingPath}
              className="text-sm font-semibold text-stone-700 hover:text-stone-950"
            >
              {AUDIENCE_DEFINITIONS.artisan.switchLabel} Voir les offres
              Contractor →
            </Link>
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-10 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-stone-950">
            Votre liste d&apos;achats dans quelques minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            Démarrez en invité, mesurez votre pièce, et ne payez que ce que
            votre chantier demande vraiment.
          </p>
          <div className="mt-7 flex justify-center">{primaryCta()}</div>
        </section>

        <MarketingFooter currentPath="/" />
      </div>
    </main>
  );
}
