import type { Metadata } from 'next';
import { LegalLayout, Section, P, Bullets, Fill, LegalLink } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Mentions légales du site et de l’application Chiffréo : éditeur, directeur de la publication, hébergeur et informations légales.',
  alternates: { canonical: '/mentions-legales' },
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updated="juillet 2026">
      <Section title="1. Éditeur du site">
        <P>
          Le site et l’application Chiffréo (ci-après « Chiffréo ») sont édités
          par :
        </P>
        <Bullets>
          <li>
            <strong>Dénomination sociale :</strong>{' '}
            <Fill>dénomination ou raison sociale</Fill>
          </li>
          <li>
            <strong>Forme juridique :</strong>{' '}
            <Fill>forme juridique (ex. SAS, EURL, entreprise individuelle)</Fill>
          </li>
          <li>
            <strong>Capital social :</strong>{' '}
            <Fill>montant du capital social, le cas échéant</Fill>
          </li>
          <li>
            <strong>Siège social :</strong>{' '}
            <Fill>adresse complète du siège social</Fill>
          </li>
          <li>
            <strong>Immatriculation :</strong>{' '}
            <Fill>
              n° RCS et ville du greffe, ou n° au Répertoire des métiers
            </Fill>
          </li>
          <li>
            <strong>SIRET :</strong> <Fill>numéro SIRET (14 chiffres)</Fill>
          </li>
          <li>
            <strong>N° de TVA intracommunautaire :</strong>{' '}
            <Fill>
              n° de TVA, ou mention « TVA non applicable, art. 293 B du CGI »
            </Fill>
          </li>
          <li>
            <strong>Adresse e-mail :</strong> contact@chiffreo.fr
          </li>
          <li>
            <strong>Téléphone :</strong> <Fill>numéro de téléphone</Fill>
          </li>
        </Bullets>
      </Section>

      <Section title="2. Directeur de la publication">
        <P>
          Le directeur de la publication est{' '}
          <Fill>nom du directeur de la publication</Fill>.
        </P>
      </Section>

      <Section title="3. Hébergement">
        <P>Le site est hébergé par :</P>
        <Bullets>
          <li>
            <strong>Hébergeur :</strong> <Fill>nom de l’hébergeur</Fill>
          </li>
          <li>
            <strong>Adresse :</strong> <Fill>adresse de l’hébergeur</Fill>
          </li>
          <li>
            <strong>Téléphone :</strong> <Fill>téléphone de l’hébergeur</Fill>
          </li>
        </Bullets>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <P>
          L’ensemble des éléments composant Chiffréo (marque, logo, textes,
          interfaces, base de données de matériaux, code source, visuels) est
          protégé par le droit de la propriété intellectuelle et demeure la
          propriété exclusive de l’éditeur ou de ses partenaires. Toute
          reproduction, représentation, modification ou exploitation, totale ou
          partielle, sans autorisation écrite préalable, est interdite et
          susceptible de constituer une contrefaçon.
        </P>
      </Section>

      <Section title="5. Responsabilité">
        <P>
          Les estimations de quantités de matériaux fournies par Chiffréo sont
          communiquées à titre indicatif. Elles reposent sur les informations
          saisies par l’utilisateur et, le cas échéant, sur une analyse
          d’images en version bêta. L’utilisateur reste seul responsable de la
          vérification des quantités, de ses achats et de ses décisions de
          chantier. L’éditeur ne saurait être tenu responsable des écarts,
          surplus ou manques constatés, ni des dommages indirects résultant de
          l’utilisation du service. Les conditions détaillées figurent dans nos{' '}
          <LegalLink href="/cgu">
            conditions générales d’utilisation
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="6. Liens hypertextes">
        <P>
          Chiffréo peut contenir des liens vers des sites tiers. L’éditeur
          n’exerce aucun contrôle sur ces sites et décline toute responsabilité
          quant à leur contenu ou à leur politique de confidentialité.
        </P>
      </Section>

      <Section title="7. Données personnelles">
        <P>
          Le traitement de vos données personnelles est décrit dans notre{' '}
          <LegalLink href="/privacy">
            politique de confidentialité
          </LegalLink>
          . Conformément au Règlement général sur la protection des données
          (RGPD) et à la loi « Informatique et Libertés », vous disposez d’un
          droit d’accès, de rectification, d’effacement, de portabilité et
          d’opposition sur vos données, que vous pouvez exercer à l’adresse
          contact@chiffreo.fr.
        </P>
      </Section>

      <Section title="8. Cookies">
        <P>
          Chiffréo utilise uniquement des cookies nécessaires au fonctionnement
          de l’authentification. Les modalités sont précisées dans la{' '}
          <LegalLink href="/privacy">
            politique de confidentialité
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="9. Contact">
        <P>
          Pour toute question relative au site ou aux présentes mentions
          légales, vous pouvez nous écrire à contact@chiffreo.fr.
        </P>
      </Section>
    </LegalLayout>
  );
}
