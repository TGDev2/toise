# Chiffréo — Document de reprise de projet

> Rédigé après lecture du dépôt à l'état `main` (99 commits, 802 fichiers suivis, ~100 000 lignes).
> Le diff de la copie de travail est un artefact de fins de ligne (48 398 insertions / 48 397 suppressions) : `HEAD` est représentatif.
> Convention : **[O]** observé dans le code · **[D]** déduit · **[?]** incertain.

> **⚠ Audit daté du 3 août 2026 — les décisions produit qu'il propose ont évolué.**
> Les arbitrages en vigueur sont ceux de l'[ADR 0001](adr/0001-cible-et-perimetre-v1.md),
> **amendé par l'[ADR 0002](adr/0002-modele-economique-facturation-distribution.md)** du
> 7 août 2026. En particulier : le tarif proposé ici (**un palier artisan à 19 €/mois**)
> est remplacé par « chiffrage gratuit et illimité + conformité à **279 €/an** », et la
> veille de `VEILLE_CONCURRENTIELLE.md` corrige le paysage concurrentiel décrit au §2.2.
> Le constat technique de ce document, lui, n'est pas affecté.

---

## 1. Verdict

**Le dépôt contient une plateforme presque complète autour d'un produit qui n'existe pas encore.**

Ce n'est pas une figure de style. Le parcours revendiqué — « photo ou dimensions → base de commande chiffrée sur la géométrie réelle » (à l'époque formulé en promesse d'exactitude, corrigé depuis : `docs/PROMESSE_PRODUIT.md`) — a été construit jusqu'à l'écran final, mais **la liste d'achat produite est fausse d'un ordre de grandeur**. J'ai rejoué le moteur sur le catalogue réellement seedé, pour le cas le plus banal du produit — repeindre les murs d'une pièce de 4 × 3 m sous 2,50 m, une porte, niveau intermédiaire :

```
Surface nette : 33,31 m²  →  liste générée : 54 lignes, 1 486 unités à acheter

  14 × Pot 0.5 L   Peinture acrylique mate
  14 × Pot 0.5 L   Peinture acrylique satinée
  13 × Pot 0.5 L   Peinture glycéro brillante
  17 × Pot 0.5 L   Peinture cuisine et salle de bain
  19 × Pot 0.5 L   Peinture anti-humidité
   3 × Pot 2.5 L   Peinture plafond mate          ← sur un ouvrage "peinture murale"
  70 × Unité       Rouleau laqueur 180mm
  70 × Unité       Pinceau plat 50mm
  70 × Unité       Bâche de protection 4x5m
  ...
```

Trois défauts indépendants se composent, tous vérifiés :

1. `loadMaterialInputs` charge **toute la catégorie** de matériaux, jamais les matériaux de l'ouvrage. Le champ prévu pour cela, `work_types.required_materials`, est seedé `'[]'` pour les 7 ouvrages et **n'est lu nulle part** (`estimations.service.ts:85-99`, migration `…003:51-58`, aucune occurrence hors entité et mocks). **[O]**
2. La multiplication par le nombre de couches est appliquée à **tout** matériau de catégorie `painting`, accessoires compris, dont le `yield_per_unit` vaut 1 (`estimation-engine.ts:234-250`). D'où 70 pinceaux. **[O]**
3. `selectBestPackaging` minimise le **surplus en volume**, jamais le coût ni le nombre d'unités (`estimation-engine.ts:252-286`). Pour 6,66 L : 14 pots de 0,5 L (surplus 0,34 L) l'emportent sur 3 pots de 2,5 L (surplus 0,84 L). Ce comportement est **verrouillé par un test** (`estimation-engine.spec.ts:294-302`). **[O]**

S'y ajoute un quatrième, du même ordre : `buildTilingContext` somme `surface_m2` sur toutes les lignes carrelage, soit 48 fois la même surface — la colle et le joint sont calculés sur un contexte ×48 (`shopping-lists.service.ts:1088-1090`). **[O]**

Aucun test ne voit ces défauts, parce que **aucun test n'exécute le moteur sur le catalogue réel** : `estimations.service.spec.ts:68-70` mocke *un* matériau. Les 1 619 cas de test du dépôt sont massivement au-dessus de la moyenne, et ils sont aveugles précisément là où le produit se joue.

Et le peu d'utilisateurs qui pourraient le constater ne le peuvent pas : **le parcours invité — toute la stratégie d'acquisition — meurt une étape avant l'estimation**. `work-selection` autorise l'invité (`!appUser && !isGuest`), `estimate` ne teste que `!appUser` et redirige vers `/login`, sans message (`estimate/page.tsx:57-59`). Un visiteur qui « essaie sans compte » ne voit jamais un résultat. **[O]**

