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
  pendingLegalReview = false,
  children,
}: {
  title: string;
  updated: string;
  /**
   * Affiche le bandeau de relecture juridique. À poser sur toute page dont une
   * clause a été rédigée en interne et n'a pas encore été relue — aujourd'hui
   * les CGU et les CGV, dont la limitation de responsabilité doit être
   * appréciée au regard de l'article 1170 du Code civil.
   */
  pendingLegalReview?: boolean;
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
          {pendingLegalReview && <LegalReviewNotice />}
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

/**
 * Bandeau de relecture juridique. Rendu impossible à manquer — même traitement
 * visuel que `Fill`, en plus large — parce qu'il ne protège de rien s'il se lit
 * comme une note de bas de page : le jour de la mise en vente, c'est lui qui
 * doit arrêter la main de celui qui publie.
 */
export function LegalReviewNotice() {
  return (
    <div
      role="note"
      className="mt-6 rounded-2xl border border-amber-300/70 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900"
    >
      <p className="font-semibold">
        À faire relire par un juriste avant la mise en vente
      </p>
      <p className="mt-1">
        Ce texte a été rédigé en interne et n’a pas encore été relu par un
        professionnel du droit. La clause de limitation de responsabilité, en
        particulier, doit être appréciée au regard de l’article 1170 du Code
        civil : une clause qui priverait de sa substance l’obligation
        essentielle du contrat serait réputée non écrite. Il ne s’agit pas d’un
        conseil juridique.
      </p>
    </div>
  );
}

/**
 * Corps de la clause de limitation de responsabilité, partagé par les CGU et
 * les CGV.
 *
 * Il est ici et pas recopié dans les deux pages pour une raison de fond : les
 * CGV renvoyaient aux CGU pour les limites de responsabilité, et un utilisateur
 * gratuit n'a que les CGU. Deux rédactions concurrentes de la même limite
 * finiraient par diverger, et c'est la plus faible des deux qu'un juge lirait.
 *
 * La rédaction tient compte de l'article 1170 du Code civil (jurisprudences
 * Chronopost puis Faurecia) : plutôt que d'exclure la responsabilité sur les
 * « écarts de quantités » — ce qui reviendrait à vider l'obligation essentielle
 * et rendrait la clause réputée non écrite —, elle définit d'abord ce sur quoi
 * l'éditeur s'engage réellement (mettre à disposition un calcul documenté et
 * traçable), puis limite le reste. Le plafond n'est opposable qu'aux clients
 * professionnels : opposé à un consommateur, il tomberait sous l'article
 * R212-1 6° du Code de la consommation.
 */
export function LiabilityClause() {
  return (
    <>
      <P>
        <strong>Ce sur quoi l’éditeur s’engage.</strong> Le Service met à
        disposition un outil de calcul : à partir des dimensions saisies par
        l’utilisateur, il applique des ratios de consommation et des facteurs de
        perte issus de sources documentées, et restitue une base de commande
        accompagnée du détail du calcul et de ses sources. L’engagement de
        l’éditeur porte sur la mise à disposition de cet outil et sur la
        diligence apportée au choix, à la documentation et à la mise à jour des
        données qu’il applique.
      </P>
      <P>
        <strong>Ce que le Service ne promet pas.</strong> La quantité restituée
        est une proposition, et non un engagement sur le résultat de l’achat ou
        de la mise en œuvre. Elle dépend de la fidélité
        des mesures saisies, des conditions réelles du chantier et des choix de
        mise en œuvre. Il appartient à l’utilisateur de la vérifier et, le cas
        échéant, de la corriger avant tout achat, toute commande ou tout
        engagement pris envers un tiers ; l’utilisateur professionnel le fait
        sous sa propre compétence technique. Le Service conserve la trace de
        cette validation.
      </P>
      <P>
        <strong>Étendue de la réparation.</strong> L’éditeur répond des dommages
        directs résultant d’un manquement à l’engagement décrit ci-dessus. Sont
        exclus les dommages indirects, notamment la perte d’exploitation, la
        perte de chiffre d’affaires, la perte de clientèle et l’atteinte à
        l’image.
      </P>
      <P>
        <strong>Plafond, opposable aux seuls professionnels.</strong> À l’égard
        d’un utilisateur professionnel, la réparation due par l’éditeur au titre
        d’un même fait générateur ne peut excéder le montant des sommes versées
        par cet utilisateur au cours des douze mois qui l’ont précédé. Ce
        plafond n’est opposable à aucun consommateur.
      </P>
      <P>
        <strong>Réserves.</strong> Les stipulations qui précèdent ne
        s’appliquent ni au dommage corporel, ni à la faute lourde ou dolosive,
        ni à ce que la loi interdit d’exclure ou de limiter. Elles ne portent
        atteinte ni aux garanties légales applicables, ni aux droits que
        l’utilisateur consommateur tient d’une disposition d’ordre public.
      </P>
    </>
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
