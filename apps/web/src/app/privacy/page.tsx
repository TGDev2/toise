import type { Metadata } from 'next';
import { LegalLayout, Section, P, LegalLink } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Politique de confidentialité d’Chiffréo : données collectées, utilisation, stockage, vos droits RGPD et cookies.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="juillet 2026">
      <Section title="1. Données collectées">
        <P>
          Chiffréo collecte uniquement les données nécessaires au fonctionnement
          du service : adresse email, données de projet (dimensions, types de
          travaux), et photos uploadées pour l’analyse par vision par
          ordinateur. Sur nos calculateurs gratuits accessibles sans compte,
          nous collectons également votre adresse e-mail lorsque vous demandez à
          recevoir votre estimation par e-mail, avec votre consentement
          explicite.
        </P>
      </Section>

      <Section title="2. Utilisation des données">
        <P>
          Vos données sont utilisées exclusivement pour fournir le service
          d’estimation de matériaux, gérer votre compte, et améliorer la
          précision de nos calculs.
        </P>
        <P>
          Lorsque vous demandez à recevoir une estimation par e-mail depuis un
          calculateur, votre adresse est utilisée pour vous envoyer cette
          estimation et, si vous y avez consenti, pour vous adresser
          occasionnellement des actualités Chiffréo. Vous pouvez à tout moment
          demander le retrait de votre adresse en nous contactant (voir section
          6).
        </P>
      </Section>

      <Section title="3. Stockage et sécurité">
        <P>
          Les données sont stockées de manière sécurisée sur des serveurs
          conformes aux normes européennes. Les mots de passe sont hachés et les
          communications sont chiffrées via HTTPS.
        </P>
      </Section>

      <Section title="4. Vos droits">
        <P>
          Conformément au RGPD, vous disposez d’un droit d’accès, de
          rectification et de suppression de vos données personnelles. Vous
          pouvez supprimer votre compte à tout moment depuis les paramètres de
          votre profil.
        </P>
      </Section>

      <Section title="5. Cookies">
        <P>
          Chiffréo utilise uniquement des cookies essentiels au fonctionnement
          de l’authentification. Aucun cookie de suivi publicitaire n’est
          utilisé.
        </P>
      </Section>

      <Section title="6. Contact">
        <P>
          Pour toute question relative à vos données personnelles, contactez-nous
          à privacy@chiffreo.fr. Pour les informations légales relatives à
          l’éditeur, consultez nos{' '}
          <LegalLink href="/mentions-legales">mentions légales</LegalLink>.
        </P>
      </Section>
    </LegalLayout>
  );
}
