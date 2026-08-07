# ADR 0002 — Amendement de l'ADR 0001 : modèle économique, facturation électronique, canal de distribution

| | |
|---|---|
| **Statut** | Accepté |
| **Date** | 7 août 2026 |
| **Portée** | Produit, modèle économique et distribution. Opposable au même titre que l'ADR 0001 : toute tâche du dépôt qui le contredit est hors périmètre. |
| **Amende** | [`ADR 0001 — Cible et périmètre de la V1`](0001-cible-et-perimetre-v1.md). **D1, D2 et D3 sont confirmées** (D3 est étendue) · **D4 est révisée** · **D5 et D6 sont nouvelles**. L'ADR 0001 reste en vigueur pour tout ce que le présent ADR ne touche pas. |
| **Sources** | [`docs/VEILLE_CONCURRENTIELLE.md`](../VEILLE_CONCURRENTIELLE.md) (panel de neuf offres françaises, 6–7 août 2026) · [`docs/CONFORMITE_FACTURATION.md`](../CONFORMITE_FACTURATION.md) §1 et §8 · [`docs/PROSPECTION_B2B2C.md`](../PROSPECTION_B2B2C.md) · [`docs/ASSURANCE_ET_RISQUE.md`](../ASSURANCE_ET_RISQUE.md) |
| **Convention** | Comme dans les notes sources : **[sourcé]** = lu à la source citée · **[estimé]** = raisonnement d'analyste, hypothèses écrites · **[à vérifier]** = à contre-vérifier avant tout usage commercial. |

---

## 0. Pourquoi un ADR successeur plutôt qu'une édition de l'ADR 0001

La question était ouverte : corriger 0001 en place, ou l'amender par un texte distinct. Le choix est **l'ADR successeur**, pour trois raisons dont la première est dirimante.

1. **L'ADR 0001 l'interdit lui-même.** Sa dernière ligne (§7) dit : « la révision se fait par un nouvel ADR qui remplace celui-ci, **jamais par édition silencieuse** ». Éditer 0001 en place violerait la règle que 0001 pose, ce qui viderait de sens toute la série.
2. **Un ADR est un enregistrement daté, pas une page de documentation.** 0001 consigne ce qui a été décidé le 3 août 2026 **et sur quelles informations**. Réécrire son §1 effacerait précisément le fait le plus utile pour la suite : la décision D4 reposait sur une prémisse fausse — « personne ne sert le calcul de quantités » — et il faut pouvoir relire *comment* cette prémisse a produit un tarif. Une correction qui efface sa propre cause n'apprend rien.
3. **Le volume n'est pas celui d'un correctif.** Deux décisions nouvelles, une décision révisée à l'opposé de son sens initial, une extension du périmètre de suppression : c'est la matière d'un ADR entier, pas d'un rectificatif en marge.

**Ce que la décision de forme n'autorise pas** : laisser 0001 lisible en isolation. Un bandeau d'amendement a été posé en tête de 0001, et chaque passage périmé porte un marqueur en ligne renvoyant à la section correspondante du présent ADR. Ce sont des **renvois**, pas des réécritures : aucun mot du raisonnement d'origine n'a été modifié.

---

## 1. Correction factuelle du contexte de l'ADR 0001

### 1.1 La prémisse fausse : « le calcul de quantités n'est servi par personne »

L'ADR 0001 raisonne, sans jamais l'écrire comme une hypothèse à vérifier, sur l'idée que le calcul automatique de quantités est un espace vide. Son §4.1 le dit en clair : face à un artisan, Chiffréo « doit seulement faire quelque chose que Tolteck et Obat ne font pas — et il le fait ». Sa §3.4 en tire le tarif : le calcul étant le seul argument, un prix aligné sur le concurrent le moins cher suffit.

**C'est faux, et la veille du 6–7 août 2026 le démontre.** [sourcé — `VEILLE_CONCURRENTIELLE.md` §1.1]

**ArtisanSmart** (artisansmart.fr, RS NUMÉRIQUE, SASU, SIREN 101 678 456) vend **29 € HT/mois** — 34,80 € TTC, formule « Solo Pro », sans engagement, essai 14 jours sans CB — une fonction **« SmartChiffrage »** qui produit, sur **15 corps d'état**, des listes de matériaux **et des heures de main-d'œuvre**. Les exemples publiés par l'éditeur sont explicites : « Tuiles 12/m² (80 m²) = 960 u ; Liteau = 267 ml ; MO pose = 48 h » ; « surface développée 80 m² (murs + plafonds − ouvertures), plafond 10 L, murs 15 L, MO 24 h ». L'éditeur est par ailleurs **référencé Activateur France Num**.

Deux nuances qui ne l'annulent pas mais qui la calibrent, toutes deux vérifiées :

- « Activateur France Num » référence un **prestataire** dans un annuaire déclaratif. Ce n'est ni un label de qualité, ni une certification du logiciel. Le badge est exact au sens strict ; son usage comme réassurance produit est un raccourci. La conséquence pour nous est commerciale, pas technique : **le prospect, lui, y voit une caution publique**, et c'est à cela qu'il faut répondre.
- Le profil de l'éditeur est celui d'une SASU unipersonnelle créée le 16/02/2026, **0 salarié, 0 avis tiers**. Cela ne réduit en rien la réalité de l'offre publiée à 29 € : un prospect compare des pages de prix, pas des registres.