Pendant ce temps, le dépôt a livré, entre le 1er et le 2 août 2026 — **39 commits en 48 heures** — : suivi de chantier, relances de devis, facturation conforme, galerie publique, parrainage, carnet du logement, e-mails de cycle de vie, module éco-matériaux, organisations multi-utilisateurs, API publique à clés, offre Enterprise avec SSO SAML/OIDC, widget marque blanche, facteurs de perte appris, benchmark de coûts anonymisé, clôture par les achats réels. Pour zéro utilisateur, sur un produit non déployé, dont le calcul central est faux.

**Pertinence de l'idée : réelle et intacte.** « Combien acheter, exactement, pour cette pièce » est un vrai problème, mal servi par les calculettes d'enseigne, et la brique géométrique du dépôt (union exacte de rectangles, formes en L/T/U, déduction des ouvertures et des exclusions, mutualisation multi-pièces avec `ceil(Σ) ≤ Σceil`) est d'excellente facture et rare. **Faisabilité : élevée** — il n'y a pas de verrou technique, il y a un verrou d'attention. **État : pré-alpha fonctionnel, déguisé en produit mature.**

---

## 2. Ce que le produit est réellement, et pour qui

### 2.1 Le produit effectif

Dépouillé des surfaces jamais atteintes, le dépôt contient **un calculateur de quantités de matériaux pour les ouvrages de finition, adossé à un catalogue français, prolongé par un devis et une facture conformes**.

Périmètre réel, non négociable à court terme **[O]** :

- **7 ouvrages**, tous de finition : peinture murale, peinture plafond, carrelage sol, carrelage mural, parquet/stratifié, cloison sèche, revêtement mural (migration `…003:51-58`). Ni plomberie, ni électricité, ni isolation, ni maçonnerie, ni menuiserie.
- **208 matériaux** seedés (54 peinture, 48 carrelage, 41 sol, 33 revêtement mural, 32 cloison), **sans aucun prix en base** — la table `materials_catalog` n'a pas de colonne prix. Tout prix vient d'une saisie utilisateur ou d'un flux fournisseur.
- **Un seul bloc de main-d'œuvre** par devis : horaire ou forfait (`quote.entity.ts:75-102`). Pas de ligne de MO par ouvrage, pas de déboursé sec.
- **Les matériaux servis par la V1 sont sourcés** (E1-7, `docs/SOURCES_CATALOGUE.md`) : 35 matériaux liés aux 7 ouvrages, chacun vérifié contre une fiche fabricant (URL + date), 15 rendements corrigés (migration `…070`), 14 matériaux non sourçables retirés des liaisons (migration `…071`) — un test l'impose (`sources-catalogue.spec.ts`). Le reste du catalogue (~170 entrées non liées) demeure non sourcé et hors périmètre chiffré. Les facteurs de perte restent six familles de nombres ronds, désormais assumés comme **valeurs d'usage métier sans référence normative** — l'appellation « catalogue DTU » a disparu du code et de la doc. **[O]**

### 2.2 L'utilisateur, et la situation où le produit devient utile

Deux candidats, et il faut trancher.

**Le particulier qui rénove.** Besoin réel, mais **épisodique** : un chantier tous les deux à cinq ans. Il ne reviendra pas. Un abonnement à 9,99 €/mois pour un besoin ponctuel est une thèse faible, et le dépôt en est conscient : `PRODUCT_STRATEGY.md §7.5` propose le « carnet du logement » comme antidote au churn structurel — un antidote a été construit (PLAT-1) avant que la maladie ait un seul porteur. Son alternative, aujourd'hui : la calculette gratuite de Leroy Merlin, qui suffit à 80 % des cas.

**L'artisan des métiers de finition** — peintre, carreleur, plaquiste, solier. Besoin **récurrent** : chaque devis, plusieurs fois par semaine. Volonté de payer démontrée par un marché à 15-30 €/mois (Tolteck 19 €, Obat 29 €, EBP 29,25 €). Et surtout : **ces outils lui font saisir les quantités à la main.** C'est le seul endroit où Chiffréo fait quelque chose que personne d'autre ne fait sur ce segment.

> **Corrigé le 7 août 2026** ([ADR 0002 §1](adr/0002-modele-economique-facturation-distribution.md)) : les deux affirmations de ce paragraphe sont fausses. Tolteck est à **25 € HT sans engagement, 19 € en annuel et 12,35 € pour une entreprise de moins de cinq ans**, tous corps d'état. Et **ArtisanSmart calcule bien des quantités** — 29 € HT/mois, 15 métiers, matériaux et heures de main-d'œuvre. Ce qui reste vrai et différenciant est la *méthode* : surface nette, pièces non rectangulaires, déduction des ouvertures, perte par pose et par niveau, conditionnement commercial, rendements sourcés — six gestes qu'aucun concurrent du panel ne documente ensemble.

