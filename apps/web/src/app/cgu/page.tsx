import type { Metadata } from 'next';
import { LegalLayout, Section, P, Bullets, LegalLink } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation',
  description:
    'Conditions générales d’utilisation (CGU) du service Chiffréo : accès, compte, obligations, responsabilité et propriété intellectuelle.',
  alternates: { canonical: '/cgu' },
};

export default function CguPage() {
  return (
    <LegalLayout
      title="Conditions générales d’utilisation"
      updated="juillet 2026"
    >
      <Section title="1. Objet">
        <P>
          Les présentes conditions générales d’utilisation (les « CGU »)
          régissent l’accès et l’utilisation du site et de l’application
          Chiffréo (le « Service »), édités par la société identifiée dans nos{' '}
          <LegalLink href="/mentions-legales">mentions légales</LegalLink>.
          L’utilisation d’une offre payante est en outre régie par nos{' '}
          <LegalLink href="/cgv">
            conditions générales de vente
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="2. Acceptation des conditions">
        <P>
          En créant un compte ou en utilisant le Service, y compris les
          calculateurs accessibles sans compte, l’utilisateur reconnaît avoir
          pris connaissance des présentes CGU et les accepter sans réserve. À
          défaut d’acceptation, il lui appartient de ne pas utiliser le Service.
        </P>
      </Section>

      <Section title="3. Description du service">
        <P>
          Chiffréo est un outil d’aide à l’estimation de quantités de matériaux
          de travaux (peinture, carrelage, sols, etc.). Le Service permet
          notamment de :
        </P>
        <Bullets>
          <li>
            estimer des quantités de matériaux à partir des dimensions saisies
            ou, en version bêta, d’une analyse de photos ;
          </li>
          <li>
            organiser des projets, générer une liste de courses et suivre un
            chantier ;
          </li>
          <li>
            pour les professionnels, établir des devis (fonctionnalités des
            offres dédiées).
          </li>
        </Bullets>
        <P>
          Les estimations sont fournies <strong>à titre purement indicatif</strong>.
          Elles dépendent des informations saisies et de facteurs de perte
          moyens ; l’analyse d’images est proposée en version bêta et peut
          comporter des approximations. L’utilisateur reste seul responsable de
          la vérification des quantités avant tout achat ou engagement.
        </P>
      </Section>

      <Section title="4. Accès au service et inscription">
        <P>
          Certaines fonctionnalités nécessitent la création d’un compte.
          L’utilisateur s’engage à fournir des informations exactes et à les
          tenir à jour. Il est responsable de la confidentialité de ses
          identifiants et de toute activité réalisée depuis son compte. Toute
          utilisation non autorisée doit être signalée sans délai à
          contact@chiffreo.fr.
        </P>
      </Section>

      <Section title="5. Comptes gratuits et abonnements payants">
        <P>
          Le Service est proposé selon une offre gratuite (limitée en nombre de
          projets actifs) et des offres payantes (Pro et Contractor). Le détail
          et le prix des offres figurent sur la page{' '}
          <LegalLink href="/pricing">tarifs</LegalLink>. La souscription et le
          paiement d’une offre payante sont régis par les{' '}
          <LegalLink href="/cgv">
            conditions générales de vente
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="6. Obligations de l’utilisateur">
        <P>L’utilisateur s’engage à :</P>
        <Bullets>
          <li>utiliser le Service conformément à la loi et aux présentes CGU ;</li>
          <li>
            ne pas porter atteinte au fonctionnement du Service (tentative
            d’intrusion, contournement des limitations d’usage, sollicitations
            automatisées abusives) ;
          </li>
          <li>
            ne téléverser que des contenus dont il détient les droits et qui ne
            portent pas atteinte aux droits de tiers ;
          </li>
          <li>
            ne pas utiliser le Service à des fins frauduleuses ou pour diffuser
            des contenus illicites.
          </li>
        </Bullets>
      </Section>

      <Section title="7. Contenus transmis par l’utilisateur">
        <P>
          L’utilisateur conserve la propriété des contenus qu’il transmet
          (photos, dimensions, informations de projet). Il concède à l’éditeur
          une licence limitée, non exclusive et pour la seule durée nécessaire à
          la fourniture du Service, aux fins de traiter ces contenus (y compris
          l’analyse d’images) et de lui restituer une estimation. Le traitement
          des données à caractère personnel est décrit dans la{' '}
          <LegalLink href="/privacy">
            politique de confidentialité
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="8. Propriété intellectuelle">
        <P>
          Le Service, sa marque, ses interfaces, son code et sa base de données
          de matériaux sont protégés par le droit de la propriété
          intellectuelle. Aucune disposition des présentes ne confère à
          l’utilisateur un droit de propriété sur le Service. Toute
          reproduction ou exploitation non autorisée est interdite.
        </P>
      </Section>

      <Section title="9. Disponibilité et évolutions du service">
        <P>
          L’éditeur s’efforce d’assurer la disponibilité du Service sans pouvoir
          la garantir de manière ininterrompue. Le Service peut être suspendu
          pour maintenance ou faire l’objet d’évolutions, de corrections ou de
          suppressions de fonctionnalités, notamment celles en version bêta.
        </P>
      </Section>

      <Section title="10. Responsabilité">
        <P>
          Le Service étant un outil d’aide à la décision fournissant des
          estimations indicatives, l’éditeur ne saurait être tenu responsable
          des écarts de quantités, des surcoûts, pertes de matériaux ou dommages
          indirects résultant de l’usage du Service. La responsabilité de
          l’éditeur ne pourra en tout état de cause être engagée qu’en cas de
          faute prouvée et dans les limites permises par la loi.
        </P>
      </Section>

      <Section title="11. Suspension et résiliation">
        <P>
          L’utilisateur peut supprimer son compte à tout moment depuis les
          paramètres de son profil. L’éditeur peut suspendre ou résilier l’accès
          d’un utilisateur en cas de manquement aux présentes CGU, dans le
          respect d’un préavis raisonnable sauf manquement grave.
        </P>
      </Section>

      <Section title="12. Données personnelles">
        <P>
          Les traitements de données personnelles réalisés dans le cadre du
          Service sont décrits dans la{' '}
          <LegalLink href="/privacy">
            politique de confidentialité
          </LegalLink>
          , conformément au RGPD.
        </P>
      </Section>

      <Section title="13. Modification des CGU">
        <P>
          L’éditeur peut modifier les présentes CGU afin de les adapter aux
          évolutions du Service ou à la réglementation. Les utilisateurs sont
          informés des modifications substantielles ; la version applicable est
          celle en vigueur à la date d’utilisation du Service.
        </P>
      </Section>

      <Section title="14. Droit applicable, réclamations et médiation">
        <P>
          Les présentes CGU sont soumises au droit français. En cas de
          difficulté, l’utilisateur est invité à contacter au préalable le
          service client à contact@chiffreo.fr. Le consommateur peut également
          recourir gratuitement à un médiateur de la consommation, dans les
          conditions précisées dans nos{' '}
          <LegalLink href="/cgv">
            conditions générales de vente
          </LegalLink>
          . À défaut de résolution amiable, les tribunaux français sont
          compétents.
        </P>
      </Section>

      <Section title="15. Contact">
        <P>
          Pour toute question relative aux présentes CGU :
          contact@chiffreo.fr.
        </P>
      </Section>
    </LegalLayout>
  );
}