**Ce que la correction change** : la phrase « le calcul de quantités est un espace vide » est retirée du raisonnement. Toute affirmation commerciale de type « le seul outil qui calcule les quantités » devient un mensonge vérifiable — `VEILLE_CONCURRENTIELLE.md` §5.2 en tient la liste, elle est opposable.

### 1.2 Ce qui reste vrai, et qui est le différenciateur réel

La correction ne détruit pas la position ; elle la déplace du **fait de calculer** vers la **méthode de calcul**. Ce qui suit est vérifié sur les publications d'ArtisanSmart lui-même [sourcé — `VEILLE_CONCURRENTIELLE.md` §1.1 et §4] :

**ArtisanSmart calcule avec des constantes au m².** Les exemples publiés sont des multiplications exactes : 7,5 m³ = 50 × 0,15 (volume géométrique brut) ; 200 parpaings = 20 m² × 10/m² ; **960 tuiles = 80 × 12** — un ratio fixe de 12 tuiles/m² appliqué malgré la mention « selon la pente ». [déduit des exemples chiffrés, tous sans coefficient de perte]

**Et il ne fait, en l'état de sa documentation publique, aucun des cinq gestes suivants :**

| Geste | ArtisanSmart | Chiffréo |
|---|---|---|
| Surface **nette** calculée depuis la pièce | Non — ratios sur surfaces brutes | Oui — périmètre × hauteur − ouvertures |
| Pièce **non rectangulaire** | Non documenté | Partiel — formes rectilignes, union de rectangles |
| **Déduction des ouvertures** | Revendiquée sur la seule page peintre, jamais démontrée | Oui — ouverture par ouverture, détaillée dans le calcul |
| **Facteur de perte** par pose et par niveau | Non — aucun exemple publié n'en porte | Oui — 9 triplets pose × niveau |
| **Conditionnement commercial** | Non — sorties en unités techniques (u, ml, m³, L) | Oui — achat panaché, mutualisé entre pièces |
| **Sources techniques citées** | DTU en vitrine, **aucune source des 448 ratios** | Registre public de 35 rendements sourcés fabricant, vérifié en CI |

**La phrase défendable reste celle de `VEILLE_CONCURRENTIELLE.md` §5.1**, et elle survit intacte à la correction : *parmi les neuf offres françaises étudiées, Chiffréo est la seule dont le calcul de quantités est à la fois géométrique et traçable de bout en bout.* Ce n'est plus « le seul qui calcule ». C'est « le seul dont on peut vérifier le calcul ».

**Le point faible objectif ne bouge pas non plus** : 5 corps d'état de finition contre 15 chez ArtisanSmart et « tous corps d'état » chez Obat, Mediabat et JLogiciels. La largeur ne sera jamais l'argument.

### 1.3 Correction du prix de référence de Tolteck

L'ADR 0001 §3.4 pose « Tolteck (19 €) » comme le prix plancher du marché, et en déduit qu'un palier unique à 19 € aligne Chiffréo sur le concurrent le moins cher. **Le prix réel de Tolteck est plus bas, et sa structure est différente** [à vérifier — voir la réserve ci-dessous] :

| Formule Tolteck | Prix | Équivalent annuel |
|---|---|---|
| Sans engagement | **25 € HT/mois** | 300 € HT/an |
| Engagement annuel | **19 € HT/mois** | 228 € HT/an |
| Annuel, entreprise de **moins de cinq ans** (−35 %) | **12,35 € HT/mois** | 148,20 € HT/an |

Le tout **pour tous corps d'état**.

**Conséquence directe** : les 19 €/mois de l'ADR 0001 ne s'alignaient pas sur le plancher du marché, ils se situaient **54 % au-dessus** du prix payé par la population que Chiffréo vise le plus naturellement — l'artisan récemment installé, celui qui n'a pas encore de logiciel — et pour une couverture cinq fois plus étroite. La prémisse tarifaire de D4 était fausse dans les deux dimensions : ni le calcul n'était un espace vide, ni le prix n'était un plancher.

> **Réserve.** Tolteck ne fait pas partie du panel de neuf acteurs de `VEILLE_CONCURRENTIELLE.md` ; ces montants n'y ont donc pas été contre-vérifiés à la source selon la méthode de cette note. Ils doivent l'être sur les pages publiques de Tolteck **avant tout usage dans une communication comparative**, au même titre que la liste de ses enseignes distributrices (`PROSPECTION_B2B2C.md` §1).

### 1.4 Ce que cette correction ne change pas

Elle **ne rouvre pas** la cible (D1), **ne rouvre pas** la sortie de la vision par ordinateur (D2), et **ne réhabilite pas** le particulier. Les cinq arguments du §4.1 de l'ADR 0001 contre le segment DIY — besoin épisodique, alternative gratuite suffisante, valeur non convertible en euros, absence de récurrence donc de signal, dépendance à la CV — sont indépendants de l'état de la concurrence sur le calcul. Aucun n'est affecté.

Elle change **une chose et une seule** : elle rend intenable de faire payer le calcul. C'est l'objet de D4 révisée.

---

## 2. Décisions

### D1, D2, D3 — confirmées

