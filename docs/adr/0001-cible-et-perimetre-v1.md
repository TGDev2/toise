# ADR 0001 — Cible et périmètre de la V1

| | |
|---|---|
| **Statut** | Accepté |
| **Date** | 3 août 2026 |
| **Portée** | Produit et périmètre. Cet ADR est opposable : toute tâche du dépôt qui le contredit est hors périmètre. |
| **Sources** | [`docs/REPRISE_PROJET.md`](../REPRISE_PROJET.md) (état des lieux), [`docs/BACKLOG_V1.md`](../BACKLOG_V1.md) (exécution) |
| **Remplace** | Les orientations produit de `docs/archive/PRODUCT_STRATEGY.md` et `docs/archive/BACKLOG.md`, archivés |

---

## 1. Contexte

Le dépôt est à l'état `main` : 99 commits, 802 fichiers, ~100 000 lignes, 1 619 cas de test. L'audit consigné dans `REPRISE_PROJET.md` établit quatre faits qui rendent une décision de périmètre nécessaire **avant toute ligne de code**.

**Le calcul central est faux.** Pour le cas le plus banal du produit — repeindre les murs d'une pièce de 4 × 3 m sous 2,50 m, une porte, niveau intermédiaire, soit 33,31 m² nets — le moteur exécuté sur le catalogue réellement seedé produit **54 lignes et 1 486 unités à acheter**, dont 70 pinceaux et 14 pots de 0,5 L là où 1 pot de 5 L + 1 pot de 2,5 L suffisent. Quatre défauts indépendants et vérifiés se composent : `loadMaterialInputs` charge toute la catégorie au lieu des matériaux de l'ouvrage, les couches sont appliquées aux accessoires, `selectBestPackaging` minimise le surplus volumique au lieu du nombre d'unités, et `buildTilingContext` somme 48 fois la même surface. Aucun test ne les voit, parce qu'aucun test n'exécute le moteur sur le catalogue réel.

**Le produit n'a aucun utilisateur.** Entre le 1er et le 2 août 2026, 39 commits en 48 heures ont livré vingt épics — suivi de chantier, facturation conforme, galerie publique, parrainage, organisations multi-utilisateurs, API publique à clés, SSO SAML/OIDC, widget marque blanche, benchmark de coûts anonymisé — pour zéro utilisateur, sur un produit non déployé, dont le calcul central est faux. Le mode défaillance du projet est identifié : **construire autour de la valeur au lieu de vérifier la valeur.**

