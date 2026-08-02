import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { PublicCalculator } from '@/components/calculators/PublicCalculator';
import { CALCULATOR_SLUGS, getCalculatorConfig } from '@/lib/calculators';
import { serializeJsonLd } from '@/lib/json-ld';

export const dynamicParams = false;

export function generateStaticParams() {
  return CALCULATOR_SLUGS.map((type) => ({ type }));
}

interface PageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const config = getCalculatorConfig(type);
  if (!config) return {};

  return {
    title: config.title,
    description: config.metaDescription,
    alternates: { canonical: `/calculateurs/${config.slug}` },
    openGraph: {
      title: `${config.title} | Chiffréo`,
      description: config.metaDescription,
      url: `/calculateurs/${config.slug}`,
    },
  };
}

const HOW_IT_WORKS = [
  {
    title: '1. Mesurez votre pièce',
    description:
      'Longueur, largeur, hauteur — en mètres ou en pieds. Ajoutez portes et fenêtres pour un calcul au plus juste.',
  },
  {
    title: '2. Obtenez vos quantités',
    description:
      'Surface exacte, marge de perte adaptée à votre niveau, et conditionnements à acheter : le calcul est immédiat.',
  },
  {
    title: '3. Sauvegardez votre projet',
    description:
      'En un clic, transformez votre calcul en projet Chiffréo : liste de courses complète et suivi de chantier.',
  },
];

export default async function CalculatorPage({ params }: PageProps) {
  const { type } = await params;
  const config = getCalculatorConfig(type);
  if (!config) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between py-6">
          <Link href="/">
            <Logo height={30} />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/calculateurs"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-950 sm:block"
            >
              Tous les calculateurs
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-800 hover:border-stone-500 hover:bg-white"
            >
              Se connecter
            </Link>
          </nav>
        </header>

        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            {config.h1}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            {config.intro}
          </p>
        </section>

        <section className="mt-12 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-6 sm:p-8">
          <PublicCalculator config={config} />
        </section>

        <section className="mt-24">
          <h2 className="text-3xl font-semibold text-stone-950">
            Comment ça marche ?
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-5"
              >
                <h3 className="text-base font-semibold text-stone-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24">
          <h2 className="text-3xl font-semibold text-stone-950">
            Questions fréquentes
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {config.faq.map((item) => (
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

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-300/60 pt-8 text-sm text-stone-600 sm:flex-row">
          <p>© {new Date().getFullYear()} Chiffréo</p>
          <nav className="flex gap-6">
            <Link href="/" className="hover:text-stone-950">
              Accueil
            </Link>
            <Link href="/calculateurs" className="hover:text-stone-950">
              Calculateurs
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