**D1 (cible = artisan des métiers de finition, particulier non monétisé) est confirmée.** Sans réserve, et pour les raisons déjà écrites en 0001 §4.1, qui ne dépendent pas du fait corrigé ci-dessus.

**D2 (vision par ordinateur hors périmètre, débranchée et non supprimée) est confirmée.** Sa condition de retour chiffrée — 50 à 100 photos réelles, télémètre laser, erreur médiane sous 5 % — reste en vigueur telle quelle (0001 §5.2).

**D3 (gel puis suppression) est confirmée et étendue.**

> **Extension** : **les organisations et le multi-utilisateurs rejoignent le widget marque blanche, l'API publique à clés et le SSO/Enterprise dans les suppressions.**

L'ADR 0001 §3.3 les exceptait explicitement, au motif que « le modèle est déjà backfillé 1:1 […] le retrait coûterait plus cher que la conservation ». **Cet arbitrage est renversé**, pour une raison qui n'existait pas au 3 août : avec D4 révisée, l'unité qui paie est une entreprise d'une personne qui achète de la conformité. Un niveau organisationnel qui n'aura jamais plus d'un membre n'est pas un actif dormant — c'est une jointure, une colonne et un modèle mental payés sur **chaque requête, chaque migration et chaque écran**, indéfiniment, pour une fonctionnalité que personne n'a demandée et que plus rien dans l'offre ne vend.

Restent hors du champ de la suppression, inchangés : `waste-learning` et `cost-benchmark`, gelés en base, sans coût, dont la réouverture est conditionnée aux données et non à une demande.

### D4 — RÉVISÉE. Le chiffrage devient gratuit et illimité ; la conformité devient le produit payant, à 279 € par an

**Ancienne décision (ADR 0001 §D4)** : `OFFER_PLANS` = Free (limité) + Artisan **19 €/mois**, palier unique.

**Nouvelle décision :**

| | Gratuit | Conformité |
|---|---|---|
| **Prix** | 0 € | **279 € par an**, **annuel uniquement** |
| **Chantiers** | **illimités** | illimités |
| **Contenu** | tout le chiffrage : métré, quantités, facteurs de perte, liste d'achat en conditionnements | tout le gratuit, **plus** : devis PDF conforme, fichier clients, historique de prix, facturation |
| **Garantie** | — | **30 jours satisfait ou remboursé** |

