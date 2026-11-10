# Étages de test de l'API

Trois suites, trois portées. Elles ne sont **pas** interchangeables, et le nom de
fichier ne suffit pas à savoir ce qu'un vert atteste. Ce document existe parce
que l'inverse a coûté trois défauts de production.

| Suite | Commande | Portée |
| --- | --- | --- |
| `src/**/*.spec.ts` | `pnpm test` | Unitaire : une classe, collaborateurs mockés. |
| `src/estimations/__tests__/` | `pnpm test:engine-regression` | Le moteur sur le **catalogue réellement seedé**, instantanés figés. |
| `test/*.e2e-spec.ts` | `pnpm test:e2e` | **Contrat HTTP**, pas end-to-end. |
| `test/integration/*.int-spec.ts` | `pnpm test:integration` | PostgreSQL réel, migrations réelles, **et la résolution du graphe d'injection**. |

Aucune de ces commandes ne prouvait, jusqu'à `module-graph.int-spec.ts`, que
l'application démarre. Un vert complet est compatible avec un `AppModule` qui ne
se monte pas.

## `*.e2e-spec.ts` — contrat HTTP

Montent un `TestingModule` réduit aux contrôleurs, avec les services remplacés
par des mocks et `FirebaseAuthGuard` surchargé. Le suffixe `e2e-spec` est
historique : **aucune de ces suites ne monte `AppModule` et aucune ne touche une
base**.

Ce qu'elles prouvent : routage, `ValidationPipe`, forme des DTO, codes de statut,
et le passage de la portée organisation par les guards laissés réels (`ApiKeyGuard`,
`FeatureGateGuard`, `AdminGuard` selon les fichiers).

Ce qu'elles ne peuvent pas prouver, par construction :

- qu'une migration s'applique, se rejoue ou se révoque ;
- qu'une colonne lue par une entité existe réellement ;
- ce qu'une suppression emporte en cascade — et ce qu'elle ne doit pas emporter ;
- qu'une contrainte d'unicité fait ce que le code croit qu'elle fait ;
- ce que deux écritures simultanées produisent.

## `*.int-spec.ts` — intégration

Ciblent exactement cette liste, contre un vrai PostgreSQL. La plupart n'utilisent
pas NestJS : les services concernés sont instanciés directement avec de vrais
dépôts, parce que ce qui est testé relève de la base et non du conteneur
d'injection.

**Exception assumée — `module-graph.int-spec.ts`.** Ce fichier monte, lui,
`AppModule` en entier. Il existe parce que l'affirmation ci-dessus, longtemps
vraie, cachait un angle mort : 1 025 tests unitaires et 186 tests e2e étaient
verts pendant que `node dist/main.js` refusait de démarrer, sur deux
`UnknownDependenciesException`. Aucun étage ne montait l'assemblage, donc aucun
ne pouvait le voir. La résolution du graphe ne demande ni Firebase ni Stripe
réels — seulement la base, que cette suite a déjà.

Trois défauts que seul cet étage pouvait voir, tous invisibles aux deux
autres :

- **L'application ne démarrait pas.** Un guard appliqué par `@UseGuards` est
  instancié dans l'injecteur du module **appelant**, pas dans celui qui le
  fournit : chaque module devait donc réimporter les dépendances du guard
  (`OrgContextModule` pour `FeatureGateGuard`, `UsersModule` pour `AdminGuard`).
  Douze modules portaient la première parade, trois la seconde ; le premier oubli
  tuait l'application entière. Les deux modules fournisseurs ré-exportent
  désormais ces dépendances, et l'oubli est devenu sans conséquence.

- **Idempotence des webhooks Stripe.** `claimWebhookEvent` lisait
  `InsertResult.identifiers`, que TypeORM garnit depuis les valeurs d'entrée
  quand la clé primaire est fournie par l'appelant — donc toujours non vide, y
  compris quand le `ON CONFLICT DO NOTHING` n'avait rien inséré. Chaque relance
  Stripe était retraitée. La méthode n'était mockée qu'au niveau du contrôleur,
  jamais exécutée.
- **Perte de mise à jour sur `shopping_lists.items_json`.** Lecture-modification-
  écriture d'un blob JSONB sans verrou : deux corrections concurrentes sur deux
  lignes différentes de la même liste, et la seconde écrasait la première.

### Prérequis

Une base PostgreSQL joignable, avec le droit `CREATEDB` : la suite **supprime et
recrée** `toise_integration_test` à chaque démarrage. En local,
`docker compose up postgres` suffit ; les identifiants viennent de
`DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD`, comme l'application.
`INTEGRATION_DB_NAME` permet d'en changer le nom — ne jamais le pointer sur une
base à conserver.

## `src/estimations/__tests__/` — le harnais du moteur, et ses instantanés

Le défaut fondateur du dépôt : pour
repeindre les murs d'une pièce de 4 × 3 m sous 2,50 m — le cas le plus banal du
produit — le moteur produisait **54 lignes et 1 486 unités à acheter**, dont
70 pinceaux, 70 bâches et 3 pots de peinture plafond sur un ouvrage « peinture
murale ». Les 1 619 tests étaient verts. Ils l'étaient parce qu'aucun n'exécutait
le moteur sur le catalogue réel : `estimations.service.spec.ts` mocke *un*
matériau, `estimation-engine.spec.ts` n'en passe jamais plus de deux. **Une suite
structurellement incapable d'observer 54 lignes n'atteste rien.**

