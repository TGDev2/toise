import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:text-blue-500">
        &larr; Retour
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Dernière mise à jour : mars 2026
      </p>

      <div className="mt-8 space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            1. Données collectees
          </h2>
          <p className="mt-2">
            EstiMate collecte uniquement les données nécessaires au
            fonctionnement du service : adresse email, données de projet
            (dimensions, types de travaux), et photos uploadees pour
            l&apos;analyse par vision par ordinateur.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            2. Utilisation des données
          </h2>
          <p className="mt-2">
            Vos données sont utilisees exclusivement pour fournir le service
            d&apos;estimation de matériaux, gerer votre compte, et améliorer la
            précision de nos calculs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            3. Stockage et securite
          </h2>
          <p className="mt-2">
            Les données sont stockees de maniere securisee sur des serveurs
            conformes aux normes europeennes. Les mots de passe sont haches et
            les communications sont chiffrees via HTTPS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. Vos droits</h2>
          <p className="mt-2">
            Conformement au RGPD, vous disposez d&apos;un droit d&apos;accès, de
            rectification et de suppression de vos données personnelles. Vous
            pouvez supprimer votre compte à tout moment depuis les paramètres
            de votre profil.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. Cookies</h2>
          <p className="mt-2">
            EstiMate utilise uniquement des cookies essentiels au
            fonctionnement de l&apos;authentification. Aucun cookie de suivi
            publicitaire n&apos;est utilise.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Contact</h2>
          <p className="mt-2">
            Pour toute question relative a vos données personnelles,
            contactez-nous a privacy@estimate.app.
          </p>
        </section>
      </div>
    </main>
  );
}