**Sont supprimés** : le palier DIY à **9,99 €/mois**, et **la landing particulier** (`apps/web/src/app/page.tsx`, dont l'en-tête indique en toutes lettres « Cette page sert une seule audience : le particulier qui rénove chez lui »).

**Ne sont pas supprimées** : les deux surfaces d'acquisition que D1 préserve — les **calculateurs publics indexables** et le **mode invité jusqu'à la liste d'achat incluse**. La suppression porte sur la page d'accueil orientée DIY, pas sur le canal DIY.

**Motifs, dans l'ordre où ils décident :**

1. **On ne peut pas vendre un calcul au prix d'un logiciel de devis complet.** ArtisanSmart vend 29 € HT/mois un calcul de quantités *et* d'heures sur **quatre fois plus de métiers** que Chiffréo. Tolteck vend 12,35 € HT/mois, **tous corps d'état**, à l'artisan installé depuis moins de cinq ans. Entre ces deux bornes, un abonnement mensuel qui ne vend que le calcul sur 5 corps d'état n'a pas de place défendable : trop cher pour la largeur offerte, trop étroit pour le prix demandé.
2. **Le calcul est ce qui est dur à copier et ce qui coûte zéro à servir ; la conformité est ce qu'on ne peut pas quitter.** Le moteur — géométrie, ouvertures, pertes par pose et par niveau, conditionnements, rendements sourcés et vérifiés en CI — représente l'essentiel de la valeur accumulée et un coût marginal quasi nul par utilisateur. Le donner maximise sa diffusion sans grever le compte d'exploitation. À l'inverse, un artisan qui a émis six mois de devis et de factures numérotées sans trou dans Chiffréo ne part pas : ses obligations légales vivent dans l'outil. **On fait payer ce qu'on ne quitte pas, on donne ce qu'on ne peut pas copier.**
3. **L'annuel attaque le churn, qui est le facteur limitant.** [estimé — hypothèses écrites] Sur un SaaS TPE mensuel, un churn de l'ordre de 5 %/mois donne une durée de vie moyenne de 1/0,05 ≈ **20 mois**. Un engagement annuel ne laisse la décision de partir se prendre qu'une fois par an ; à 30 % de non-renouvellement, la durée de vie moyenne passe à 1/0,30 ≈ 3,3 ans, soit ≈ **40 mois**. Le revenu par client sur sa durée de vie passe alors d'environ 380 € (19 € × 20 mois) à environ **930 €** (279 € × 3,3 ans) — un facteur 2,4 obtenu sans toucher à l'acquisition, qui est la variable la plus chère.
4. **Un palier gratuit limité à un chantier interdit la seule démonstration qui compte.** La promesse de Chiffréo n'est pas visible sur un chantier : elle se constate sur **deux ou trois**, quand l'artisan s'aperçoit qu'il n'a eu **ni reste ni manque**. Un quota d'un projet coupe l'essai exactement avant le moment où la valeur devient perceptible. Le chiffrage gratuit et illimité n'est pas une générosité, c'est **le protocole de démonstration**.

**Identifiant technique** : le palier payant conserve son identifiant `contractor_essentiel` — seuls changent le libellé commercial, le montant et la périodicité. Le renommer coûterait une migration et les gates existantes pour un gain nul.

### D5 — NOUVELLE. Facturation électronique : partenariat avec une Plateforme Agréée, à trancher en octobre 2026

**Le fait réglementaire** [sourcé — `CONFORMITE_FACTURATION.md` §1] :

- **1er septembre 2027** : **émission** de factures électroniques et **e-reporting** deviennent obligatoires pour les PME, TPE et micro-entreprises — c'est-à-dire pour la totalité de la cible de Chiffréo.
- Depuis la révision d'octobre 2024, le **Portail Public de Facturation ne fournit plus de solution mutualisée gratuite** d'émission/réception : il se limite à l'annuaire et à la concentration des données.
- **Toute facture électronique B2B doit donc transiter par une Plateforme Agréée (PA)**, agréée par la DGFiP. L'e-reporting des opérations B2C — majoritaires chez un artisan — passe lui aussi par une PA.

Chiffréo n'est pas une PA et ne le deviendra pas : agrément, audit, annuaire, cycles de vie de facture — un projet réglementé pluriannuel. **Deux options, et deux seulement :**

**(a) Partenariat avec une PA, en sous-traitance** — statut d'opérateur de dématérialisation raccordé à une PA tierce. C'est **la seule option qui préserve la facturation comme verrou de rétention**, donc la seule compatible avec le motif n° 2 de D4. Coût à instruire : **de l'ordre de 3 à 6 € par client et par mois**.

**(b) Retirer la facturation de l'offre** — repli sur un export Factur-X que l'artisan dépose lui-même dans sa propre PA. Le produit reste légal ; il perd le verrou.

> **Recommandation : (a). Décision à trancher en octobre 2026**, sur devis écrits, selon les seuils de §5.2.

**Écart consigné, pas lissé.** La fourchette de 3 à 6 €/client/mois retenue ici comme hypothèse de planification est **au-dessus** de celle qu'avait établie `CONFORMITE_FACTURATION.md` §8.4 (0 à 3,50 €, centre de gravité ~1 €), laquelle s'appuyait sur des prix unitaires sourcés de 0,10 à 0,50 €/facture et sur le précédent ArtisanSmart — raccordé à la PA Pennylane en mai 2026, coût absorbé sans surcoût dans son abonnement. **On planifie sur l'hypothèse haute et on décide sur devis** : une sous-estimation de ce poste se paierait en marge sur toute la base, une surestimation ne coûte qu'une prudence. Le seuil d'acceptabilité de §8.5 (≤ 2 €/client/mois), calé sur un palier à 19 €/mois qui n'existe plus, est **remplacé** par celui de §5.2 du présent ADR.

**Conséquence de l'inaction, écrite en clair** : la facturation est, depuis D4, **dans le produit payant**. Une facturation vendue et non conforme au 1er septembre 2027 n'est pas une fonctionnalité dégradée — c'est un produit payant devenu inutilisable au jour dit. **La totalité de la base client est perdue en un mois**, et l'unique verrou de rétention se retourne en unique motif de résiliation.

### D6 — NOUVELLE. Le B2B2C est testé en parallèle, dès maintenant

**La question posée**, et à laquelle ce test doit répondre : *à quelles conditions Chiffréo devient-il un moteur vendu à un négoce ou à un fabricant, plutôt qu'un abonnement vendu à 200 artisans ?*

**Le fait qui justifie de la poser** : **Tolteck a construit sa base de 30 000 clients par la distribution en négoce** — Point.P, Cedeo, Asturienne, La Plateforme du Bâtiment — **et non par le self-service**. [à vérifier — `PROSPECTION_B2B2C.md` §1 porte la même réserve sur la liste des enseignes] Et Tolteck ne calcule aucune quantité : il fait saisir les m² à la main. **Le canal est éprouvé ; l'étage du calcul n'y est pas encore.**

**Le canal se négocie par écrit.** Un contact de salon, une réponse aimable, un « intéressant, recontactez-nous » ne sont pas des signaux. Le matériel de prospection existe déjà — cinq e-mails nominatifs, leurs relances, la liste des destinataires et les garde-fous de ce qu'on a le droit d'affirmer sont dans `PROSPECTION_B2B2C.md`. Il n'y a rien à écrire, seulement à envoyer.

> **Règle d'arbitrage : si un négoce ou un fabricant donne une suite sérieuse, cette voie prime sur le SaaS self-service.** Le sens de « suite sérieuse » est défini en §5.3, et il l'est **avant** le premier envoi.

Ce que « prime » veut dire concrètement : les tâches de conversion self-service (tarification, essai, relances, acquisition) cèdent le pas, dans l'ordre de travail, à ce qu'exige la démonstration au partenaire. La V1 artisan n'est pas abandonnée — elle est le produit qu'on démontre — mais elle cesse d'être le canal de revenu par défaut.

---

## 3. Conséquences

### 3.1 Conséquences de D3 étendue (organisations et multi-utilisateurs)

- **La suppression se fait en deux lots séparés, et dans cet ordre.** D'abord les **surfaces** : écrans d'invitation, rôles, gestion des membres, lignes d'offre, gates. Ensuite, et seulement ensuite, le **modèle** : les colonnes `organization_id` portées par toutes les entités métier. Les fondre en un seul lot, c'est mêler un retrait d'interface sans risque à une migration qui touche chaque requête du produit.
- **Le second lot est le plus lourd du programme de suppression** — plus lourd que le widget, plus lourd que l'API à clés. Il doit être vérifié par une migration `up` puis `down` complète sur une base réelle, pas par des tests unitaires.
- **L'argument « c'est déjà backfillé » est explicitement récusé**, comme l'était en 0001 §4.5 l'argument « c'est déjà écrit et testé ». Le coût d'une structure n'est pas son coût d'écriture, déjà payé, mais son coût de conservation.
- **Ce que cela coûte** : la capacité d'accueillir sans migration une entreprise de plusieurs compagnons. C'est un coût réel et assumé — et il est réversible : git garde tout, et §5.1 en écrit la condition de retour.

### 3.2 Conséquences de D4 révisée (chiffrage gratuit, conformité payante)

**Sur le produit, concrètement :**

- **La frontière payant/gratuit change de nature.** Elle ne passe plus par un quota (« deux projets »), mais par un **type de geste** : calculer est gratuit, **produire un document opposable** est payant. Cette frontière a une propriété que le quota n'avait pas — elle est explicable en une phrase à un artisan, et elle ne le punit jamais d'utiliser le produit.
- **Le moteur cesse d'être l'argument de vente pour devenir l'argument d'acquisition.** Cela ne le déprioritise en rien : un calcul faux ne convertit personne, il fait juste échouer la démonstration plus tôt et plus silencieusement. La réparation du moteur reste le premier poste du backlog.
- **Le défaut d'assiette de la cloison sèche devient un risque d'acquisition, pas un risque de remboursement** (25 plaques au lieu de ~7, test rouge à HEAD). Un utilisateur gratuit qui constate une liste fausse ne demande pas son argent : il part sans rien dire, et il le dit à ses confrères. C'est pire.
- **Le quota `FREE_TIER_PROJECT_LIMIT` disparaît du chemin de chiffrage.** Il n'a plus d'objet : le chiffrage est illimité par décision.
- **Un seul produit Stripe en mode live, à périodicité annuelle.** Le palier DIY à 9,99 € étant supprimé, la variable `STRIPE_PRO_PRICE_ID` — aujourd'hui **exigée au démarrage** par `env.validation.ts` — perd sa raison d'être commerciale mais reste une contrainte technique tant que le code n'a pas changé. Le point est signalé dans `docs/DEPLOY.md` §4 ; il doit être traité **avant** la mise en vente, pas contourné en créant un prix fantôme.
- **Le traitement de `past_due` comme abonnement actif** (`subscriptions.service.ts:557`) reste à corriger avant la première vente, et le devient davantage : sur un abonnement annuel, plusieurs semaines de service gratuit après impayé portent sur un montant unitaire trois fois plus élevé.
- **La garantie 30 jours satisfait ou remboursé est un instrument de mesure**, pas seulement un argument : le **taux de remboursement** est le seul signal précoce disponible sur la qualité de la promesse. Il doit être compté dès la première vente. Son seuil d'alerte est en §5.1.

**Le fait inconfortable, écrit plutôt que tu** : 279 €/an est **plus cher que Tolteck en annuel** (228 € HT/an), et **88 % plus cher que Tolteck pour une entreprise de moins de cinq ans** (148,20 € HT/an) — pour cinq corps d'état contre tous. Ce n'est défendable que si la conformité vendue est réellement meilleure que celle du concurrent, et si le chiffrage gratuit a déjà fait la preuve de sa justesse **avant** que la question du prix se pose. C'est exactement l'ordre que le modèle impose : la démonstration précède le prix. Si cet ordre ne tient pas dans les faits, c'est le prix qui est faux — §5.1 en écrit le seuil.

**Ce que cela coûte** : tout revenu issu du calcul seul, et la possibilité de mesurer la volonté de payer pour le calcul — hypothèse que l'ADR 0001 voulait précisément tester. On y renonce sciemment : la correction du §1 montre que cette hypothèse ne pouvait pas être testée à un prix soutenable.

### 3.3 Conséquences de D5 (facturation électronique)

- **La facturation cesse d'être une fonctionnalité pour devenir une obligation à date.** Elle porte désormais le revenu ; elle porte donc aussi le risque. Un calendrier tenu n'est plus un confort de projet, c'est une condition de survie du produit payant.
- **Le travail est additif, et c'est le seul acquis confortable du dossier.** Le modèle de données porte déjà les champs qu'exige EN 16931 et la réforme 2026 (SIREN de l'acheteur, adresse de livraison, catégorie d'opération, option TVA sur les débits, pays des parties, date de prestation, devise, ventilation de TVA). Restent à écrire **un sérialiseur Factur-X** (PDF/A-3 + XML CII) et **un connecteur PA** — de la sérialisation et du transport, pas une refonte.
- **PDFKit ne produit pas de PDF/A-3** (XMP et OutputIntent ICC à écrire à la main). C'est le premier obstacle technique concret, et il est connu.
- **L'e-reporting B2C est l'inconnue n° 1 du chiffrage**, et c'est celle qui domine le volume d'un artisan : sa clientèle est majoritairement composée de particuliers. Aucune source consultée ne confirme qu'il soit inclus dans les prix unitaires affichés par les PA. **C'est la première question à poser par écrit**, avant même le prix.
- **Le fournisseur naturel est aussi un concurrent potentiel.** Pennylane — PA annoncée gratuite, précédent ArtisanSmart raccordé en mai 2026 — vend également un logiciel de facturation. La dépendance doit être négociée avec une clause de **réversibilité** explicite, et une seconde piste doit être instruite en parallèle (Iopole, Seqino en « marque grise », B2BRouter).
- **Ce que cela coûte** : 3 à 6 €/client/mois d'hypothèse haute, soit **13 à 26 % du revenu mensuel équivalent** (23,25 €). Au centre estimé du marché (~1 €), c'est ~4 %. L'écart entre ces deux mondes est la raison d'être des trois actions de §5.2.

### 3.4 Conséquences de D6 (canal B2B2C)

- **Deux canaux sont testés en parallèle, ce qui n'est pas deux produits.** L'ADR 0001 §4.2 écartait « servir deux segments » ; ici le produit, le moteur et le périmètre chiffrable sont **identiques** — seule la voie de mise sur le marché diffère. La contradiction est apparente, pas réelle. La limite à ne pas franchir est écrite : **aucune fonctionnalité spécifique à un partenaire ne s'écrit avant signature**.
- **Aucune promesse de marque blanche.** Le widget est gelé par D3 et destiné à la suppression. Un e-mail propose **une démonstration du moteur**, jamais une intégration prête. Laisser croire l'inverse serait vendre ce qui n'existe pas — le mode défaillance que l'ADR 0001 avait identifié.
- **Les garde-fous d'affirmation de `PROSPECTION_B2B2C.md` §1 s'appliquent intégralement**, en particulier : pas de « conforme aux DTU », pas de « le seul à… », pas de promesse de justesse générale tant que le défaut cloison sèche est ouvert, pas de revendication de largeur, pas de plan importé.
- **Le coût est un coût de temps, pas de développement** : cinq e-mails nominatifs, une relance chacun, et les réunions qui en découlent. Le matériel est écrit.
- **Ce que cela coûte** : l'attention de la personne qui écrit le code, sur une fenêtre où le moteur doit être réparé. C'est le seul vrai coût, et c'est pourquoi le test est borné dans le temps par §5.3.

---

## 4. Alternatives écartées

### 4.1 Maintenir un palier mensuel payant sur le chiffrage — l'alternative que ce texte annule

C'était la décision D4 de l'ADR 0001, et elle mérite d'être exposée à son meilleur. Un mensuel se vend plus facilement qu'un annuel : l'objection de prix est douze fois plus petite, l'essai gratuit y a un sens évident, et le revenu commence le premier mois. Surtout, il **teste la volonté de payer pour le calcul**, qui était l'hypothèse centrale du projet.

**Écartée parce que le test n'est pas praticable au prix du marché.** Entre ArtisanSmart à 29 € HT pour 15 métiers et Tolteck à 12,35 € HT tous corps d'état, l'espace pour un mensuel qui ne vend que le calcul sur 5 corps d'état est nul : au-dessus de 12,35 €, on est plus cher qu'une offre complète ; en dessous, on ne finance rien. Un test qu'on ne peut pas conduire dans des conditions honnêtes n'est pas un test.

### 4.2 Chiffrage gratuit mais limité à un ou deux chantiers

Écartée, et c'est l'alternative la plus tentante — elle rassure, elle ressemble à ce que tout le monde fait. Elle est écartée parce qu'elle **coupe l'essai exactement avant le moment de la preuve**. La valeur de Chiffréo ne se constate pas sur un chantier : elle se constate au deuxième ou au troisième, quand l'artisan réalise qu'il n'a eu ni reste ni manque, deux fois de suite. Un quota d'un projet transforme la seule démonstration qui convainc en démonstration qu'on ne peut pas faire.

### 4.3 Conserver le palier DIY à 9,99 € « puisqu'il existe »

Écartée, pour la raison déjà écrite en 0001 §4.5 et qui n'a pas changé : le coût d'une ligne d'offre n'est pas son coût d'écriture, mais son coût de conservation — un produit Stripe de plus, un cycle de facturation de plus, une page de plus à tenir cohérente, et une variable d'environnement obligatoire au démarrage pour un palier que la stratégie ne vend plus. D1 conserve le canal particulier ; elle n'a jamais demandé qu'on le facture.

### 4.4 Devenir soi-même Plateforme Agréée

Écartée sans hésitation. Agrément DGFiP, audit, raccordement à l'annuaire, gestion des cycles de vie de facture : un projet réglementé pluriannuel, sans rapport avec l'effort d'un lot de backlog, pour un produit qui n'a pas encore un utilisateur payant.

### 4.5 Attendre 2027 pour traiter la facturation électronique

Écartée. L'échéance est le **1er septembre 2027**, et ce qui doit exister à cette date n'est pas un développement mais un **contrat** : programme partenaire, conditions, réversibilité, e-reporting B2C chiffré. Un contrat se négocie en mois, et le connecteur se développe et s'éprouve après. Décider en octobre 2026 laisse dix mois ; décider en 2027 n'en laisse aucun, et fait basculer par défaut sur l'option (b) — la perte du verrou — sans que personne ne l'ait choisie.

### 4.6 Retirer la facturation de l'offre dès maintenant, pour ne pas dépendre d'une PA

Écartée, mais pas absurde : c'est l'option (b), et elle reste le repli documenté. Elle est écartée aujourd'hui parce qu'elle **détruit le motif n° 2 de D4** — la conformité est ce qu'on ne peut pas quitter — donc le modèle économique entier, et parce que le précédent ArtisanSmart démontre que le schéma visé (opérateur de dématérialisation raccordé à une PA) est faisable techniquement et économiquement **sur notre marché exact**. On ne renonce pas à un verrou avant d'avoir un devis.

### 4.7 Attendre la V1 pour tester le B2B2C

Écartée. C'est l'ordre intuitif — finir le produit, puis le vendre — et il est faux ici pour une raison de délai : un accord avec un négoce ou un fabricant se négocie sur des mois, et sa réponse **change ce qu'il faut construire**. La connaître tard, c'est construire d'abord et découvrir ensuite qu'on a construit pour le mauvais canal. Le coût du test est de cinq e-mails ; le coût de l'ignorance est un trimestre.

### 4.8 Miser sur le B2B2C plutôt que sur le self-service

Écartée en tant que décision *a priori*. Aucun signal ne le justifie aujourd'hui : la thèse repose entièrement sur un précédent (Tolteck) qui n'est pas une preuve que le même canal s'ouvrira à nous. D6 organise un test avec une règle d'arbitrage écrite, précisément pour que la bascule, si elle a lieu, réponde à un fait et non à une lassitude.

---

## 5. Critères de réouverture — D4, D5, D6

Même règle qu'en §5 de l'ADR 0001, et elle vaut d'être répétée : **chaque seuil ci-dessous est écrit avant observation.** Un signal absent n'est pas un signal faible — en l'absence du critère, la décision tient. Des seuils fixés après coup se rationalisent toujours (`tasks/lessons.md` n° 1, corollaire).

### 5.1 Réouvrir D4 — le modèle et le prix

**Rendre le chiffrage payant à nouveau si**, et seulement si, l'une de ces deux conditions est constatée :
- le **coût variable de service d'un compte gratuit dépasse 0,50 €/mois** deux mois consécutifs (hébergement, stockage, envois), c'est-à-dire si l'hypothèse « coûte zéro à servir » est démentie ;
- **plus de 2 000 comptes gratuits actifs** coexistent avec **moins de 10 conversions cumulées** — le gratuit n'est alors pas un entonnoir, c'est un produit fini.

**Réviser le prix de 279 €/an si**, sur les **40 premiers artisans ayant produit au moins trois listes d'achat**, **moins de 4 souscrivent la conformité dans les 60 jours** (< 10 %). Le problème est alors le prix ou l'emballage de la conformité, pas le moteur — qui aura, par construction, déjà servi trois fois.

**Réintroduire une périodicité mensuelle si** **au moins 5 refus explicites sur 20 conversations de vente** portent sur l'engagement annuel lui-même — refus motivé et consigné, pas hésitation. En dessous de ce seuil, l'objection est celle du prix, et elle se traite par le prix.

**Considérer que la promesse est en cause, et non le prix, si** le **taux de remboursement dépasse 20 % sur les 25 premières ventes**. Dans ce cas le tarif ne bouge pas : c'est le moteur ou la conformité livrée qui est en défaut, et la vente s'arrête le temps de la corriger.

**Ne constituent pas des critères** : un concurrent qui baisse son prix ; un prospect qui demande un essai plus long ; le sentiment que « 279 € fait cher d'un coup » ; le fait qu'une fonctionnalité gelée « mériterait » un palier.

### 5.2 Réouvrir D5 — facturation électronique

**Seuil d'acceptabilité, fixé avant réception des devis** : **≤ 3,50 € par client et par mois, tout compris** — set-up amorti, minimum mensuel, prix par facture, **e-reporting B2C inclus**, archivage à valeur probante 10 ans, gestion de l'annuaire et des cycles de vie, frais de sortie. Soit ≈ 15 % du revenu mensuel équivalent (23,25 €). Ce seuil **remplace** celui de `CONFORMITE_FACTURATION.md` §8.5 (≤ 2 €), calé sur un palier à 19 €/mois qui n'existe plus.

**Trois issues, et une seule se décide en octobre 2026 :**

| Constat au 31 octobre 2026 | Décision |
|---|---|
| Au moins un devis ferme **≤ 3,50 €/client/mois** tout compris | **Option (a)** : partenariat PA signé, connecteur planifié |
| Devis entre **3,50 et 6 €** | Option (a) maintenue, mais **le surcoût est répercuté dans le prix** du palier Conformité au renouvellement suivant — jamais absorbé en silence |
| **Aucun devis ≤ 6 €**, ou aucun devis obtenu | **Option (b)** : la facturation sort de l'offre, repli sur l'export Factur-X déposé par l'artisan dans sa propre PA. Le prix du palier est révisé à la baisse en conséquence. |

**Date de non-retour, écrite maintenant** : si le connecteur PA n'est pas **en production le 1er mars 2027**, l'option (b) s'applique d'office — six mois de marge avant l'échéance légale, ce qui est le minimum pour retirer proprement une fonctionnalité vendue et prévenir les clients.

**Les trois actions qui produisent le chiffre ferme** sont détaillées dans `CONFORMITE_FACTURATION.md` §8.5 : candidature au programme partenaire Pennylane en citant le précédent ArtisanSmart, deux devis comparables à des PA infrastructurelles (Iopole, Seqino en « marque grise ») sur un profil chiffré identique, et une grille unique de coûts complets. **La première question à poser, avant le prix : l'e-reporting B2C est-il inclus, et à quelles conditions ?**

**Ne constituent pas des critères de report** : une annonce de décalage de la réforme non publiée au Journal officiel ; l'espoir qu'une PA devienne gratuite ; le fait que peu de clients facturent encore en B2B.

### 5.3 Réouvrir D6 — le canal B2B2C

**Le protocole, arrêté avant le premier envoi :** les **cinq e-mails nominatifs** de `PROSPECTION_B2B2C.md` §3 partent **avant le 30 septembre 2026**, un destinataire nommé par entreprise, une relance unique à J+10. Cinq cibles : Gedimat, Tout Faire Matériaux, Chausson Matériaux (ou Doras), Siniat ou Knauf, Cermix ou Parexlanko.

**« Suite sérieuse » — définition écrite avant observation.** Une réponse ne compte que si elle réunit **les trois** :
1. une **demande écrite de seconde réunion**, à leur initiative ;
2. un **interlocuteur nommé** côté partenaire, avec un rôle de décision ou de budget ;
3. un **périmètre pilote énoncé** — un nombre de points de vente, une gamme, une zone.

**Si une suite sérieuse est obtenue avant le 31 décembre 2026** : la règle d'arbitrage de D6 s'applique — **cette voie prime sur le SaaS self-service**, et l'ordre de travail est réorganisé autour de la démonstration au partenaire. Aucun développement spécifique n'est engagé avant signature.

**Si aucune suite sérieuse n'est obtenue au 31 décembre 2026**, sur cinq envois relancés : le canal est **clos par défaut**, et il ne se rouvre que sur **demande entrante non sollicitée**. Cette clôture ne demande pas de nouvelle décision.

**Ne constituent pas des signaux** : une réponse polie ; un « intéressant, recontactez-nous plus tard » ; un contact de salon sans suite écrite ; un accord verbal ; l'intérêt d'un interlocuteur sans rôle de décision.

---

## 6. Ce que cet ADR ne décide pas

- **HT ou TTC pour les 279 €/an.** L'information n'est pas disponible et l'arbitrage n'est pas neutre : la cible mêle des artisans assujettis à la TVA (affichage HT, usage B2B) et des micro-entrepreneurs en franchise en base (art. 293 B), pour qui le HT n'a pas de sens. À trancher **avant la création du prix Stripe**, et à répercuter dans `docs/DEPLOY.md` §4, sur `/pricing` et dans les CGV.
- **Le sort du quota `FREE_TIER_PROJECT_LIMIT` sur les objets autres que le chiffrage.** D4 rend le chiffrage illimité ; ce que devient la limite sur les autres entités relève de l'exécution.
- **La PA retenue.** D5 recommande l'option (a) et fixe les seuils ; le choix du partenaire se fait sur devis, en octobre 2026.
- **La forme contractuelle d'un accord B2B2C** (licence de moteur, marque blanche, apport d'affaires, revenu par point de vente). Elle se négocie avec le premier partenaire sérieux, pas avant.
- **Les trois questions laissées ouvertes par l'ADR 0001 §6** — sort du catalogue à 208 matériaux, forme de la liaison ouvrage → matériaux, périmètre de conformité facturation hors e-invoicing — restent ouvertes et inchangées, à l'exception de l'e-invoicing, que D5 traite.

