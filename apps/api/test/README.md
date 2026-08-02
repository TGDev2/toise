# Étages de test de l'API

Trois suites, trois portées. Elles ne sont **pas** interchangeables, et le nom de
fichier ne suffit pas à savoir ce qu'un vert atteste. Ce document existe parce
que l'inverse a coûté deux défauts de production.

| Suite | Commande | Portée |
| --- | --- | --- |
| `src/**/*.spec.ts` | `pnpm test` | Unitaire : une classe, collaborateurs mockés. |
| `test/*.e2e-spec.ts` | `pnpm test:e2e` | **Contrat HTTP**, pas end-to-end. |
| `test/integration/*.int-spec.ts` | `pnpm test:integration` | PostgreSQL réel, migrations réelles. |

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

Ciblent exactement cette liste, contre un vrai PostgreSQL. Pas de NestJS : les
services concernés sont instanciés directement avec de vrais dépôts, parce que
ce qui est testé relève de la base et non du conteneur d'injection. Monter
`AppModule` exigerait des credentials Firebase et Stripe qu'une CI ne devrait pas
détenir, sans rien ajouter à ces vérifications.

Deux défauts que seul cet étage pouvait voir, tous deux invisibles aux deux
autres :

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
recrée** `chiffreo_integration_test` à chaque démarrage. En local,
`docker compose up postgres` suffit ; les identifiants viennent de
`DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD`, comme l'application.
`INTEGRATION_DB_NAME` permet d'en changer le nom — ne jamais le pointer sur une
base à conserver.

## Ce qui reste non couvert

À dire explicitement, plutôt que de le laisser croire couvert :

- aucun test ne traverse Firebase, Stripe ou le service CV **réels** ;
- la précision métrique du pipeline CV n'est pas démontrée sur corpus annoté —
  `apps/cv-service/tests/_synthetic_room.py` construit ses scènes et ses cartes
  de profondeur pour être reconnaissables par l'algorithme testé, et documente
  cette limite ; c'est un garde-fou de non-régression, pas un banc de précision.
