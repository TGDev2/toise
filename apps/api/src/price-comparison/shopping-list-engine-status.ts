/**
 * Aucun lien d'achat commissionné ne doit être rendu tant que les quantités
 * de la liste ne sont pas fiables : le moteur a longtemps eu des défauts
 * qui font par exemple acheter 14 pots de peinture au lieu de 2, ou de la
 * colle à carrelage à 48 fois la surface réelle. Envoyer un client acheter
 * une liste fausse via un lien commissionné est pire que de ne pas avoir de
 * lien : la commission touchée ne compense jamais la confiance perdue.
 *
 * Ne repasser à `true` que lorsque le moteur est corrigé et que son harnais
 * de non-régression (`estimations/__tests__/`) est vert sur le catalogue réel.
 *
 * Portée actuelle : lu par `PriceComparisonService.getBuyLinks`, le seul
 * endroit qui rend aujourd'hui un lien cliquable côté web
 * (`ShoppingListMaterials.tsx`). `comparePrices` porte aussi un
 * `product_url` dans sa réponse mais rien ne le rend en lien côté web pour
 * l'instant — si cela change, relire ce même flag avant d'écrire le rendu.
 */
export const SHOPPING_LIST_ENGINE_CORRECTED = false;
