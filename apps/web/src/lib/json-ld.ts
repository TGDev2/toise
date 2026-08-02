/**
 * Sérialise des données structurées pour un `<script type="application/ld+json">`.
 *
 * **Pourquoi ne pas appeler `JSON.stringify` directement.** Un bloc `<script>`
 * est un contexte de données brutes : l'analyseur HTML n'y interprète qu'une
 * seule chose, la séquence `</script`, qui ferme l'élément. `JSON.stringify`
 * échappe les guillemets, les antislashs et les caractères de contrôle — c'est
 * l'échappement du contexte *JSON*. Il ne touche ni `<` ni `>` ni `/`. Un titre
 * de projet communautaire valant `Salon</script><script>…` traverse donc
 * intact et exécute son contenu dans l'origine de l'application.
 *
 * `<` et `>` sont des échappements JSON valides : le JSON-LD produit
 * reste strictement équivalent pour les moteurs de recherche, mais ne peut plus
 * former `</script`. `&` est échappé pour la même raison en contexte HTML ;
 * U+2028 et U+2029 le sont parce qu'ils terminent une ligne pour un analyseur
 * JavaScript sans le faire pour JSON.
 *
 * À utiliser **systématiquement**, y compris sur des données statiques : la
 * seule règle qui tient dans le temps est celle qu'on n'a pas à réévaluer page
 * par page. La page `/community/[id]` est celle où le manquement était
 * exploitable, mais rien dans son code ne la distinguait des pages sûres.
 */

/** La forme \u00e9chapp\u00e9e est calcul\u00e9e depuis le point de code, pas lue dans une
 * table : une table se d\u00e9synchronise de son motif, une conversion non. */
const HTML_UNSAFE = /[<>&\u2028\u2029]/g;

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    HTML_UNSAFE,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}