---

## 7. Suivi

| Décision | Statut | Application |
|---|---|---|
| **D1** — cible artisan | Confirmée | ADR 0001 §3.1 · E1, E2-1, E2-2, E2-3 |
| **D2** — CV hors périmètre | Confirmée | ADR 0001 §3.2 · E0-3, E3-1, E3-2 |
| **D3** — gel puis suppression | Confirmée et **étendue** aux organisations et au multi-utilisateurs | E0-3 (gates) · E3-3 (suppression) · E3-5 (purge des mentions) — **E3-3 se dédouble** : surfaces d'abord, colonnes `organization_id` ensuite |
| **D4** — modèle et prix | **Révisée** : chiffrage gratuit illimité ; Conformité 279 €/an, annuel, 30 jours satisfait ou remboursé ; DIY 9,99 € et landing particulier supprimés | E3-4 (offre) · E5-1 (Stripe) · E5-2 (`past_due`) |
| **D5** — facturation électronique | **Nouvelle** : partenariat PA recommandé, décision en octobre 2026, non-retour au 1er mars 2027 | `CONFORMITE_FACTURATION.md` §8.5 (trois actions) — **tâche de backlog à créer** |
| **D6** — canal B2B2C | **Nouvelle** : cinq envois avant le 30/09/2026, arbitrage au 31/12/2026 | `PROSPECTION_B2B2C.md` — **tâche de backlog à créer** |

Toute tâche du dépôt qui contredit une décision du présent ADR est hors périmètre tant qu'elle n'est pas révisée par un ADR successeur — la révision se fait par un nouvel ADR, **jamais par édition silencieuse**. La règle vaut pour ce texte comme elle valait pour l'ADR 0001.
