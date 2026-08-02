import Link from 'next/link';

/**
 * Pied de page commun aux surfaces publiques. Il était recopié sur `/`,
 * `/pricing` et `/calculateurs` avec trois listes de liens déjà divergentes —
 * `/artisans` en aurait fait une quatrième.
 */
const LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/artisans', label: 'Artisans' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/calculateurs', label: 'Calculateurs gratuits' },
  { href: '/verifier-un-devis', label: 'Vérifier un devis' },
  { href: '/community', label: 'Réalisations' },
  { href: '/cgu', label: 'CGU' },
  { href: '/cgv', label: 'CGV' },
  { href: '/privacy', label: 'Confidentialité' },
  { href: '/mentions-legales', label: 'Mentions légales' },
];

export function MarketingFooter({ currentPath }: { currentPath?: string }) {
  const links = LINKS.filter((link) => link.href !== currentPath);

  return (
    <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-300/60 pt-8 text-sm text-stone-600 sm:flex-row">
      <p>© {new Date().getFullYear()} Chiffréo</p>
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-stone-950">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