**Arbitrage : l'artisan de finition est l'utilisateur de la V1. Le particulier reste une surface d'acquisition, pas une cible de revenu.**

Raisons, dans l'ordre :
1. Il revient. La question « quelle raison de revenir l'utiliser » a une réponse évidente pour lui et aucune pour le particulier.
2. Chez lui, une quantité fausse coûte de l'argent réel — donc une quantité juste vaut de l'argent réel. La valeur est mesurable en euros, pas en confort.
3. Son parcours est déjà le plus complet du dépôt : dimensions → ouvrage → estimation → liste → devis PDF conforme → facture numérotée sans trou. **[O]**
4. Il n'a **pas besoin de la vision par ordinateur** : il a un télémètre laser dans la poche. Cela permet de sortir du périmètre le composant le plus coûteux et le moins fiable (§3.3).

Ce que la V1 promet, et rien de plus : **« Chez le client, en dix minutes : je mesure, je choisis l'ouvrage, j'obtiens une base de commande que je valide, et un devis conforme que j'envoie avant de repartir. »**

Ce qu'elle ne promet pas, et doit le dire : couvrir la plomberie, l'électricité, la maçonnerie ; remplacer un logiciel de gestion ; mesurer une pièce à partir d'une photo.

### 2.3 Le parcours essentiel

```
Dimensions (saisie, formes L/T/U, ouvertures, exclusions)
   → Ouvrage + niveau + type de pose
   → Liste d'achat JUSTE (3 à 6 lignes, pas 54)
   → Prix saisis / liens d'achat
   → Devis PDF conforme (matériaux + main-d'œuvre par ouvrage)
   → Envoi au client
```

Six écrans. Tous existent déjà. **Deux maillons sur six sont faux ou absents** : la liste (§1) et la main-d'œuvre par ouvrage (§3.2).

---

## 3. Constats décisifs

Cinq problèmes déterminent l'avenir du projet. Le reste est du bruit tant qu'ils ne sont pas traités.

### 3.1 — À corriger immédiatement · Le calcul central est faux

**Constat.** Détaillé au §1 : absence de liaison ouvrage → matériaux, couches appliquées aux accessoires, conditionnement choisi sur le surplus volumique, contexte carrelage ×48.

**Conséquence concrète.** Un produit qui propose une base de commande calculée sur la géométrie réelle livre ici une liste qui ferait acheter environ dix fois trop, et fait passer un artisan pour un incompétent devant son client. C'est un défaut qui **détruit la confiance à la première utilisation** et qu'aucune communication ne rattrape.

**Coût du correctif.** Faible, et c'est le point important : ce n'est pas un problème d'architecture. Peupler `required_materials` (ou une table de liaison `work_type_materials`), filtrer dans `loadMaterialInputs`, conditionner les couches à un flag `applies_coats` porté par le matériau, réécrire `selectBestPackaging` sur le nombre d'unités puis le surplus relatif, corriger la déduplication du contexte carrelage. **Estimation : 3 à 5 jours, dont la moitié en curation de données.**

**Sans le faire, rien d'autre n'a de sens.** Le benchmark de coûts, les facteurs de perte appris, les liens d'affiliation, le widget, l'API — tout consomme cette sortie.

### 3.2 — À corriger immédiatement · Le devis artisan n'a qu'un bloc de main-d'œuvre

**Constat.** `quote.entity.ts:75-102` : un `labor_type` (horaire ou forfait), un taux, un volume d'heures, ou un montant. **[O]**

**Conséquence.** Pour un peintre, la main-d'œuvre représente l'essentiel du prix. Un devis à 54 lignes de matériaux et une ligne « main-d'œuvre : 1 200 € » n'est pas un devis qu'on envoie. Sans ligne de MO par ouvrage, le parcours s'arrête à l'avant-dernier écran, quelles que soient les quantités.

**Écarté du périmètre V1, explicitement** : avoir, acompte, autoliquidation BTP, multi-taux de TVA, e-invoicing. La cible TPE relève de septembre 2027 et le modèle est déjà aligné EN 16931 (`docs/CONFORMITE_FACTURATION.md`) — c'est une bonne décision déjà prise, ne pas y revenir.

### 3.3 — À sortir du périmètre · La vision par ordinateur

**Constat mesuré.** L'audit du service a instrumenté le pipeline sur ses propres scénarios de test : avec une porte apparaissant 20 à 30 % plus petite que le plan de calibration — c'est-à-dire une porte au fond d'une pièce, le cas nominal —, **l'erreur sur chaque dimension atteint +24 à +42 %**, soit +55 à +95 % sur les surfaces murales facturées. Une armoire sans porte dans la scène est acceptée comme porte de référence. Le score de confiance ne bouge quasiment pas entre 0,4 % et 24 % d'erreur : il ne mesure que la cohérence interne, jamais la justesse (`dimension_calculator.py:417-497`). Sur des scénarios parfaits à 1,4 % d'erreur, il affiche « Basse » ; avec une seule photo, « Haute » est mathématiquement inatteignable. Le calcul de longueur (`dimension_calculator.py:337-343`) multiplie un rapport sans dimension par une hauteur en pixels : il n'est pas homogène physiquement. **[O]**