**Plusieurs surfaces vendues ne sont atteignables depuis aucune interface** : le widget à 49 €/mois (aucun écran pour créer une clé `wgt_`), le multi-utilisateurs à 49 €/mois (aucun écran d'invitation), l'API publique, l'offre Enterprise. Le SSO est par ailleurs appliqué dans `FirebaseAuthGuard`, donc sur le chemin critique de toutes les requêtes authentifiées.

**Le composant le plus coûteux n'a jamais été mesuré sur une photo réelle.** Le service de vision par ordinateur affiche, sur ses propres scénarios de test instrumentés, +24 à +42 % d'erreur par dimension dès que la porte de référence apparaît 20 à 30 % plus petite que le plan de calibration — c'est-à-dire dans le cas nominal. Il consomme 4 Go des 8 Go du VPS recommandé, dépend d'`ultralytics` en AGPL-3.0 jamais arbitrée juridiquement, et ses poids YOLO n'ayant jamais été produits alors que `deploy.yml:87-94` les vérifie de façon bloquante, **aucun tag ne peut être déployé aujourd'hui**.

Le §8 de `REPRISE_PROJET.md` laisse trois décisions ouvertes — la cible, la vision par ordinateur, le sort des surfaces fantômes — et le §6 les place en étape 0 : « tant qu'elles ne sont pas prises, chaque arbitrage suivant est réversible et donc jamais fait ». Cet ADR les tranche, et y ajoute la décision tarifaire qui en découle mécaniquement.

---

## 2. Décision

### D1 — La cible de la V1 est l'artisan des métiers de finition. Le particulier reste une surface d'acquisition non monétisée.

La V1 s'adresse à un **artisan peintre, carreleur, plaquiste ou solier, seul ou à deux, en France**, qui doit chiffrer un chantier de finition chez son client et repartir avec un devis envoyé.

La promesse est bornée à une phrase : *« Chez le client, en dix minutes : je mesure, je choisis l'ouvrage, j'obtiens la quantité exacte à acheter et un devis conforme que j'envoie avant de repartir. »*

Le particulier conserve **exactement deux surfaces**, parce qu'elles existent déjà et coûtent trois lignes à réparer : les calculateurs publics indexables, et le mode invité **jusqu'à la liste d'achat incluse**. Aucune monétisation, aucun tarif, aucun paywall et aucun investissement produit DIY en V1.

Quatre raisons, dans l'ordre :

1. **Il revient.** La question « quelle raison de revenir » a une réponse évidente pour lui — plusieurs devis par semaine — et aucune pour un particulier qui rénove tous les deux à cinq ans.
2. **Chez lui, une quantité fausse coûte de l'argent réel** — donc une quantité juste vaut de l'argent réel. La valeur est mesurable en euros, pas en confort.
3. **Son parcours est déjà le plus complet du dépôt** : dimensions → ouvrage → estimation → liste → devis PDF conforme → facture numérotée sans trou.
4. **Il n'a pas besoin de la vision par ordinateur** : il a un télémètre laser dans la poche. C'est ce qui rend D2 possible.

### D2 — Le service de vision par ordinateur sort du périmètre V1. Il est débranché, pas supprimé.

`CV_ENABLED=false`, retrait du service de `docker-compose.prod.yml`, levée de la vérification bloquante des poids YOLO dans le CD, retrait de l'entrée « analyse photo » de toutes les surfaces vendues. **Le code reste dans git**, `apps/cv-service` n'est pas supprimé.

La condition de retour est chiffrée et **écrite avant la collecte**, pour qu'on ne puisse pas sélectionner les photos a posteriori : **50 à 100 photos réelles, dimensions relevées au télémètre laser, erreur médiane sous 5 %** sur les dimensions calculées. En dessous, le composant ne revient pas.

### D3 — Widget marque blanche, API publique à clés et SSO/Enterprise sont gelés immédiatement, puis supprimés après la V1 s'ils ne sont pas demandés.

**Gel immédiat** : gates désactivées en base par migration réversible, miroir front mis à jour, aucune ligne d'offre adossée à ces gates, aucune mention commerciale, aucune évolution — seuls les correctifs de sécurité restent admissibles tant que le code est présent.

**Suppression** au verdict de l'étape 5 (mise en ligne + cinq artisans) si aucun prospect ne les a demandés. Git garde tout.

Ne sont pas concernés, et restent :
- **Les organisations** : le modèle est déjà backfillé 1:1 et porte `organization_id` sur toutes les entités métier ; le retrait coûterait plus cher que la conservation. UI gelée, modèle conservé.
- **`waste-learning` et `cost-benchmark`** : gelés en base, sans coût, inatteignables avant plusieurs centaines de chantiers réels — et le benchmark est de plus structurellement cassé (il exclut tout projet mêlant peinture murale et peinture plafond).

### D4 — Un seul palier payant à 19 €/mois en V1, plus un gratuit limité.

`OFFER_PLANS` se réduit à **Free** et **Artisan 19 €/mois**. Les trois paliers Contractor différenciés (19/29/49) fusionnent en un seul, le palier `enterprise` disparaît des surfaces. Un seul produit Stripe en mode live.

Les paliers différenciés attendront d'avoir des clients à différencier : aujourd'hui deux des trois vendent des fonctionnalités sans interface.

---

## 3. Conséquences

### 3.1 Conséquences de D1 (cible artisan)

**Sur le périmètre, concrètement :**

- **La couverture chiffrable est gelée aux 7 ouvrages de finition existants** (peinture murale, peinture plafond, carrelage sol, carrelage mural, parquet/stratifié, cloison sèche, revêtement mural). Ni plomberie, ni électricité, ni isolation, ni maçonnerie, ni menuiserie en V1 — et chaque surface publique doit le dire (`COVERED_TRADES` / `TRADES_NOT_COVERED` sont un actif, à conserver intacts).
- **La main-d'œuvre par ouvrage devient obligatoire**, alors qu'elle serait facultative pour un particulier. Le devis ne porte aujourd'hui qu'un bloc unique (`quote.entity.ts:75-102`) ; pour un peintre, dont la MO fait l'essentiel du prix, ce devis n'est pas envoyable. Sans elle, le parcours s'arrête à l'avant-dernier écran quelles que soient les quantités.
- **Le mode invité doit être réparé jusqu'à la liste d'achat incluse.** Il est aujourd'hui rompu une étape avant l'estimation (`estimate/page.tsx:57-59` ne teste que `!appUser` là où `work-selection` accepte l'invité) : toute la stratégie d'acquisition meurt sans message. Le PDF et le partage restent derrière la création de compte — c'est le moment de conversion.
- **Sont gelés comme non prioritaires** : carnet du logement, e-mails de cycle de vie DIY, communauté, parrainage, galerie publique, éco-matériaux. Le carnet du logement avait été construit (PLAT-1) comme antidote au churn du particulier : un antidote livré avant que la maladie ait un seul porteur.
- **Un arbitrage devient mécanique** : toute demande d'évolution se tranche par « est-ce que ça sert un artisan sur chantier ? ». Une réponse négative sort du périmètre sans autre discussion.
- **Le critère d'atteinte de la V1 est un critère utilisateur, pas un critère de code** : cinq artisans de finition extérieurs au projet produisent chacun une liste d'achat sur un vrai chantier, et répondent à une seule question — « auriez-vous acheté cette liste telle quelle ? ». Trois réponses positives ouvrent la suite ; une négative relance le moteur.

**Ce que cela coûte** : l'abandon assumé, pour douze à seize jours, de tout investissement sur le segment le plus large et le moins cher à acquérir.

**Ce qui la ferait réviser** : voir §5.1.

### 3.2 Conséquences de D2 (CV hors périmètre)

**Sur le périmètre, concrètement :**

- **La saisie manuelle des dimensions devient le seul chemin d'entrée.** L'étape photo disparaît du parcours, ainsi que le panneau de résultat et l'écran de conseils de prise de vue. En contrepartie, la qualité de la saisie (formes en L/T/U, ouvertures, exclusions) devient critique — c'est heureusement la meilleure brique du dépôt.
- **L'architecture de production passe de quatre services à trois.** 4 Go de RAM libérés, soit la moitié du VPS recommandé : la limite « une analyse simultanée maximum, deux utilisateurs Pro en même temps = échec garanti » disparaît avec le service.
- **Le déploiement continu est débloqué.** L'étape bloquante de vérification des poids YOLO disparaît de `deploy.yml` ; un tag redevient déployable, ce qu'il n'est pas aujourd'hui.
- **Le risque juridique AGPL-3.0 d'`ultralytics` est suspendu, pas résolu.** La dépendance n'a plus d'effet runtime en production. L'arbitrage reste dû, mais il devient une condition d'entrée au retour du composant plutôt qu'une urgence.
- **Le différenciateur affiché disparaît des surfaces commerciales** (`/`, `/artisans`, `/pricing`, `/calculateurs`), du README, de `docs/ARCHITECTURE.md` et de `docs/DEPLOY.md`. Sa valeur mesurée à ce jour étant nulle — il n'existe aucun chiffre de précision sur une seule photo réelle — ce retrait ne retire aucune valeur démontrée.
- **La principale source d'erreur de dimensions est éliminée.** Un produit dont l'unique promesse est la justesse des quantités ne peut pas s'alimenter d'une mesure à +24/+42 % d'erreur, avec un score de confiance qui ne mesure que la cohérence interne et jamais la justesse.

**Ce que cela coûte** : le seul argument marketing spectaculaire du produit, et le travail déjà investi dans `apps/cv-service`. Le code étant conservé, ce coût est récupérable.

**Ce qui la ferait réviser** : voir §5.2.

### 3.3 Conséquences de D3 (gel puis suppression)

**Sur le périmètre, concrètement :**

- **Les gates `public_api`, `enterprise_sso`, `multi_user`, `cv_analysis`, `cost_benchmark`, `eco_materials`, `site_tracking` et `quote_reminders` passent à `is_enabled=false`** par migration réversible, avec le miroir `feature-gates-catalogue.ts` mis à jour dans le même lot.
- **Le chemin critique de l'authentification est allégé** : le SSO est appliqué dans `FirebaseAuthGuard:51-57`, donc sur toutes les requêtes authentifiées. Chaque fonctionnalité fantôme y ajoute une surface d'attaque et une chance de casser ce qui marche.
- **Aucune surface publique ne peut plus annoncer une gate désactivée.** Le test `offer-catalogue.spec.ts` fait ce lien entre base, miroir front et pages marketing : c'est le meilleur garde-fou du dépôt, **il se met à jour, jamais il ne se désactive**. S'il rougit, c'est le catalogue d'offre qui est faux.
- **Le gel est un état, pas une étape** : aucune évolution, aucun correctif non sécuritaire, aucune migration de confort sur ces modules jusqu'à leur suppression ou leur réouverture.
- **La suppression après V1 est la position par défaut, pas une option.** L'argument « c'est déjà écrit et testé » est explicitement récusé : c'est le raisonnement qui a produit la situation actuelle.

**Ce que cela coûte** : rien de démontré. Ces fonctionnalités n'ont, à ce jour, aucun utilisateur ni aucun prospect.

**Ce qui la ferait réviser** : voir §5.3.

### 3.4 Conséquences de D4 (palier unique à 19 €)

**Sur le périmètre, concrètement :**

- **Il n'y a plus de fonctionnalité à réserver à un palier supérieur.** Toute fonctionnalité livrée en V1 est dans le palier unique — ce qui est une contrainte de conception : elle pousse à en livrer peu et bien, et interdit de justifier une nouvelle fonctionnalité par « elle différenciera le palier du dessus ».
- **Le prix aligne Chiffréo sur Tolteck (19 €), face à Obat (29 €) et EBP (29,25 €), qui couvrent *tous* les corps d'état.** Conséquence directe et inconfortable : **le calcul des quantités est le seul argument de vente**. C'est ce qui rend la réparation du moteur non négociable et prioritaire sur tout le reste — un palier unique au prix du concurrent le moins cher ne pardonne pas une liste d'achat fausse.
- **Le gratuit limité n'est pas un palier commercial mais l'entonnoir d'acquisition** : c'est lui qui porte le mode invité et les calculateurs publics de D1.
- **Un seul produit Stripe en mode live**, un seul cycle abonnement → paiement → annulation → remboursement à dérouler avant mise en vente. Le traitement de `past_due` comme abonnement actif (`subscriptions.service.ts:557`), qui offre aujourd'hui plusieurs semaines de service gratuit après impayé, doit être corrigé avant la première vente.
- **Toute ligne vendue doit être atteignable depuis la navigation par un compte du palier concerné.** Deux ne le sont pas aujourd'hui.

**Ce que cela coûte** : le revenu moyen par client maximal théorique, et la segmentation. Aucun des deux n'est mesurable sans clients.

**Ce qui la ferait réviser** : voir §5.4.

---

## 4. Alternatives écartées

### 4.1 Cibler le particulier qui rénove — l'alternative principale, écartée

C'est l'alternative sérieuse, et elle mérite d'être exposée à son meilleur avant d'être écartée.

**Ce qui plaide pour elle :**

- Le besoin est réel et le marché est un ordre de grandeur plus large que celui des artisans de finition.
- Le coût d'acquisition est faible : les calculateurs publics indexables existent déjà, le SEO sur « combien de peinture pour une pièce de X m² » est un canal éprouvé, et le mode invité supprime la friction d'inscription.
- Le produit tel qu'il existe lui convient **mieux** qu'à l'artisan : il n'a pas besoin de main-d'œuvre par ouvrage, ni de devis conforme, ni de facturation numérotée sans trou. Le parcours s'arrête à la liste d'achat — soit exactement le périmètre que la réparation du moteur rend bon.
- La vision par ordinateur, si elle fonctionnait un jour, aurait de la valeur pour lui et aucune pour l'artisan (qui a un télémètre) : le seul segment qui justifie ce composant est le particulier.
- Le dépôt a déjà construit l'antidote au churn (carnet du logement, e-mails de cycle de vie, éco-matériaux, communauté, parrainage) : la thèse a déjà été financée en temps de développement.

**Pourquoi elle est écartée :**

1. **Le besoin est épisodique.** Un chantier tous les deux à cinq ans. Un abonnement mensuel pour un besoin ponctuel est une thèse faible, et le dépôt en était déjà conscient : le carnet du logement a été proposé (`PRODUCT_STRATEGY.md §7.5`) comme antidote au churn *structurel* — on construit rarement un antidote à une maladie que l'on n'a pas.
2. **L'alternative gratuite est suffisante pour lui.** La calculette de Leroy Merlin couvre environ 80 % de ses cas, ne coûte rien et ne demande pas de compte. Chiffréo doit être *beaucoup* meilleur pour justifier un abonnement ; face à un artisan, il doit seulement faire quelque chose que Tolteck et Obat ne font pas — et il le fait.
3. **La valeur ne se convertit pas en euros pour lui.** Acheter 20 % de peinture en trop coûte 30 € à un particulier une fois tous les trois ans. Cela coûte à un artisan plusieurs centaines d'euros par an, tous chantiers confondus, plus la crédibilité devant son client quand la liste est visiblement fausse.
4. **Il n'y a pas de récurrence donc pas de signal.** Un produit sans utilisateur qui revient ne peut pas apprendre. Toutes les mécaniques de données du dépôt (facteurs de perte appris, benchmark de coûts) supposent des chantiers clôturés à répétition : elles n'ont de sens que sur le segment récurrent.
5. **Choisir le particulier obligerait à conserver la CV**, donc 4 Go de VPS, une AGPL non arbitrée, un CD bloqué, et une mesure à +24/+42 % d'erreur au cœur d'un produit dont la promesse est la justesse. La décision D2 ne serait pas possible, et le seul composant véritablement disproportionné du dépôt resterait à financer.

**Ce que la décision préserve de cette alternative** : les deux surfaces les moins chères — calculateurs publics et mode invité jusqu'à la liste. Si la thèse artisan échoue, le canal particulier n'aura pas été détruit, seulement pas investi.

**Un point d'honnêteté** : l'argument décisif contre le particulier — la récurrence — est une conviction, pas une mesure. Il n'existe à ce jour aucune donnée d'usage sur ce dépôt. C'est précisément pourquoi §5.1 écrit le signal qui la réviserait.

### 4.2 Servir les deux segments en V1

Écartée sans hésitation. C'est la position implicite actuelle, et elle a produit exactement ce que l'audit décrit : vingt épics livrés en 48 heures pour zéro utilisateur, une plateforme complète autour d'un calcul faux. Deux segments, c'est deux parcours, deux discours, deux grilles tarifaires et aucun des deux fini. La V1 doit tenir en douze à seize jours ; elle n'y tient qu'à une cible.

### 4.3 Conserver la vision par ordinateur comme différenciateur

Écartée. L'argument — « c'est ce qui nous distingue » — suppose que le composant fonctionne. Or sa précision n'a **jamais été mesurée sur une seule photo réelle**, ses poids n'existent pas, ses erreurs mesurées en scénario nominal atteignent +55 à +95 % sur les surfaces murales facturées, son score de confiance affiche « Basse » sur les cas à 1,4 % d'erreur et ne bouge quasiment pas entre 0,4 % et 24 %, et son calcul de longueur n'est pas homogène physiquement. Un différenciateur qui produit des dimensions fausses sur un produit vendu sur la justesse des quantités est un passif, pas un actif.

### 4.4 Supprimer la CV immédiatement plutôt que la débrancher

Écartée. La suppression n'apporte rien de plus que le débranchement (la RAM, le CD et le risque AGPL sont réglés par le seul débranchement), et elle détruit l'option de réouverture définie en §5.2. Git conserverait le code, mais le coût de résurrection d'un service supprimé est réel. Débrancher est strictement dominant.

### 4.5 Conserver widget / API publique / SSO parce qu'ils sont déjà écrits et testés

Écartée explicitement. C'est le raisonnement qui a produit la situation actuelle. Le coût d'une fonctionnalité n'est pas son coût d'écriture, déjà payé, mais son coût de conservation : surface d'attaque, migrations à maintenir, chemin critique d'authentification alourdi, et surfaces commerciales qui promettent ce qui n'est pas atteignable. Git garde tout ; c'est à cela qu'il sert.

### 4.6 Supprimer widget / API / SSO tout de suite

Écartée, mais de peu. Supprimer immédiatement économiserait le coût de conservation dès maintenant. Le gel est préféré parce que la suppression est une opération de refactoring non triviale — le SSO est sur le chemin critique de `FirebaseAuthGuard` — et qu'elle consommerait du temps sur la fenêtre de douze à seize jours qui doit aller au moteur. Le gel obtient l'essentiel du bénéfice (aucune promesse, aucune évolution) pour un coût nul.

### 4.7 Conserver les trois paliers Contractor (19 / 29 / 49 €)

Écartée. Deux des trois vendent des fonctionnalités sans interface : le palier à 49 € facture un widget qu'aucun écran ne permet de créer et un multi-utilisateurs qu'aucun écran ne permet d'inviter. Segmenter une base de zéro client, c'est décider à l'avance de différences qu'on n'a pas observées — et facturer des fonctionnalités inatteignables expose à un risque commercial et juridique direct.

### 4.8 Gratuité totale en V1, ou paiement à l'usage

Écartée pour la V1, conservée comme réponse d'échec. Un produit gratuit ne teste pas la volonté de payer, qui est précisément l'hypothèse à vérifier sur le segment artisan. Le paiement à l'usage (ou l'affiliation) est en revanche le modèle qui redeviendrait pertinent si la cible basculait vers le particulier — voir §5.1.

---

## 5. Critères de réouverture

Chaque décision se révise sur un signal écrit à l'avance. **Un signal absent n'est pas un signal faible** : en l'absence du critère, la décision tient.

### 5.1 Réouvrir D1 — la cible

**Réviser vers le particulier si**, à l'issue de la mise en ligne :
- **aucun essai converti sur les vingt premiers artisans** exposés à l'offre à 19 €, ou
- **une réponse négative sur cinq** à la question « auriez-vous acheté cette liste telle quelle ? » se répète après une seconde passe sur le moteur — le problème n'est alors pas le segment mais la promesse, et il faut le dire avant de changer de cible.

Dans ce cas, la thèse artisan tombe et le retour au particulier se fait **avec un modèle non-abonnement** (paiement à l'usage, affiliation), jamais avec l'abonnement mensuel écarté en §4.1.

**Réviser dans l'autre sens (monétiser le particulier) si** une demande entrante non sollicitée de particuliers prêts à payer apparaît sur les calculateurs publics — signal mesurable, pas impression.

**Ne réviser sur aucun des signaux suivants** : une intuition de marché, un article, la taille théorique du segment DIY, ou le fait que des fonctionnalités DIY soient déjà construites.

### 5.2 Réouvrir D2 — la vision par ordinateur

**Condition nécessaire, chiffrée :**
- **50 à 100 photos réelles** de pièces, prises dans les conditions d'usage (et non en scénario de test),
- **dimensions de référence relevées au télémètre laser**,
- **erreur médiane inférieure à 5 %** sur les dimensions calculées.

En dessous de ce seuil, le composant ne revient pas — quel que soit le travail investi entre-temps.

**Quatre conditions supplémentaires, toutes requises avant tout retour effectif :**
1. **Comparaison honnête à ARKit / ARCore**, qui donnent ±1-2 % pour un coût serveur nul. Si la CV serveur n'est pas meilleure, elle ne revient pas : c'est l'alternative qui gagne.
2. **Arbitrage juridique de la dépendance AGPL-3.0 `ultralytics` rendu avant le retour**, pas après.
3. **Un score de confiance qui mesure la justesse et non la cohérence interne**, et un calcul de longueur physiquement homogène. Les deux défauts sont identifiés dans `dimension_calculator.py`.
4. **Un budget mémoire compatible** avec le VPS de production et plus d'une analyse simultanée.

**Protocole** : le seuil ci-dessus est écrit avant la collecte. Le jeu de photos se constitue et se gèle *avant* de mesurer, pour interdire la sélection a posteriori.

### 5.3 Réouvrir D3 — widget, API publique, SSO/Enterprise

**Dégeler une de ces surfaces si, et seulement si :**
- **au moins deux prospects distincts, non sollicités**, demandent explicitement la fonctionnalité et sont prêts à contractualiser dessus ;
- pour le **widget** spécifiquement : un distributeur ou une enseigne apportant un volume identifiable ;
- pour le **SSO/Enterprise** : une organisation de plus de dix utilisateurs, avec un besoin d'annuaire formulé par elle.

**Ne constituent pas des critères** : « c'est déjà écrit », « ça ne coûte rien de le garder », une demande hypothétique, ou une opportunité commerciale sans engagement écrit.

**Décision de suppression** : prise au verdict de l'étape 5 (produit en ligne, cinq artisans confrontés). En l'absence des signaux ci-dessus à cette date, le code est supprimé — c'est la position par défaut, et elle ne demande pas de nouvelle décision.

**Cas particulier des organisations, de `waste-learning` et de `cost-benchmark`** : conservés en base, gelés, sans coût. Leur réouverture est conditionnée aux données, pas à une demande : plusieurs centaines de chantiers réels clôturés — et, pour le benchmark, la correction préalable du défaut qui exclut tout projet mêlant deux ouvrages partageant leurs matériaux.

### 5.4 Réouvrir D4 — le tarif

**Ajouter un palier au-dessus (au-delà de 29 €) uniquement si** le **périmètre chiffrable s'élargit** à des corps d'état hors finition. C'est le seul chemin qui justifie un prix supérieur à Obat, et c'est aussi celui qui ouvre le segment généraliste.

**Segmenter en plusieurs paliers uniquement quand** des clients payants existent **et** que leurs usages divergent de façon mesurée — pas anticipée.

**Baisser le prix ou revoir le modèle si** le signal de §5.1 se déclenche (aucune conversion sur vingt essais). Le tarif et la cible se révisent alors ensemble : ce sont deux faces de la même hypothèse.

**Ne pas réviser** parce qu'un concurrent change son prix, ni parce qu'une fonctionnalité gelée « mériterait » un palier.

---

## 6. Ce que cet ADR ne décide pas

Trois questions restent ouvertes et seront tranchées ailleurs, dans le cours de l'exécution :

- **Le sort du catalogue à 208 matériaux.** 184 rendements sur 208 ne sont sourcés nulle part et les facteurs de perte sont des nombres ronds appelés « catalogue DTU » sans qu'aucune référence DTU n'existe. Si les rendements ne peuvent pas être sourcés, un catalogue de 40 matériaux vérifiés vaut mieux qu'un catalogue de 208 dont on ne peut rien affirmer. À trancher pendant l'épic moteur, sur pièces.
- **La forme de la liaison ouvrage → matériaux** (`required_materials` en jsonb ou table `work_type_materials` porteuse d'un rôle) : décision d'architecture, prise à l'exécution.
- **Le périmètre de conformité facturation.** Avoir, acompte, autoliquidation BTP, multi-taux de TVA et e-invoicing restent hors V1 ; le modèle est déjà aligné EN 16931 et la cible TPE relève de septembre 2027. Décision antérieure, bonne, non rouverte ici.

---

## 7. Suivi

Cet ADR est appliqué par les tâches suivantes de [`docs/BACKLOG_V1.md`](../BACKLOG_V1.md) :

| Décision | Tâches d'application |
|---|---|
| **D1** — cible artisan | E1 (moteur juste) · E2-1 et E2-2 (parcours invité) · E2-3 (MO par ouvrage) |
| **D2** — CV hors périmètre | E0-3 (gate `cv_analysis`) · E3-1 (débranchement) · E3-2 (déblocage du CD) |
| **D3** — gel puis suppression | E0-3 (gates) · E3-5 (purge des mentions) |
| **D4** — palier unique 19 € | E3-4 (offre à deux paliers) |

Toute tâche du dépôt qui contredit une décision de cet ADR est hors périmètre tant que l'ADR n'est pas révisé par un ADR successeur — la révision se fait par un nouvel ADR qui remplace celui-ci, jamais par édition silencieuse.
