import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const FOOTER_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/cgu', label: 'CGU' },
  { href: '/cgv', label: 'CGV' },
  { href: '/privacy', label: 'Confidentialité' },
  { href: '/mentions-legales', label: 'Mentions légales' },
];

/** Public shell shared by every legal page (CGU, CGV, mentions, confidentialité). */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between py-6">
          <Link href="/">
            <Logo height={30} />
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

        <article className="mt-6">
          <h1 className="text-3xl font-semibold text-stone-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Dernière mise à jour : {updated}
          </p>
          <div className="mt-8 space-y-8 text-stone-700">{children}</div>
        </article>

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-300/60 pt-8 text-sm text-stone-600 sm:flex-row">
          <p>© {new Date().getFullYear()} Chiffréo</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-stone-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </main>
  );
}

/** A numbered/titled block of legal text. */
export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-3">
      <h2 className="text-xl font-semibold text-stone-950">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="leading-7">{children}</p>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 leading-7 marker:text-stone-400">
      {children}
    </ul>
  );
}

/** Internal link styled with the brand accent. */
export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
    >
      {children}
    </Link>
  );
}

/**
 * Marks a field that must be filled with real legal data before commercial
 * launch. Renders as a highlighted `[À compléter : …]` so it is impossible to
 * miss in the rendered page.
 */
export function Fill({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1.5 py-0.5 text-sm font-medium text-amber-900 ring-1 ring-amber-300/60">
      [À compléter : {children}]
    </mark>
  );
}