**Trois faits opérationnels s'ajoutent.**
- Les poids YOLO n'ont **jamais été produits** (`tasks/todo.md:4463`, `BACKLOG.md:54`). Or `deploy.yml:87-94` vérifie leur présence de façon bloquante : **le CD ne peut aujourd'hui déployer aucun tag**. **[O]**
- Le service réserve 4 Go de RAM (`docker-compose.prod.yml:149-153`) — c'est le poste dominant du VPS recommandé à 8 Go. Une analyse simultanée maximum ; **deux utilisateurs Pro en même temps = un échec garanti**, avec un `429` que le client n'interprète pas et qui remonte en anglais à l'écran (`cv-client.service.ts:118-126`).
- `ultralytics` est une dépendance runtime **AGPL-3.0**, signalée « à soumettre en revue juridique » dans le dépôt et jamais arbitrée.

**Décision : sortir la CV du périmètre V1.** Pas la supprimer — la débrancher : `CV_ENABLED=false`, retirer le service de `docker-compose.prod.yml`, lever la vérification bloquante du CD, retirer l'entrée « analyse photo » des surfaces vendues. Le code reste dans git.

**Ce que cela achète** : la moitié du VPS, un CD débloqué, un risque juridique suspendu, et surtout la fin de la principale source d'erreur de dimensions. **Ce que cela coûte** : le différenciateur affiché — mais sa valeur mesurée à ce jour est nulle, il n'existe aucun chiffre de précision sur une seule photo réelle. **[O]**

**Condition de retour, écrite avant de collecter** : 50 à 100 photos réelles avec dimensions relevées au télémètre, erreur médiane **sous 5 %**. En dessous, le composant ne revient pas. Et il faudra alors le comparer honnêtement à ARKit/ARCore, qui donnent ±1-2 % pour un coût serveur nul.

### 3.4 — À toléré temporairement, puis à supprimer · La plateforme construite pour personne

