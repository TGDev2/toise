import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Un compte invité est un compte anonyme Firebase (E2-1).
 *
 * **Le jeton fait autorité, pas la base.** `users.auth_provider` n'est qu'un
 * miroir de ce claim : `AuthService.resolveProvider` le recopie à chaque
 * `POST /auth/sync`. Décider un droit sur la colonne plutôt que sur le claim
 * introduirait une seconde source de vérité pour la même question, et la
 * fenêtre où les deux divergent est précisément le moment de la conversion —
 * celui qu'il ne faut surtout pas casser.
 *
 * Conséquence pratique : les gardes qui s'appuient sur ce prédicat n'ont
 * **aucune dépendance à injecter**, puisque `FirebaseAuthGuard` a déjà posé le
 * jeton décodé sur la requête. Un guard sans dépendance ne peut pas rejouer la
 * panne de la leçon 19 (`@UseGuards` instancie le guard dans l'injecteur du
 * module *appelant*, qui doit donc réimporter ses dépendances — ou l'oublier).
 *
 * **Filet de conversion.** `linkWithCredential` transforme le compte anonyme en
 * compte inscrit sans le déconnecter : le jeton courant peut encore porter
 * `sign_in_provider: 'anonymous'` le temps d'un rafraîchissement. Un tel jeton
 * porte en revanche l'e-mail du fournisseur qui vient d'être lié — e-mail,
 * Google et Apple en fournissent tous un. Un jeton anonyme *avec* e-mail est
 * donc un jeton périmé, jamais un invité : le traiter comme inscrit évite de
 * bloquer l'utilisateur à la seconde exacte où il vient de créer son compte.
 */
export function isGuestToken(token: DecodedIdToken): boolean {
  if (token.firebase?.sign_in_provider !== 'anonymous') return false;
  return !token.email;
}
