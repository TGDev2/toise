# Affiliation ManoMano / Leroy Merlin — ce qu'il faut avant d'activer

> Préparation de BACKLOG_V1 E5-4, août 2026. Ce document n'a pas valeur de
> conseil juridique : il fixe ce qu'il faut obtenir côté partenaire et ce que
> la loi française exige sur un lien commissionné, avec les sources
> consultées. La décision finale (mentions exactes, formulation) doit être
> validée avec un juriste avant mise en production.
>
> **Ce document prépare l'activation. Il ne l'active pas.** Aucun compte
> n'est créé, aucune gate n'est modifiée. Le garde-fou côté code qui bloque
> tout lien d'achat tant que ce document n'a pas débouché sur un moteur
> d'estimation corrigé est décrit en fin de fichier et vit dans
> `apps/api/src/price-comparison/shopping-list-engine-status.ts`.

---

## 0. État du code aujourd'hui

Les deux adaptateurs (`apps/api/src/price-comparison/adapters/manomano/`,
`.../leroymerlin/`) et le moteur de rapprochement catalogue↔flux
(`matching/material-product-matcher.ts`) sont écrits, testés, et prêts à
consommer un flux réel. Ce qui manque n'est pas du code : c'est un compte
marchand par enseigne et l'URL du flux produits qui en découle
(`MANOMANO_FEED_URL` / `LEROY_MERLIN_FEED_URL`, `.env.example`).

## 1. Compte marchand

Les alias de colonnes déjà codés dans les deux feed clients
(`aw_product_id`, `aw_deep_link`, `search_price`, `merchant_category` —
`manomano-feed.client.ts:24-46`, `leroymerlin-feed.client.ts:25-47`) sont le
vocabulaire du réseau d'affiliation **Awin** : le code a été écrit pour ce
réseau. Recherche publique à l'appui : ManoMano FR est référencé chez Awin
sous le programme #17547 ([profil marchand Awin](https://ui.awin.com/merchant-profile/17547)).
Leroy Merlin est également listé chez Awin, mais un agrégateur tiers
(non-officiel) indiquait la campagne « en pause » au moment de cette
recherche — **à vérifier directement dans le tableau de bord Awin lors de la
candidature**, pas pris pour acquis ici.

**Démarche** : un compte éditeur (« publisher ») Awin, puis une candidature
distincte à chacun des deux programmes marchands (ManoMano, Leroy Merlin) —
chaque enseigne valide ou refuse indépendamment. Prévoir : SIRET/forme
juridique de Chiffréo, description du site, volume de trafic estimé, RIB
pour le versement des commissions. Le taux de commission (ManoMano
annoncé jusqu'à 7 % selon les catégories sur des sources publiques,
non contractuelles) n'est connu avec certitude qu'à l'acceptation.