Ce harnais est l'inverse. Il énumère les cas depuis les données seedées — les
7 ouvrages de `projects/work-types.data.ts`, leurs matériaux liés non optionnels,
les 3 niveaux, toutes les poses que déclarent leurs facteurs de perte plus la
pose implicite — soit 39 cas, rejoués sur trois géométries : une chambre
rectangulaire, un séjour en L, et le projet qui réunit les deux. Rien n'y est
écrit à la main : délier un matériau change les instantanés sans que personne
ait à penser au harnais.

### La règle : un instantané ne se met à jour qu'avec une justification écrite

`jest -u` réécrit 125 blocs sans rien demander. Le message de commit qui
accompagne une mise à jour d'instantané doit donc dire, en clair : **quelle
quantité a bougé, de combien, et ce qui l'a décidée** — un rendement corrigé, un
facteur de perte re-sourcé, une liaison retirée. Un `-u` sans justification n'est
pas un détail de forme : c'est la seule manœuvre qui puisse rendre au moteur le
droit de produire à nouveau 54 lignes.

Ce que l'instantané **ne peut pas** prouver, et qu'il ne faut pas lui demander :
que le chiffre figé soit *juste*. Il atteste qu'il n'a pas changé. Rejoué sur le
moteur d'avant E1-1, il aurait figé les 54 lignes sans broncher. La justesse
vient d'ailleurs — des rendements sourcés fiche fabricant en main
(`docs/SOURCES_CATALOGUE.md`, imposés par `sources-catalogue.spec.ts`) et des
valeurs argumentées à la main de `estimation-engine.seeded-catalog.spec.ts`.

### Ce qui tient même si tous les instantanés sont réécrits

C'est la seule partie du harnais qu'un `-u` distrait n'emporte pas, donc la seule
sur laquelle la règle ci-dessus n'a pas à être crue sur parole :

- **aucune ligne fantôme** — un ouvrage chiffre exactement ses matériaux liés,
  ni toute sa catégorie ni moins ; c'est le garde-fou direct des 54 lignes ;
- **jamais sous-acheté** — le volume acheté couvre le besoin, sur chaque ligne
  des trois géométries (reconstitué format par format, pas via le contenu moyen
  d'un achat panaché) ;
- **un matériau principal** reste lié à chaque ouvrage ;
- **la mutualisation ENG-2 ne coûte jamais plus cher** que l'achat pièce par
  pièce, et **évite réellement** des contenants sur ce jeu de pièces — une
  inégalité large seule serait vraie d'un moteur cassé ;
- **l'inventaire des 39 cas est lui-même figé**, parce qu'un instantané devenu
  obsolète ne fait *jamais* échouer jest, `--ci` compris : un cas qui
  disparaîtrait laisserait la suite verte. Ici, sa disparition est une ligne
  supprimée dans un diff.
- **le rendu est vérifié contre une référence écrite dans le fichier de test** :
  les 125 instantanés passent par la même fonction, et un défaut d'alignement les
  dégraderait tous à la fois.

Précédent qui justifie cette liste : `estimation-engine.seeded-catalog.spec.ts`
filtrait les quantités absurdes d'accessoires sur `/Pinceau|Rouleau|Bâche/`.
E1-7 ayant retiré les outils des liaisons, ce filtre ne correspondait plus à
aucun matériau chiffré — le test valait `expect([]).toEqual([])`, vert et vide,
sans que rien ne le signale. Il a été retiré.

### `--ci`, et pourquoi il est explicite

`pnpm test:engine-regression` passe `--ci` à jest. Sans lui, un instantané
**manquant** est écrit par jest puis validé dans la foulée : une suite dont le
`.snap` n'a jamais été committé passerait au vert en attestant ce qu'elle vient
d'observer. `CI=true` suffirait sur GitHub Actions ; l'écrire rend la garantie
vraie en local aussi, là où elle se vérifie.

Les `.snap` sont versionnés, et `.gitattributes` les force en `eol=lf` : jest lit
un instantané **brut** mais normalise la valeur reçue en `\n`, donc un fichier
récupéré en CRLF (`core.autocrlf=true`, le défaut Windows) ferait échouer tous
les blocs multi-lignes sur une différence invisible à l'écran.

### Ce que le harnais ne couvre pas

- **Les couches.** Seul le défaut de 2 couches est joué ; l'API publique en
  accepte 1 à 4.
- **La fourchette d'incertitude (CV-5) et les exclusions manuelles (ENG-3).**
  Les six champs `*_low`/`*_high` et `excluded_surface_m2` sont absents de tous
  les cas : aucune géométrie de référence ne porte d'incertitude ni de zone
  exclue. `computeSurfaceBounds` documente d'ailleurs une limite assumée — une
  pièce composée de segments n'a pas de fourchette au sol — qu'aucun test ne
  tient encore.
- **Les poses inatteignables en production.** Le harnais chiffre les poses que
  déclare le catalogue ; or seul `floor_tiling` pose la question du calepinage,
  et le DTO public restreint `laying_pattern` à `straight|diagonal`. Les poses
  `plain` du revêtement mural et `diagonal` du parquet ne sont donc atteignables
  qu'en écrivant `custom_params` directement. Elles sont figées comme données du
  catalogue que le moteur sait consommer, pas comme chemins utilisateurs.

## Ce qui reste non couvert

À dire explicitement, plutôt que de le laisser croire couvert :

- aucun test ne traverse Firebase, Stripe ou le service CV **réels** ;
- la précision métrique du pipeline CV n'est pas démontrée sur corpus annoté —
  `apps/cv-service/tests/_synthetic_room.py` construit ses scènes et ses cartes
  de profondeur pour être reconnaissables par l'algorithme testé, et documente
  cette limite ; c'est un garde-fou de non-régression, pas un banc de précision.
