import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { CALCULATOR_SLUGS, getCalculatorConfig } from '@/lib/calculators';

export const metadata: Metadata = {
  title: 'Calculateurs travaux : combien acheter, pas combien de m²',
  description:
    'Peinture, carrelage, parquet : des calculateurs gratuits qui déduisent ce que vous ne traitez pas, suivent les pièces en L et ajustent la marge de perte à votre niveau. Sans inscription.',
  alternates: { canonical: '/calculateurs' },
  openGraph: {
    title: 'Calculateurs travaux : combien acheter, pas combien de m² | Chiffréo',
    description:
      'Surface nette, pièces en L et marge de perte selon votre niveau — pour peinture, carrelage et parquet. Sans inscription.',
    url: '/calculateurs',
  },
};

const CALCULATOR_ICONS: Record<string, string> = {
  peinture: '\u{1F3A8}',
  carrelage: '\u{1FAA8}',
  sol: '\u{1FAB5}',
};

export default function CalculatorsHubPage() {
  const configs = CALCULATOR_SLUGS.map((slug) => getCalculatorConfig(slug)!);

  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <MarketingHeader audience="diy" />

        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            Combien acheter, pas combien de m²
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            Le mètre carré, tout le monde sait le calculer. Ces calculateurs
            retirent ce que vous ne traitez pas, suivent les pièces en L et
            ajustent la marge de perte à votre niveau et à votre pose — puis
            convertissent le tout en pots et en paquets. Gratuit, sans
            inscription.
          </p>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          {configs.map((config) => (
            <Link
              key={config.slug}
              href={`/calculateurs/${config.slug}`}
              className="rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-7 transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_50px_rgba(67,39,15,0.10)]"
            >
              <span aria-hidden className="text-3xl">
                {CALCULATOR_ICONS[config.slug]}
              </span>
              <h2 className="mt-4 text-xl font-semibold text-stone-950">
                {config.h1}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {config.intro}
              </p>
              <span className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">
                Calculer gratuitement →
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-24 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-10 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-stone-950">
            Besoin de plus qu’un calcul ?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            Chiffréo transforme votre estimation en projet complet : liste
            d’achats optimisée par conditionnement, budget suivi en temps réel et
            carnet de vos pièces. Deux projets offerts, sans carte bancaire.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            >
              Créer un compte gratuit
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 hover:border-stone-500 hover:bg-white"
            >
              Voir les tarifs
            </Link>
          </div>
        </section>

        <MarketingFooter currentPath="/calculateurs" />
      </div>
    </main>
  );
}