Si le programme Leroy Merlin est indisponible sur Awin au moment de la
candidature, l'alternative documentée dans le code lui-même est d'ouvrir
d'abord ManoMano seul : `LeroyMerlinFeedSyncService`/`LeroyMerlinAdapter`
restent inertes tant que `LEROY_MERLIN_ENABLED` n'est pas positionné, sans
rien casser côté ManoMano (`SupplierRegistry.registerDefaults()` enregistre
chaque adaptateur indépendamment de l'autre).

## 2. Format et contenu du flux produits

Awin distribue les flux en **CSV (tabulation ou pipe) ou XML, UTF-8 avec
BOM**, éventuellement compressés en `.gz` — exactement ce que
`CsvRowParser` (`adapters/shared/csv-row-parser.ts`) et les feed clients
savent déjà lire, gzip compris.

Colonnes déjà résolues par alias dans le code (le premier alias présent
dans l'en-tête gagne — `FEED_COLUMNS` dans chaque feed client) :

| Donnée | Alias acceptés |
|---|---|
| Identifiant produit | `aw_product_id`, `product_id`, `id`, `sku`, `reference` |
| Titre | `product_name`, `name`, `title`, `nom`, `libelle` |
| Prix | `search_price`, `price`, `display_price`, `prix`, `sale_price` |
| Devise | `currency`, `devise`, `curr` |
| Lien affilié | `aw_deep_link`, `merchant_deep_link`, `deep_link`, `product_url`, `url`, `lien` |
| Disponibilité | `in_stock`, `stock_status`, `availability`, `disponibilite` |
| Catégorie | `merchant_category`, `category_name`, `categorie`, `category`, `category_path` |
| Marque | `brand_name`, `brand`, `marque` |

**Contrainte structurelle du catalogue Chiffréo** (rappelée en tête de
`material-product-matcher.ts`) : le catalogue n'offre que trois signaux pour
rapprocher un matériau d'un produit — un **nom français en texte libre**,
une **catégorie** parmi cinq, une **unité** parmi cinq. Pas de référence, pas
d'EAN, pas de mot-clé côté Chiffréo. C'est pourquoi le rapprochement se fait
par score textuel (§2 du script, ci-dessous) et pas par identifiant exact —
et pourquoi le taux de rapprochement doit être mesuré avant de s'engager,
plutôt que supposé.

## 3. Fréquence de rafraîchissement

Awin récupère le flux hébergé sur un cycle **quotidien** (norme du réseau).
Côté code, `feedTtlHours` vaut déjà **24 h** par défaut pour les deux
enseignes (`configuration.ts:88,96`, `MANOMANO_FEED_TTL_HOURS` /
`LEROY_MERLIN_FEED_TTL_HOURS`) — aucun changement de code n'est nécessaire
sur ce point, la valeur par défaut est déjà cohérente avec la fréquence
attendue du partenaire.

## 4. Règles d'attribution

La fenêtre de cookie et le modèle d'attribution (dernier clic, en général,
chez Awin) sont propres à chaque programme marchand et ne sont pas publiés
publiquement — **à obtenir dans les conditions du programme au moment de la
candidature**. Ne pas deviner cette valeur : elle détermine si une commission
est due, donc elle engage financièrement le partenariat.

## 5. Mentions légales obligatoires en France sur un lien commissionné

Cadre applicable (sources consultées le 05/08/2026) :

- **Code de la consommation, art. L.121-1** — une pratique commerciale est
  trompeuse si elle omet ou dissimule une information substantielle de
  façon inintelligible, ambiguë ou à contretemps. La DGCCRF qualifie un lien
  affilié non signalé comme relevant de cette catégorie.
  ([Encadrement juridique des liens d'affiliation](https://aidejuridiquegratuit.fr/encadrement-juridique-des-liens-daffiliation-sur-un-site-e-commerce/))
- **Loi n° 2023-451 du 9 juin 2023** visant à encadrer l'influence
  commerciale, assouplie par l'**ordonnance du 6 novembre 2024** : les
  mentions doivent être **claires et compréhensibles pour le public**, à
  proximité immédiate du lien. Les formulations citées par la DGCCRF (via
  la presse spécialisée) incluent « lien commercial », « partenariat
  rémunéré », ou équivalent adapté au format.
  ([Légifrance — loi n° 2023-451](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047663185))
- **Sanctions** : l'absence de mention claire est susceptible de qualifier
  une pratique commerciale trompeuse — jusqu'à deux ans d'emprisonnement et
  300 000 € d'amende (personne physique), au barème du code de la
  consommation.

**Constat sur le code actuel.** `ShoppingListMaterials.tsx:216` pose déjà
`rel="noopener noreferrer sponsored"` sur le lien « Acheter chez X » — bon
réflexe technique (SEO, robots), mais **invisible pour un utilisateur
humain** : cet attribut ne satisfait pas à lui seul l'exigence de mention
claire et proche du lien. Avant toute activation réelle, il faudra ajouter
un texte visible (par ex. « lien commercial » en petit, à côté ou sous le
bouton). **Ce point n'est pas traité dans ce lot** — il est consigné ici
comme item de la check-list §7, pas implémenté, pour rester dans le
périmètre demandé (documenter, pas activer).

## 6. Registre partenaire à servir

À remplir une fois les comptes ouverts — aucune valeur n'est inventée ici :

| Enseigne | Réseau | ID programme | Statut | URL de flux | Commission | Fenêtre cookie | Contact |
|---|---|---|---|---|---|---|---|
| ManoMano | Awin | — | à candidater | — | — | — | — |
| Leroy Merlin | Awin | — | à vérifier (campagne signalée en pause par un tiers) | — | — | — | — |

## 7. Check-list avant d'activer réellement un lien

- [ ] Compte Awin éditeur ouvert et validé
- [ ] Candidature ManoMano acceptée, `MANOMANO_FEED_URL` renseignée
- [ ] Candidature Leroy Merlin acceptée (ou explicitement différée),
      `LEROY_MERLIN_FEED_URL` renseignée le cas échéant
- [ ] Registre §6 rempli avec les valeurs réelles (commission, cookie)
- [ ] Extrait du flux réel passé dans
      `pnpm --filter @chiffreo/api validate:affiliate-feed <extrait>`
      (§8) et taux de rapprochement jugé suffisant sur le sous-ensemble V1
- [ ] Mention légale visible ajoutée à côté du bouton « Acheter chez X »
      (§5, non faite dans ce lot)
- [ ] Épopée E1 (`docs/BACKLOG_V1.md`) clôturée et son harnais de
      non-régression E1-9 vert sur le catalogue réel
- [ ] `SHOPPING_LIST_ENGINE_CORRECTED` (§9) repassé à `true`, avec le commit
      qui l'accompagne référençant la clôture d'E1

## 8. Mesurer le taux de rapprochement avant de s'engager

`apps/api/src/scripts/validate-affiliate-feed.ts` prend un extrait local du
flux produits obtenu du partenaire et le confronte au catalogue matériaux
réel, sans rien écrire en base ni appeler de service réseau — il réutilise
tel quel le moteur de rapprochement de production
(`MaterialProductMatcher`).

```bash
cd apps/api
pnpm validate:affiliate-feed chemin/vers/extrait.csv
# ou, si le partenaire fournit un extrait compressé :
pnpm validate:affiliate-feed chemin/vers/extrait.csv.gz
```

Le rapport donne, pour le catalogue actif complet et pour le sous-ensemble
V1 (matériaux réellement liés à un ouvrage, `work_type_materials`) :
lignes lues, taux global, répartition par catégorie, et le détail
matériau par matériau (rapproché ou non, produit retenu et score si oui).
C'est ce dernier chiffre — le taux sur le **sous-ensemble V1**, pas sur les
208 entrées du catalogue complet — qui répond à la question « combien de
lignes de liste porteront réellement un lien ».

## 9. Garde-fou dans le code

`apps/api/src/price-comparison/shopping-list-engine-status.ts` expose :

```ts
export const SHOPPING_LIST_ENGINE_CORRECTED = false;
```

Lue par `PriceComparisonService.getBuyLinks`
(`price-comparison.service.ts:198`), en toute première ligne : tant que la
constante vaut `false`, `GET /projects/:id/shopping-list/buy-links` renvoie
systématiquement `{ "links": [] }`, indépendamment de l'état des comptes,
des flux ou des feature gates. Cette constante est indépendante de
`MANOMANO_ENABLED`/`LEROY_MERLIN_ENABLED` : elle protège contre un défaut du
**moteur d'estimation** (quantités fausses, BACKLOG_V1 épopée E1), pas
contre l'absence de flux marchand.

Elle ne doit être repassée à `true` qu'une fois l'épopée E1 clôturée et son
harnais de non-régression (E1-9) vert sur le catalogue réel — pas avant,
et pas par anticipation.
