import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { CALCULATOR_SLUGS, getCalculatorConfig } from '@/lib/calculators';

export const metadata: Metadata = {
  title: 'Calculateurs travaux gratuits',
  description:
    'Calculateurs gratuits pour vos travaux de rénovation : peinture, carrelage, parquet. Estimez vos quantités de matériaux en quelques secondes, sans inscription.',
  alternates: { canonical: '/calculateurs' },
  openGraph: {
    title: 'Calculateurs travaux gratuits | EstiMate',
    description:
      'Estimez vos quantités de matériaux (peinture, carrelage, parquet) en quelques secondes, sans inscription.',
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

        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            Calculateurs travaux gratuits
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-stone-700">
            Estimez les quantités de matériaux de votre chantier en quelques
            secondes : dimensions de la pièce, ouvertures, et c’est calculé.
            Sans inscription.
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
            EstiMate transforme votre estimation en projet complet : liste de
            courses, suivi de chantier et devis. Deux projets offerts, sans
            carte bancaire.
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

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-300/60 pt-8 text-sm text-stone-600 sm:flex-row">
          <p>© {new Date().getFullYear()} EstiMate</p>
          <nav className="flex gap-6">
            <Link href="/" className="hover:text-stone-950">
              Accueil
            </Link>
            <Link href="/pricing" className="hover:text-stone-950">
              Tarifs
            </Link>
            <Link href="/privacy" className="hover:text-stone-950">
              Confidentialité
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
