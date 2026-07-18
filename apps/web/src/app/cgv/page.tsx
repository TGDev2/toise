import type { Metadata } from 'next';
import { LegalLayout, Section, P, Bullets, Fill, LegalLink } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description:
    'Conditions générales de vente (CGV) des abonnements EstiMate : offres, prix, paiement, résiliation et droit de rétractation.',
  alternates: { canonical: '/cgv' },
};

export default function CgvPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updated="juillet 2026">
      <Section title="1. Objet et champ d’application">
        <P>
          Les présentes conditions générales de vente (les « CGV ») régissent la
          souscription et le paiement des offres payantes du service EstiMate
          (les offres « Pro » et « Contractor »). Elles complètent les{' '}
          <LegalLink href="/cgu">
            conditions générales d’utilisation
          </LegalLink>{' '}
          et s’appliquent à tout client, consommateur ou professionnel,
          souscrivant une offre payante.
        </P>
      </Section>

      <Section title="2. Identité du vendeur">
        <P>
          Le vendeur est la société identifiée dans nos{' '}
          <LegalLink href="/mentions-legales">mentions légales</LegalLink> :
        </P>
        <Bullets>
          <li>
            <strong>Dénomination :</strong>{' '}
            <Fill>dénomination ou raison sociale</Fill>
          </li>
          <li>
            <strong>Siège social :</strong>{' '}
            <Fill>adresse complète du siège social</Fill>
          </li>
          <li>
            <strong>SIRET :</strong> <Fill>numéro SIRET</Fill>
          </li>
          <li>
            <strong>Contact :</strong> contact@estimate.app
          </li>
        </Bullets>
      </Section>

      <Section title="3. Offres et prix">
        <P>
          Le détail des offres et leurs prix figurent sur la page{' '}
          <LegalLink href="/pricing">tarifs</LegalLink>, qui fait foi. À titre
          indicatif à la date de publication : offre Pro à 9,99 €/mois (avec 7
          jours d’essai gratuit) et offre Contractor à partir de 50 €/mois selon
          trois niveaux.
        </P>
        <P>
          Les prix sont indiqués en euros.{' '}
          <Fill>
            préciser TTC/HT et le taux de TVA applicable, ou la mention « TVA non
            applicable, art. 293 B du CGI »
          </Fill>
          . Les prix peuvent évoluer ; le prix applicable est celui en vigueur
          au moment de la souscription ou du renouvellement, le client étant
          informé au préalable de toute modification.
        </P>
      </Section>

      <Section title="4. Souscription de l’abonnement">
        <P>
          La souscription s’effectue en ligne depuis un compte EstiMate. Le
          processus comprend la sélection de l’offre, la vérification des
          informations et la validation de la commande. La validation, réalisée
          au moyen d’un bouton indiquant « commande avec obligation de paiement »
          ou une formule équivalente, emporte acceptation des présentes CGV et
          formation du contrat. Un e-mail confirme la souscription.
        </P>
      </Section>

      <Section title="5. Paiement">
        <P>
          Le paiement s’effectue par carte bancaire via notre prestataire de
          paiement sécurisé Stripe. EstiMate ne collecte ni ne conserve les
          données de carte bancaire. Le prix est prélevé à la souscription (à
          l’issue de l’éventuelle période d’essai), puis à chaque reconduction.
          En cas de défaut ou de refus de paiement, l’accès aux fonctionnalités
          payantes peut être suspendu.
        </P>
      </Section>

      <Section title="6. Durée, reconduction et résiliation">
        <P>
          Les abonnements sont conclus pour une durée d’un mois, reconduits
          tacitement par périodes successives d’un mois, sans engagement de
          durée. Le client peut résilier à tout moment depuis son espace
          abonnement ; la résiliation prend effet à la fin de la période en
          cours et l’accès est maintenu jusqu’à cette date. Conformément à
          l’article L215-1-1 du Code de la consommation, la résiliation peut
          être effectuée en ligne par un moyen simple et directement accessible.
        </P>
      </Section>

      <Section title="7. Période d’essai gratuite">
        <P>
          L’offre Pro inclut une période d’essai gratuite de 7 jours. Aucun
          montant n’est prélevé pendant l’essai. Si le client ne résilie pas
          avant la fin de l’essai, l’abonnement payant débute automatiquement au
          tarif en vigueur. Le client peut résilier à tout moment pendant
          l’essai, sans frais.
        </P>
      </Section>

      <Section title="8. Droit de rétractation">
        <P>
          Le client consommateur dispose d’un délai de quatorze (14) jours à
          compter de la souscription de l’abonnement pour exercer son droit de
          rétractation, sans avoir à motiver sa décision ni à supporter de
          pénalités.
        </P>
        <P>
          En souscrivant, le client demande expressément à bénéficier d’un accès
          immédiat au Service, avant l’expiration du délai de rétractation. Cet
          accès immédiat <strong>n’emporte pas renonciation</strong> au droit de
          rétractation.
        </P>
        <P>
          En cas de rétractation après avoir demandé cette exécution immédiate,
          le client est redevable d’un montant proportionnel au service déjà
          fourni à la date de communication de sa décision, calculé sur la base
          du prix total de l’abonnement. Cette retenue proportionnelle ne
          s’applique que si le client a été préalablement informé de son droit
          de rétractation et de ces modalités et y a consenti, conformément aux
          articles L221-25 et L221-28 du Code de la consommation ; à défaut,
          aucun montant ne peut être retenu.
        </P>
        <P>
          Pour exercer ce droit, le client notifie sa décision par une
          déclaration dénuée d’ambiguïté (par exemple un e-mail à
          contact@estimate.app) ou au moyen du formulaire type figurant en
          annexe. Le remboursement éventuel intervient dans un délai de 14 jours
          suivant la réception de la décision de rétractation, par le même moyen
          de paiement que celui utilisé lors de la souscription.
        </P>
      </Section>

      <Section title="9. Facturation">
        <P>
          Un reçu est adressé par e-mail à chaque paiement. Toute facture peut
          être demandée à contact@estimate.app.
        </P>
      </Section>

      <Section title="10. Garantie légale de conformité">
        <P>
          Le Service est fourni conformément à sa description. Le consommateur
          bénéficie de la garantie légale de conformité applicable aux contenus
          et services numériques, prévue aux articles L224-25-1 et suivants du
          Code de la consommation, indépendamment de toute garantie
          commerciale.
        </P>
      </Section>

      <Section title="11. Responsabilité">
        <P>
          Les estimations fournies par le Service sont indicatives. Les
          conditions et limites de responsabilité applicables sont détaillées
          dans les{' '}
          <LegalLink href="/cgu">
            conditions générales d’utilisation
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="12. Données personnelles">
        <P>
          Les traitements de données personnelles liés à la souscription et au
          paiement sont décrits dans la{' '}
          <LegalLink href="/privacy">
            politique de confidentialité
          </LegalLink>
          .
        </P>
      </Section>

      <Section title="13. Service client et réclamations">
        <P>
          Pour toute question ou réclamation relative à un abonnement, le client
          peut contacter le service client à contact@estimate.app.
        </P>
      </Section>

      <Section title="14. Médiation de la consommation">
        <P>
          Conformément aux articles L611-1 et suivants du Code de la
          consommation, le client consommateur peut recourir gratuitement à un
          médiateur de la consommation en vue de la résolution amiable d’un
          litige, après avoir adressé une réclamation écrite au vendeur. Le
          médiateur compétent est :{' '}
          <Fill>
            nom et coordonnées du médiateur de la consommation (à désigner avant
            la commercialisation)
          </Fill>
          . Le client peut également utiliser la plateforme européenne de
          règlement en ligne des litiges :
          https://ec.europa.eu/consumers/odr.
        </P>
      </Section>

      <Section title="15. Droit applicable et litiges">
        <P>
          Les présentes CGV sont soumises au droit français. À défaut de
          résolution amiable, les tribunaux français sont compétents, sous
          réserve des règles impératives de compétence applicables aux
          consommateurs.
        </P>
      </Section>

      <Section title="16. Modification des CGV">
        <P>
          L’éditeur peut modifier les présentes CGV. La version applicable à une
          commande est celle en vigueur à la date de celle-ci.
        </P>
      </Section>

      <Section title="Annexe — Formulaire type de rétractation">
        <P>
          (Veuillez compléter et renvoyer ce formulaire uniquement si vous
          souhaitez vous rétracter du contrat.)
        </P>
        <div className="rounded-2xl border border-stone-200 bg-[var(--surface)] p-5 text-sm leading-7">
          <p>
            À l’attention de <Fill>dénomination, adresse postale</Fill> —
            contact@estimate.app :
          </p>
          <p className="mt-3">
            Je vous notifie par la présente ma rétractation du contrat portant
            sur l’abonnement ci-dessous :
          </p>
          <ul className="mt-3 space-y-1.5">
            <li>— Abonnement souscrit le : …………………………………</li>
            <li>— Nom du client : …………………………………</li>
            <li>— Adresse du client : …………………………………</li>
            <li>— Date : …………………………………</li>
            <li>
              — Signature (uniquement en cas de notification papier) :
              …………………………………
            </li>
          </ul>
        </div>
      </Section>
    </LegalLayout>
  );
}
