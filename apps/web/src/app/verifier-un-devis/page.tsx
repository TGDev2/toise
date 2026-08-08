import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { QuoteCheckForm } from '@/components/quote-check/QuoteCheckForm';
import { serializeJsonLd } from '@/lib/json-ld';
import { QUOTE_CHECK_FAQ, QUOTE_CHECK_PAGE } from '@/lib/quote-check';

export const metadata: Metadata = {
  title: QUOTE_CHECK_PAGE.title,
  description: QUOTE_CHECK_PAGE.metaDescription,
  alternates: { canonical: `/${QUOTE_CHECK_PAGE.slug}` },
  openGraph: {
    title: `${QUOTE_CHECK_PAGE.title} | Chiffréo`,
    description: QUOTE_CHECK_PAGE.metaDescription,
    url: `/${QUOTE_CHECK_PAGE.slug}`,
  },
};

/**
 * GTM-10 — la seule surface qui lit le moteur à l'envers.
 *
 * Le récit de cette page tient dans la décision § 4.7 de PRODUCT_STRATEGY :
 * Chiffréo mesure, il n'arbitre pas. D'où un titre qui annonce des quantités et
 * non un jugement, et aucune promesse de prix nulle part — ni ici, ni dans le
 * verdict, où un test l'interdit.
 */
const WHAT_IT_CHECKS = [
  {
    title: 'La surface réellement à traiter',
    description:
      'Portes, fenêtres, crédence, demi-mur, plinthes : ce qui n’est pas traité est retiré avant toute comparaison. Un devis établi sur la surface brute se voit immédiatement.',
  },
  {
    title: 'La marge de perte que la quantité implique',
    description:
      'L’écart entre la quantité annoncée et la surface nette est traduit en pourcentage de perte, la grandeur dans laquelle un professionnel raisonne.',
  },
  {
    title: 'La fourchette du catalogue pour cette pose',
    description:
      'Pose droite ou en diagonale, du chantier de débutant à celui de professionnel confirmé : la référence vient du même catalogue qui sert à chiffrer un achat.',
  },
  {
    title: 'Ce que la pièce demande, matériau par matériau',
    description:
      'La traduction en pots, boîtes et paquets, à recouper avec les lignes de fourniture quand le devis en détaille.',
  },
];

export default function QuoteCheckPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUOTE_CHECK_FAQ.map((item) => ({
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
        <MarketingHeader
          extraLink={{ href: '/calculateurs', label: 'Calculateurs gratuits' }}
        />

        <section className="mt-6 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            {QUOTE_CHECK_PAGE.h1}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            {QUOTE_CHECK_PAGE.intro}
          </p>
        </section>

        <section className="mt-12 rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-6 sm:p-8">
          <QuoteCheckForm />
        </section>

        <section className="mt-24">
          <h2 className="text-3xl font-semibold text-stone-950">
            Ce que ce contrôle regarde
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-700">
            Il compare une quantité de matériaux à la pièce que vous décrivez.
            Il ne juge ni le chiffrage, ni la main-d’œuvre, ni l’entreprise — il
            n’en sait rien, et le dire fait partie du résultat.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {WHAT_IT_CHECKS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-5"
              >
                <h3 className="text-base font-semibold text-stone-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {item.description}
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
            {QUOTE_CHECK_FAQ.map((item) => (
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

        <section className="mt-24 rounded-[2rem] border border-stone-200/80 bg-white/80 p-8 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Vous faites les travaux vous-même ?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-stone-700">
            Le même calcul, mené dans l’autre sens, donne la liste de ce qu’il
            faut acheter — conditionnements du marché français compris.
          </p>
          <Link
            href="/calculateurs"
            className="mt-6 inline-block rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white"
          >
            Voir les calculateurs gratuits
          </Link>
        </section>

        <MarketingFooter currentPath={`/${QUOTE_CHECK_PAGE.slug}`} />
      </div>
    </main>
  );
}
