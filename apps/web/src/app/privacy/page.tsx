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
    <LegalLayout title="Politique de confidentialité" updated="août 2026">
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
          7).
        </P>
      </Section>

      <Section title="3. Stockage et sécurité">
        <P>
          Les données sont stockées de manière sécurisée sur des serveurs
          conformes aux normes européennes. Les mots de passe sont hachés et les
          communications sont chiffrées via HTTPS.
        </P>
      </Section>

      <Section title="4. Conservation et suppression">
        <P>
          <strong>Un projet que vous supprimez</strong> disparaît immédiatement
          de votre compte et, s’il était partagé dans la galerie communautaire,
          de cette galerie. Ses données et ses photos sont conservées{' '}
          <strong>30 jours</strong>, puis effacées définitivement de nos serveurs
          — en base comme sur le disque — par une tâche automatique quotidienne.
          Ce délai existe pour qu’une suppression accidentelle reste
          rattrapable ; passé ce terme, plus rien n’est récupérable.
        </P>
        <P>
          <strong>Si vous supprimez votre compte</strong>, l’effacement est
          immédiat : votre abonnement est résilié, vos photos sont supprimées du
          disque, puis vos données et votre identifiant de connexion sont
          effacés. Aucun délai de grâce ne s’applique.
        </P>
        <P>
          Nos sauvegardes chiffrées sont conservées 14 jours par rotation. Une
          donnée effacée en disparaît donc au plus tard 14 jours après son
          effacement, soit 44 jours au pire cas après la suppression d’un projet.
        </P>
        <P>
          Deux exceptions, imposées par la loi ou par la nature des données. Les{' '}
          <strong>factures</strong> émises depuis Chiffréo sont conservées au
          titre des obligations comptables et fiscales (10 ans, code de commerce
          art. L123-22) ; elles ne contiennent ni photo ni donnée de chantier.
          Les projets appartenant à une <strong>organisation</strong> dont vous
          n’êtes pas le propriétaire lui restent acquis lorsque vous la quittez :
          votre nom en est détaché, les données restent celles de l’entreprise.
        </P>
      </Section>

      <Section title="5. Vos droits">
        <P>
          Conformément au RGPD, vous disposez d’un droit d’accès, de
          rectification, de suppression et de portabilité de vos données
          personnelles. Vous pouvez supprimer un projet ou votre compte à tout
          moment depuis l’application, avec les effets décrits à la section 4.
        </P>
        <P>
          Depuis votre tableau de bord, le bouton « Télécharger mes données »
          génère une archive contenant tout ce que porte votre compte : profil,
          organisations, projets (pièces, dimensions, ouvertures, exclusions et
          ouvrages), estimations, listes d’achat, clients, devis et factures
          (avec leurs PDF), abonnement et historique de facturation, sous la
          forme d’un fichier structuré et documenté. La génération peut prendre
          quelques instants ; l’archive reste disponible au téléchargement
          48 heures, puis elle est effacée du serveur.
        </P>
      </Section>

      <Section title="6. Cookies">
        <P>
          Chiffréo utilise uniquement des cookies essentiels au fonctionnement
          de l’authentification. Aucun cookie de suivi publicitaire n’est
          utilisé.
        </P>
      </Section>

      <Section title="7. Contact">
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