**Constat.** Sont livrés, testés, migrés, et **jamais atteignables depuis aucune interface** : le widget marque blanche facturé 49 €/mois (aucun écran pour créer une clé `wgt_`), le multi-utilisateurs facturé 49 €/mois (aucun écran d'invitation), l'API publique à clés, l'offre Enterprise avec SSO SAML/OIDC. **[O]**

Deux mécaniques de données sont par ailleurs des coquilles **de fait** :
- Les **facteurs de perte appris** sont statistiquement bien construits (médiane robuste, MAD, crédibilité de Bühlmann, bornage) mais exigent ≥ 8 chantiers clôturés **et** ≥ 3 organisations distinctes **par cellule** matériau × pose × niveau, soit plus de 900 cellules. Rien ne sortira avant plusieurs centaines de chantiers réels.
- Le **benchmark de coûts** rejette tout chantier où un `material_id` apparaît sous deux `work_type_code` (`cost-benchmark.service.ts:371`). Or peinture murale et peinture plafond partagent les 54 mêmes matériaux : **tout projet mêlant les deux est exclu**, et un ouvrage n'est retenu que si ses ~54 matériaux portent tous un prix déclaré. Inatteignable. **[O]**

**Conséquence.** Ce n'est pas seulement du code inutile : le SSO est appliqué **dans `FirebaseAuthGuard`**, sur le chemin critique de toutes les requêtes authentifiées (`firebase-auth.guard.ts:51-57`). Chaque fonctionnalité fantôme ajoute une surface d'attaque, un coût de migration et une chance de casser ce qui marche.

**Décision.** Geler immédiatement (aucune évolution, aucune mention commerciale) ; **supprimer** widget, API publique, SSO/Enterprise après la V1 si aucun prospect ne les a demandés. Git les garde. Les **organisations** restent : le modèle est déjà backfillé 1:1 et porte `organization_id` sur toutes les entités métier — le retirer coûterait plus cher que le conserver. Le benchmark et l'apprentissage restent en base, désactivés, sans coût.

### 3.5 — À corriger avant toute mise en vente · Quatre points d'exploitation

Ils ne déterminent pas la valeur, mais ils empêchent une exploitation sérieuse. Aucun n'est lourd.

| Point | Constat | Conséquence |
|---|---|---|
| **Droit à l'effacement incomplet** | La suppression de compte efface les lignes ; les **fichiers photos** ne sont supprimés que par `deletePhoto` (`photos.service.ts:170`), la suppression de projet est logique (`projects.service.ts:712`), aucun cron de purge n'existe. **[O]** | Des photos d'intérieurs survivent indéfiniment dans le volume `uploads` et dans les sauvegardes. Exposition RGPD directe. |
| **Déploiement non réversible** | `docker compose up -d` sans `--wait`, aucun smoke test, et le rollback documenté ne rejoue que les images — **aucune reprise de migration**. **[O]** | Revenir en arrière fait tourner l'ancien code contre le nouveau schéma. Le rollback documenté est activement dangereux. |
| **`.env.example` piégeux** | Livre `DB_PASSWORD=chiffreo_dev` et `CORS_ORIGIN=http://localhost:3000` **non vides** ; la validation ne teste que le vide. `DEPLOY.md §1` dit `cp .env.example .env`. **[O]** | Un opérateur qui suit la doc démarre en production avec le mot de passe Postgres public du dépôt. |
| **`POST /auth/merge-guest`** | Accepte un `anonymous_firebase_uid` fourni par le client sans vérifier que l'appelant le contrôle (`auth.service.ts:190-215`). **[O]** | Absorption des projets d'un tiers **et suppression de son compte**. Correctif trivial. |

**Ce qui est solide et mérite d'être dit** : l'isolation multi-tenant est rigoureuse (portée résolue exclusivement côté serveur, 46 filtres `organizationId`, aucun endpoint métier non filtré trouvé) ; l'idempotence des webhooks Stripe est réelle et testée contre un vrai Postgres ; les sauvegardes chiffrées avec script de restauration existent ; le service worker PWA est écrit à la main et partitionne son cache par identité Firebase. La discipline d'ingénierie périphérique est nettement au-dessus de la moyenne. **Son problème n'est pas la qualité : c'est l'objet auquel elle s'est appliquée.**

Deux réserves à joindre : **zéro test d'isolation inter-organisation** — la propriété qui porte tout le produit repose sur 46 filtres écrits à la main et sur rien d'autre ; et le `past_due` Stripe compte comme actif (`subscriptions.service.ts:557`), soit plusieurs semaines de service gratuit après impayé.

---

## 4. La version cible

### V1 — « Le chiffrage juste des ouvrages de finition »

**Pour** un artisan peintre, carreleur, plaquiste ou solier, seul ou à deux, en France.
**Qui** doit chiffrer un chantier de finition chez son client et repartir avec un devis envoyé.
**La V1 est** un outil de chiffrage mobile qui transforme des dimensions relevées en quantités justes, puis en devis conforme.
**À la différence de** Tolteck ou Obat, elle **calcule** les quantités au lieu de les faire saisir.
**Elle ne couvre pas** les corps d'état hors finition — et le dit sur chaque surface.

**Le parcours complet, six écrans, tous existants :**
saisie des dimensions → ouvrage, niveau, pose → **liste d'achat de 3 à 6 lignes** → prix → **devis avec main-d'œuvre par ouvrage** → envoi PDF.

**Cœur du produit** — ce qui doit être irréprochable : la géométrie des surfaces nettes ; la liaison ouvrage → matériaux ; les rendements et facteurs de perte ; le choix du conditionnement ; le PDF de devis conforme.

**Reporté après la V1** (existe, gelé) : suivi de chantier, relances de devis, facturation, carnet du logement, e-mails de cycle de vie, éco-matériaux, communauté, parrainage, benchmark, apprentissage des pertes, liens d'affiliation.

**Sorti du périmètre** : la vision par ordinateur (§3.3) — débranchée, condition de retour écrite.

**À supprimer** après la V1 si personne ne les demande : widget marque blanche, API publique à clés, SSO/Enterprise (§3.4).

**Le particulier** garde exactement deux choses, parce qu'elles sont déjà construites et coûtent trois lignes à réparer : les calculateurs publics indexables, et le mode invité — **jusqu'à la liste d'achat incluse**, ce qui n'est pas le cas aujourd'hui. Aucun autre investissement DIY. Pas de monétisation DIY en V1.

**Tarif V1** — ~~un seul palier artisan à 19 €/mois, plus un gratuit limité~~ → **révisé** ([ADR 0002 D4](adr/0002-modele-economique-facturation-distribution.md)) : **le chiffrage est gratuit et sans limite de chantiers ; la conformité — devis PDF conforme, fichier clients, historique de prix, facturation — est vendue 279 € par an, en annuel uniquement, avec 30 jours satisfait ou remboursé.** Les trois paliers Contractor différenciés attendront d'avoir des clients à différencier — aujourd'hui deux des trois vendent des fonctionnalités sans interface.

**La V1 est atteinte quand**, sur un environnement de production, un artisan qui n'a pas écrit le code mesure une pièce, obtient une liste qu'il juge achetable telle quelle, produit un devis, l'envoie, et revient de lui-même chiffrer un second chantier.

---

## 5. Architecture pour cette version

**Rien à réécrire.** L'architecture existante est correcte pour la V1 : monorepo pnpm, NestJS modulaire + TypeORM avec migrations, Next.js App Router, PostgreSQL, feature gates en base fail-closed. Le seul choix véritablement disproportionné est le microservice CV, et il sort du périmètre.

| Composant | Décision | Raison |
|---|---|---|
| `apps/api` — estimations, shopping-lists, materials, projects | **Conserver et corriger** | C'est le produit. Les défauts sont des bugs, pas de l'architecture. |
| `room-geometry.ts`, agrégation multi-pièces | **Conserver tel quel** | La meilleure brique du dépôt. Union exacte de rectangles, formes en L/T/U, `ceil(Σ) ≤ Σceil` prouvé et testé. |
| Catalogue matériaux + facteurs de perte | **Conserver, réviser les données** | Fait pour le périmètre V1 (E1-7) : rendements servis sourcés dans `docs/SOURCES_CATALOGUE.md`, appellation « DTU » retirée. Le hors-périmètre reste non sourcé. |
| Devis / factures / profil d'entreprise | **Conserver, étendre** | Ajouter la MO par ouvrage (§3.2). Le reste est conforme. |
| Organisations | **Conserver, geler l'UI** | Déjà backfillé 1:1 sur toutes les entités ; le retirer coûte plus que le garder. |
| Feature gates | **Conserver** | Exactement la bonne mécanique pour geler sans supprimer. |
| Firebase Auth + mode invité | **Conserver, réparer** | Le mode invité est un actif ; il est aujourd'hui inachevé (§1). |
| `apps/cv-service` + module `analysis` | **Débrancher** | §3.3. Le code reste dans git. |
| `apps/widget`, `api-keys`, `enterprise`/SSO | **Geler, puis supprimer** | §3.4. Le SSO est sur le chemin critique de l'auth. |
| `waste-learning`, `cost-benchmark` | **Geler en base** | Inatteignables avant des centaines de chantiers ; le benchmark est de plus cassé. |
| Stockage photos local, jobs en mémoire, rate-limit en mémoire | **Conserver** | Corrects à une instance. Ne rien introduire (ni S3, ni Redis, ni file) avant que le volume l'impose. |

**Aucune technologie nouvelle n'est recommandée.** Le dépôt n'a pas de problème d'outillage.

---

## 6. Trajectoire

Ordonnée par dépendances réelles. Chaque étape a un critère de fin vérifiable — pas une case cochée.

### Étape 0 — Décider (avant toute ligne de code) · ½ journée

Trois décisions bloquent tout le reste et n'appartiennent qu'à vous : (a) l'artisan de finition est-il la cible de la V1 ? (b) la CV sort-elle du périmètre ? (c) le widget / l'API publique / le SSO sont-ils supprimés ? Tant qu'elles ne sont pas prises, chaque arbitrage suivant est réversible et donc jamais fait.

### Étape 1 — Rendre la liste d'achat juste · 3 à 5 jours · **C'est la seule étape non négociable**

- **Résultat attendu** : une peinture murale sur 33 m² produit 3 à 6 lignes achetables ; un carrelage sol produit du carrelage, de la colle et du joint dans des quantités qu'un carreleur reconnaît.
- **Zones** : `apps/api/src/estimations/{estimations.service.ts, estimation-engine.ts}`, `apps/api/src/shopping-lists/shopping-lists.service.ts`, migrations `…003` (liaison ouvrage → matériaux) et `…006` (flag `applies_coats`).
- **Risques** : la curation des données est plus longue que le code — prévoir de faire relire les listes par un artisan avant de coder la suite ; le test `estimation-engine.spec.ts:294-302` verrouille le mauvais conditionnement et doit être **réécrit**, pas contourné.
- **Vérification** : un test qui exécute le moteur **sur le catalogue réellement seedé** (pas un mock) et assère, pour chacun des 7 ouvrages, un nombre de lignes borné, aucun accessoire multiplié par les couches, et un conditionnement plausible. Ce test n'existe pas aujourd'hui et c'est pour cela que ces défauts ont survécu.

### Étape 2 — Fermer le parcours de bout en bout · 2 à 3 jours

- **Résultat** : (a) l'invité voit son estimation et sa liste ; (b) la conversion invité → compte ne perd plus la sélection d'ouvrages ; (c) le devis porte une ligne de main-d'œuvre par ouvrage.
- **Zones** : `apps/web/src/app/(app)/projects/[id]/{estimate,shopping-list}/page.tsx` (le `if (!appUser)`), `contexts/AuthContext.tsx:210-256` et le type `LocalProjectDraft` (les `work_items` ne sont pas migrés), `apps/api/src/quotes/` + migration.
- **Risques** : autoriser l'invité jusqu'à la liste ouvre un endpoint d'estimation persistée à un compte anonyme — vérifier les quotas ; la MO par ouvrage touche le PDF et la numérotation, tous deux conformes aujourd'hui : ne pas les casser.
- **Vérification** : un test de bout en bout, dans un navigateur, qui part de la page d'accueil sans compte et arrive à la liste d'achat. **Aucun test navigateur n'existe dans le dépôt** (39 pages, 0 couverte) — celui-ci est le premier à écrire, et il n'en faut qu'un.

### Étape 3 — Réduire le produit à la V1 · 2 jours

- **Résultat** : la CV est débranchée, le CD n'est plus bloqué par des poids inexistants, les surfaces commerciales ne vendent que ce qui est atteignable, un seul palier payant — la **conformité à 279 €/an** ([ADR 0002 D4](adr/0002-modele-economique-facturation-distribution.md)), le chiffrage étant gratuit.
- **Zones** : `docker-compose.prod.yml` (retirer le service, libérer 4 Go), `.github/workflows/deploy.yml:87-94` (retirer la vérification bloquante), `apps/web/src/lib/{pricing.ts,calculators.ts}`, migrations de gates.
- **Risque** : le test `offer-catalogue.spec.ts` interdit structurellement de vendre une ligne sans gate réelle — c'est le meilleur garde-fou du dépôt, **le mettre à jour, jamais le désactiver**.
- **Vérification** : chaque ligne vendue sur `/`, `/artisans` et `/pricing` est atteignable depuis la navigation par un compte du palier concerné. Aujourd'hui, deux ne le sont pas.

### Étape 4 — Rendre la mise en production sérieuse · 3 à 4 jours

- **Résultat** : purge effective des photos à la suppression de compte et de projet ; `merge-guest` corrigé ; `.env.example` vidé de ses valeurs par défaut et validation renforcée ; `up -d --wait` + smoke test post-déploiement ; procédure de retour arrière incluant les migrations ; une restauration de sauvegarde **réellement exécutée**.
- **Zones** : `photos.service.ts`, `projects.service.ts:712`, `auth.service.ts:190-215`, `.env.example` + `env.validation.ts`, `.github/workflows/deploy.yml`, `docs/deploy/`.
- **Risque** : la purge des photos est destructive — l'écrire avec une rétention explicite (par ex. 30 jours après suppression logique), pas un `rm` immédiat.
- **Vérification** : une base restaurée depuis une sauvegarde chiffrée démarre l'application ; un compte supprimé ne laisse **aucun fichier** dans le volume `uploads`.

### Étape 5 — Mettre en ligne et confronter · 1 à 2 jours de travail, puis attendre

- **Résultat** : VPS provisionné, DNS, Caddy, produits Stripe en mode live, monitoring d'uptime, alerte sur webhook Stripe en échec. Et **cinq artisans de finition qui utilisent l'outil sur un vrai chantier**.
- **Risque** : le vrai risque n'est pas technique. C'est de repartir en développement plutôt que d'aller chercher les cinq artisans.
- **Vérification** : cinq listes d'achat produites par des personnes extérieures au projet, et pour chacune, la réponse à une seule question — « auriez-vous acheté cette liste telle quelle ? ». Une réponse négative sur cinq relance l'étape 1. Trois positives ouvrent l'étape 6.

### Étape 6 — Seulement ensuite : rouvrir le backlog

Les cinq premières étapes représentent **12 à 16 jours**. Tout ce qui a été gelé (§4) revient dans le périmètre par les données, jamais par l'inventaire. Le premier candidat sera probablement l'élargissement du périmètre chiffrable (corps d'état supplémentaires) — c'est le seul chemin qui rouvre un tarif au-dessus de 29 € et le segment généraliste, et le dépôt le sait déjà (`PRODUCT_STRATEGY.md §4.5`).

---

## 7. Risques

| Risque | Gravité | Signal d'alerte | Réponse |
|---|---|---|---|
| **Les quantités restent contestées après correction** — les rendements servis sont désormais sourcés (E1-7, `docs/SOURCES_CATALOGUE.md`), mais les facteurs de perte restent des valeurs d'usage non normatives, et les hypothèses (formats par défaut, cloison 72/48 deux faces) peuvent ne pas coller au chantier | **Moyenne** — la promesse est désormais adossée à des fiches, pas encore au terrain | Un artisan sur cinq conteste une quantité à l'étape 5 | Confronter les 7 listes sourcées aux artisans ; les écarts constatés nourrissent DATA-3 (facteurs appris) ou corrigent le registre, pièce par pièce |
| **Reprise du développement au lieu de la confrontation** | **Élevée** — c'est le mode de défaillance déjà observé : 20 épics en 48 h pour zéro utilisateur | Un commit `feat(...)` avant les cinq artisans | Règle explicite : aucune nouvelle fonctionnalité tant que l'étape 5 n'a pas rendu son verdict |
| **Le segment artisan ne paie pas la conformité à 279 €/an** — face à Tolteck en annuel (228 € HT/an, 148,20 € pour une entreprise de moins de cinq ans) et ArtisanSmart (348 € HT/an), qui couvrent *tous* ou *quinze* corps d'état | Élevée | Moins de 4 souscriptions sur les 40 premiers artisans ayant produit trois listes d'achat ([ADR 0002 §5.1](adr/0002-modele-economique-facturation-distribution.md)) | Le chiffrage gratuit est le protocole de démonstration ; s'il ne convertit pas, c'est le prix ou l'emballage de la conformité qui est faux, pas le segment |
| **Régression d'isolation multi-tenant** — zéro test inter-organisation, 46 filtres manuels | Moyenne, conséquence sévère | — | Trois tests d'isolation (projets, devis, listes) à écrire pendant l'étape 4 |
| **Dépendance AGPL `ultralytics`** | Suspendue par §3.3 | Retour de la CV au périmètre | Arbitrage juridique **avant** tout retour, pas après |
| **Instance unique implicite** — rate-limit et cache de gates en mémoire, VPS unique | Faible à ce stade | Un second nœud envisagé | Ne rien faire aujourd'hui ; l'écrire dans le README pour que personne ne scale horizontalement par erreur |

---

## 8. Décisions structurantes encore ouvertes

1. **L'artisan de finition ou le particulier ?** Ma recommandation est l'artisan (§2.2) : il revient, il paie, et son besoin ne dépend pas de la CV. Mais c'est un arbitrage de conviction, pas de code — et il conditionne tout le §6.
2. **Que faire de `docs/` ?** `PRODUCT_STRATEGY.md`, `BACKLOG.md` et `tasks/todo.md` (5 012 lignes) décrivent un produit lancé et mature qui n'existe pas. Ils sont lus par tout nouvel arrivant — et par les agents qui travaillent sur ce dépôt. Ils doivent être réduits à l'état réel ou archivés. Le laisser en l'état, c'est garantir que la prochaine session reconstruise des épics au lieu de réparer le moteur.
3. **Widget, API publique, SSO : supprimer ou garder ?** Ma recommandation est de supprimer après la V1 (§3.4). L'argument contraire — « c'est déjà écrit et testé » — est le raisonnement qui a produit la situation actuelle. Git garde tout.
4. **Le catalogue à 208 matériaux est-il un actif ou une charge ?** Si les rendements ne peuvent pas être sourcés, un catalogue de 40 matériaux vérifiés vaut mieux qu'un catalogue de 208 dont on ne peut rien affirmer. À trancher pendant l'étape 1.

---

## 9. La première action, concrètement

**Aujourd'hui, dans le dépôt, écrire un test qui échoue.**

Dans `apps/api/src/estimations/`, un test qui construit les matériaux **depuis le seed réel** (`1711468800006-SeedMaterialsCatalog.ts`), exécute `computeEstimation` pour l'ouvrage `wall_painting` sur une pièce de 400 × 300 × 250 cm avec une porte de 83 × 204, et assère :

```
lignes générées                        ≤ 6      (aujourd'hui : 54)
unités totales                         ≤ 15     (aujourd'hui : 1 486)
aucune ligne "Pinceau" / "Rouleau"
        avec units_needed > 5                   (aujourd'hui : 70)
"Peinture acrylique mate" (6,66 L)     → 1 × Pot 5 L + 1 × Pot 2.5 L
                                                (aujourd'hui : 14 × Pot 0.5 L)
```

Ce test échoue sur les quatre assertions. Il définit l'étape 1 mieux que n'importe quelle spécification, et il rend impossible de déclarer le moteur réparé sans qu'il le soit. C'est aussi le seul artefact de ce document qui, une fois écrit, survit à ce document.

---

### En un paragraphe

Chiffréo n'est pas un projet en difficulté technique : c'est un projet qui a construit avec beaucoup de rigueur tout ce qui entoure sa valeur, et jamais vérifié la valeur elle-même. La géométrie est excellente, l'isolation multi-tenant est propre, les webhooks sont idempotents, le service worker est écrit à la main — et une peinture murale sort 70 pinceaux. Il n'y a rien à réécrire. Il y a un calcul à réparer, un parcours à fermer, une moitié de produit à débrancher, et cinq artisans à trouver. Douze à seize jours séparent ce dépôt d'une V1 utile ; la seule chose qui puisse les faire durer six mois, c'est de continuer à livrer des épics.
