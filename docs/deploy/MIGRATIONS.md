# Migrations et retour arrière — la règle « expand puis contract »

Ce document s'adresse à qui **écrit** une migration. La procédure d'exploitation
correspondante — comment revenir en arrière quand un déploiement tourne mal —
est dans [`docs/DEPLOY.md`](../DEPLOY.md) § Retour arrière.

## 1. Le problème, en une phrase

Les migrations sont appliquées **au démarrage du conteneur API**
(`dist/scripts/migrate.js`, avant `node dist/main.js`). Un retour arrière, lui,
ne fait que repasser des images. Donc **le schéma ne recule jamais** : après un
retour arrière, la version N-1 du code tourne contre le schéma de la version N.

Il n'y a que deux façons de rendre cette situation sûre. Soit le schéma de N
reste utilisable par le code de N-1 — c'est la règle ci-dessous. Soit on
restaure une sauvegarde, en perdant toutes les écritures depuis le déploiement.
La première est gratuite et se décide au moment d'écrire la migration ; la
seconde coûte des données et se subit à 3 h du matin.

## 2. La règle

> Une migration livrée avec le code qui l'utilise n'a le droit d'être
> qu'**additive**. Ce qui supprime ou contraint part à la version **suivante**.

Concrètement, une migration de la version N doit satisfaire les deux sens :

- le code N tourne sur le schéma N (évident, c'est ce qu'on teste) ;
- **le code N-1 tourne aussi sur le schéma N** (c'est ce qu'on oublie).

### Autorisé dans la même version que le code (*expand*)

- ajouter une colonne **nullable**, ou avec une valeur par défaut ;
- ajouter une table, un index, une valeur d'énumération ;
- ajouter une contrainte que le code N-1 respecte déjà de fait ;
- remplir (*backfill*) une colonne nouvellement ajoutée.

### Interdit dans cette version, à reporter à la suivante (*contract*)

- `DROP COLUMN`, `DROP TABLE` — N-1 les lit encore ;
- `RENAME` — c'est un `DROP` déguisé pour N-1 ;
- `SET NOT NULL` sur une colonne existante — N-1 peut y écrire `NULL` ;
- rétrécir un type, ajouter un `UNIQUE` sur une colonne existante — N-1 peut
  produire des valeurs que la contrainte refuse ;
- `DELETE` / `TRUNCATE` de données métier — aucun `down()` ne les rend.

### Les découpes usuelles

| Ce qu'on veut | Version N (*expand*) | Version N+1 (*contract*) |
|---|---|---|
| Renommer `a` en `b` | ajouter `b`, remplir depuis `a`, écrire dans les deux, lire `b` | supprimer `a` |
| Rendre `c` obligatoire | remplir les `NULL`, valider côté application | `SET NOT NULL` |
| Supprimer `d` | cesser de lire et d'écrire `d` | `DROP COLUMN d` |
| Changer le type de `e` | ajouter `e_new`, double écriture, lire `e_new` | supprimer `e`, renommer |

La version N+1 n'est sûre que parce que N-1 n'est alors plus une cible de
retour arrière : à ce moment-là, le seul retour envisagé est vers N, qui vit
très bien sans `a`.

## 3. Le garde-fou

[`check-migration-compat.mjs`](check-migration-compat.mjs) analyse les
migrations **ajoutées** entre deux références git et cherche dans leur `up()`
les motifs `DROP COLUMN`, `DROP TABLE`, `RENAME`, `SET NOT NULL`, `DELETE FROM`
et `TRUNCATE`.

- En revue de PR (`ci.yml`, job *Migrations*) : une migration destructive non
  déclarée rend la CI **rouge**.
- Au déploiement (`deploy.yml`) : la comparaison porte sur
  `<tag précédent>..<tag>`, et le verdict apparaît dans le résumé du job —
  c'est lui qui dit à l'opérateur si la bascule d'images suffira.

Une migration purement additive n'a **rien à déclarer** : l'oubli est sûr.
Assumer un point de non-retour, en revanche, s'écrit, en commentaire dans la
migration elle-même :

```ts
// @compat contract
// Le champ n'est plus lu depuis v1.4.0 ; cette version le supprime.
```

**Ce que le contrôle ne voit pas**, et qui reste à la charge du relecteur : un
`CREATE UNIQUE INDEX` sur une colonne existante, un rétrécissement de type, une
contrainte `CHECK` ajoutée, et toute incompatibilité qui ne s'exprime pas en
SQL (un format de valeur qui change dans une colonne `jsonb`, par exemple).
Le script attrape le gros ; il ne dispense pas de lire.

## 4. Pourquoi `down()` n'est pas une procédure de retour arrière

Les 79 migrations de ce dépôt ont toutes un `down()`. Aucune ne devrait être
appelée en production. Elles existent pour le développement local et pour la
vérification de réversibilité en intégration — pas pour réparer une production.

L'inventaire est sans appel :

| Migration | Ce que ferait son `down()` en production |
|---|---|
| `006-SeedMaterialsCatalog` | `TRUNCATE materials_catalog CASCADE` — emporte tout le référentiel du moteur de prix et ses six tables dépendantes |
| `031-CreateRoomsAndReparentGeometry` | `DELETE` de la géométrie de toute pièce autre que la première : les projets multi-pièces sont amputés |
| `054-CreateOrganizations` | supprime `organization_id` de 5 tables — les lignes appartenant à une organisation non personnelle perdent leur propriétaire ; adhésions et invitations détruites |
| `063-SplitStripeEventClaimAndProcessing` | marque « traités » les événements Stripe **jamais traités** : ils ne seront plus rejoués, les abonnements concernés restent désynchronisés |
| `073-ReplaceQuoteLaborBlockWithLines` | écrase le détail de main-d'œuvre des devis à plus d'une ligne |
| `074-RemoveWidgetApiKeysAndEnterprise` | recrée six tables **vides** : le `up()` était déjà sans retour |
| `062-AddActiveAnalysisJobUniqueIndex` | supprime l'index, sans défaire l'`UPDATE` destructif de son `up()` |
| `009-SeedComplementaryMaterials` | `DELETE FROM complementary_materials` sans clause : efface aussi ce que d'autres migrations et l'admin y ont ajouté |

Un `down()` fidèle est de toute façon impossible dès que le `up()` a détruit ou
agrégé de l'information : le code peut défaire un `ALTER`, jamais réinventer ce
qu'il a effacé.

**Et de fait, la production ne peut pas les exécuter.** `pnpm migration:revert`
passe par la CLI TypeORM sous `ts-node`, avec les sources TypeScript et
`tsconfig-paths` : l'image de production ne contient ni les unes ni l'autre.
C'est heureux, et c'est délibérément laissé tel quel — la commande est un outil
de développement local, et rien dans la procédure d'exploitation ne l'appelle.

## 5. Ce qu'on gagne

Quand la règle est tenue, un retour arrière de production est cette
chose-là, et rien de plus :

```bash
IMAGE_TAG=<tag précédent> docker compose -f docker-compose.prod.yml pull api web
IMAGE_TAG=<tag précédent> docker compose -f docker-compose.prod.yml up -d --wait api web
```

Le schéma reste en avant. Les colonnes ajoutées par la version fautive restent
là, vides et ignorées, jusqu'à ce qu'on redéploie ou qu'une version ultérieure
les retire. C'est le prix — dérisoire — d'un retour arrière qui ne perd aucune
donnée.
