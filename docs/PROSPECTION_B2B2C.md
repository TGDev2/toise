# Prospection B2B2C — négoces et fabricants (août 2026)

> Cinq e-mails prêts à envoyer, plus la liste des destinataires à identifier.
> Objectif commercial visé : **contrat de marque blanche ou d'API**, pas une
> vente de licence à l'unité. Aucun e-mail ne demande d'argent ; chacun propose
> une seule chose, gratuite et sans engagement : **une démonstration de
> 15 minutes en visio sur un de leurs chantiers types**.
>
> **Rien dans ces textes ne promet une fonctionnalité absente du dépôt.** Les
> garde-fous et les preuves sont en §1 et §4 : les lire avant d'envoyer, et les
> relire si quelqu'un reformule un e-mail.

---

## 1. Ce qu'on a le droit d'affirmer — et ce qui est interdit

### Vrai aujourd'hui, prouvable dans le dépôt

| Affirmation | Preuve |
| --- | --- |
| Surface nette calculée depuis la pièce : périmètre × hauteur − ouvertures | `estimation-engine.ts:329-343` |
| Formes rectilignes (union de rectangles, pièce en L) | `room-geometry.ts`, `l-shaped-room.spec.ts` |
| Déduction des ouvertures, ouverture par ouverture, détaillée dans le calcul | `estimation-engine.spec.ts` §openings |
| Rendements adossés à une fiche fabricant, avec URL et date de consultation | `docs/SOURCES_CATALOGUE.md`, vérifié en CI par `sources-catalogue.spec.ts` |
| Résultat en conditionnements commerciaux panachés (« 1 × 5 L + 1 × 2,5 L »), mutualisés entre pièces | `selectBestPackaging`, `aggregatePurchases` |
| Facteur de perte selon la pose et le niveau de l'artisan | 9 triplets pose × niveau |

**Périmètre chiffrable, à ne jamais élargir dans un e-mail** : peinture murale,
peinture plafond, carrelage sol, carrelage mural, parquet/stratifié, cloison
sèche, revêtement mural. Sept ouvrages, cinq corps d'état de finition.

### Interdits (repris de `docs/VEILLE_CONCURRENTIELLE.md` §5.2)

- Ne pas dire « **conforme aux DTU** » : les facteurs de perte et les temps de
  main-d'œuvre sont des valeurs d'usage métier, **sans référence normative**.
  Seuls les **rendements matériaux** sont sourcés.
- Ne pas dire « le seul à calculer des quantités », « le seul à faire du métré »,
  « le seul à déduire les ouvertures », « le seul adossé à des sources ».
  Version défendable : « le seul à publier la source fabricant de chaque
  rendement et à la vérifier automatiquement ».
- Ne pas promettre de **justesse générale** tant que le défaut d'assiette
  cloison sèche est ouvert (§4).
- Ne pas revendiquer une **largeur** de couverture : cinq corps d'état contre
  dix à quinze chez les concurrents. La profondeur est l'argument, pas la
  largeur.
- Ne pas promettre un **plan importé** : Chiffréo part de dimensions saisies.
- Ne pas laisser croire que la **marque blanche existe déjà** : elle est le
  modèle visé, pas un module livré. Un e-mail propose une démonstration du
  moteur, jamais une intégration prête.

### Le précédent Tolteck — comment le citer

Tolteck est distribué par Point.P, Cedeo, Asturienne et La Plateforme du
Bâtiment. **Tolteck ne calcule aucune quantité : il fait saisir les m² à la
main.** C'est un précédent qui prouve que le canal existe et qu'un négoce sait
signer ce type d'accord — jamais une menace, jamais un dénigrement. Formulation
retenue : « le canal est déjà éprouvé ; l'étage du calcul n'y est pas encore ».

> Vérifier la liste des enseignes distributrices sur les pages publiques de
> Tolteck avant le premier envoi. Elle est exacte à date de rédaction mais
> n'est adossée à aucune trace du dépôt, contrairement au reste de ce document.

---

## 2. Destinataires à identifier

Un e-mail nominatif, jamais `contact@`. Chercher le nom sur LinkedIn (filtre
entreprise + intitulé), sur les communiqués de presse de l'enseigne et sur les
programmes des salons (Artibat, Batimat, Global Industrie pour les fabricants).

| # | Cible | Fonction à viser | Repli acceptable | Ce qu'il achète |
| --- | --- | --- | --- | --- |
| 1 | **Gedimat** | Directeur marketing / digital du groupement | Directeur des services aux adhérents | De la fidélisation et du panier moyen pour ses adhérents |
| 2 | **Tout Faire Matériaux** | Directeur du développement / de l'offre | Responsable digital et services adhérents | Un service commun que 400 points de vente indépendants peuvent servir |
| 3 | **Chausson Matériaux** (ou **Doras**) | Directeur marketing et digital | Directeur commercial réseau | Le comptoir artisan : moins de retours, moins de ruptures, plus de lignes |
| 4 | **Siniat** ou **Knauf** | Responsable prescription | Chef de marché plaque / responsable outils digitaux | La prescription de **ses propres ratios** de système |
| 5 | **Cermix** ou **Parexlanko** | Responsable prescription / chef de marché carrelage | Directeur marketing produit | Que sa consommation au m² soit appliquée telle que sa fiche l'écrit |

Un seul destinataire par entreprise au premier envoi. En copie personne : un
e-mail à trois noms n'engage aucun des trois.

---

## 3. Les cinq e-mails

### 3.1 — Gedimat

**Objet** : Le client qui repart avec deux pots de trop

**Destinataire** : Directeur marketing / digital du groupement

> Bonjour [Prénom],
>
> Un particulier qui refait sa chambre repart souvent avec deux pots de trop, ou
> revient le samedi chercher le sac qui manque. Dans les deux cas, la quantité a
> été estimée au comptoir, de tête.
>
> Nous avons construit un moteur de métré pour les ouvrages de finition. À
> partir des dimensions d'une pièce relevées au télémètre — pièces en L
> comprises, ouvertures déduites — il sort une liste d'achat en conditionnements
> réels : pots, sacs, plaques. Chaque rendement est adossé à une fiche fabricant
> datée.
>
> Ce qui vous concerne : cette liste peut se terminer dans votre catalogue, avec
> vos références et vos prix. Le client arrive avec un panier prêt.
>
> Tolteck, distribué par plusieurs enseignes, s'arrête avant : les m² y sont
> saisis à la main.
>
> Quinze minutes en visio pour le voir tourner sur un de vos chantiers types ?
>
> Bien à vous,
> [Signature]

**Relance à J+10**

> Bonjour [Prénom], je reviens vers vous sur le calcul de quantités en sortie de
> catalogue Gedimat.
> Je peux le faire tourner devant vous sur une pièce type de vos adhérents —
> quinze minutes, sans préparation de votre côté.
> Si le sujet n'est pas le vôtre, dites-moi simplement vers qui me tourner.

---

### 3.2 — Tout Faire Matériaux

**Objet** : Un service que 400 points de vente peuvent servir à l'identique

**Destinataire** : Directeur du développement / de l'offre

> Bonjour [Prénom],
>
> Dans un groupement d'indépendants, le conseil quantitatif dépend du vendeur
> présent au comptoir ce jour-là. Deux adhérents, deux réponses, et le client
> qui s'est trompé revient chez le premier venu.
>
> Nous avons construit un moteur de métré pour les ouvrages de finition :
> peinture, carrelage, parquet, cloison sèche, revêtement mural. Il part des
> dimensions relevées au télémètre, gère les pièces en L et déduit les
> ouvertures, puis rend une liste d'achat en conditionnements réels — pots,
> sacs, plaques. Chaque rendement renvoie à une fiche fabricant datée.
>
> L'intérêt pour un groupement : c'est le même calcul partout, mais il se
> termine dans le catalogue de l'adhérent, avec ses références et ses prix.
>
> Quinze minutes en visio sur un de vos chantiers types, pour juger sur pièce ?
>
> Bien à vous,
> [Signature]

**Relance à J+10**

> Bonjour [Prénom], ma proposition tient toujours : un calcul de quantités
> homogène entre adhérents, servi dans le catalogue de chacun.
> Quinze minutes en visio suffisent à voir ce que ça donne sur une pièce réelle.
> Un mot me suffit, même pour me dire que ce n'est pas le moment.

---

### 3.3 — Chausson Matériaux (ou Doras)

**Objet** : Les retours de fin de chantier de vos clients artisans

**Objet alternatif** : Le sac en trop et la plaque qui manque

**Destinataire** : Directeur marketing et digital

> Bonjour [Prénom],
>
> Un artisan de finition qui commande ses matériaux fait ses quantités le soir,
> à la main. Résultat : des retours en fin de chantier, ou un aller-retour en
> urgence pour une plaque. Les deux vous coûtent — l'un en logistique, l'autre
> en temps de comptoir.
>
> Nous avons construit un moteur de métré pour ces ouvrages-là : peinture,
> carrelage, parquet, cloison sèche, revêtement mural. À partir des dimensions
> d'une pièce relevées au télémètre — pièces en L, ouvertures déduites — il rend
> une liste d'achat en conditionnements réels, avec un facteur de perte réglé
> sur le type de pose.
>
> Le point utile pour vous : cette liste peut sortir dans votre catalogue, avec
> vos références et vos prix.
>
> Quinze minutes en visio sur un de vos chantiers types ?
>
> Bien à vous,
> [Signature]

**Relance à J+10**

> Bonjour [Prénom], je me permets un rappel au sujet des quantités matériaux de
> vos clients artisans.
> La démonstration dure quinze minutes et part d'une pièce que vous choisissez.
> Si ce n'est pas votre périmètre, indiquez-moi la bonne personne et je n'insiste
> plus.

---

### 3.4 — Siniat ou Knauf (fabricant de plaques de plâtre)

**Objet** : Vos ratios de système, appliqués tels que votre fiche les écrit

**Destinataire** : Responsable prescription

> Bonjour [Prénom],
>
> Vos fiches solution donnent des ratios précis au m² de cloison : plaques,
> rails, montants, vis, bande, enduit. Sur le chantier, presque personne ne les
> ouvre — on compte les plaques à vue, et l'écart se règle en rachetant ce qui
> manque, pas toujours dans votre marque.
>
> Nous avons construit un moteur de métré des ouvrages de finition. Il part des
> dimensions d'une pièce relevées au télémètre et rend une liste d'achat en
> conditionnements réels. Chaque ratio qu'il applique est adossé à une fiche
> fabricant identifiée et datée — pour la cloison, ce sont des fiches solution
> de plaquiste, pas des moyennes maison.
>
> Autrement dit : votre prescription, appliquée à la géométrie réelle de la
> pièce.
>
> Quinze minutes en visio sur un de vos systèmes types ?
>
> Bien à vous,
> [Signature]

**Relance à J+10**

> Bonjour [Prénom], je reviens sur l'application automatique de vos ratios de
> système au métré d'une pièce.
> Quinze minutes en visio, sur le système de cloison de votre choix, suffisent à
> en juger.
> Si la prescription digitale est portée par quelqu'un d'autre chez vous, je veux
> bien son nom.

---

### 3.5 — Cermix ou Parexlanko (colles et mortiers)

**Objet** : Vos kg/m² par format de carreau, appliqués sans arbitrage

**Destinataire** : Responsable prescription / chef de marché carrelage

> Bonjour [Prénom],
>
> Votre fiche technique distingue la consommation au m² selon le format du
> carreau et le simple ou double encollage. Sur le terrain, le calcul se fait au
> sac : on en prend « à peu près », on sous-dose ou on rachète — et quand le
> résultat déçoit, c'est rarement la méthode qui est mise en cause.
>
> Nous avons construit un moteur de métré des ouvrages de finition. Il part des
> dimensions d'une pièce relevées au télémètre, déduit les ouvertures, et rend
> une liste d'achat en conditionnements réels. Pour les colles, il lit la ligne
> de la fiche technique qui correspond au format posé — chaque valeur est datée
> et traçable jusqu'à votre document.
>
> Votre consommation prescrite, appliquée telle quelle.
>
> Quinze minutes en visio sur un de vos cas types ?
>
> Bien à vous,
> [Signature]

**Relance à J+10**

> Bonjour [Prénom], je reviens sur l'application de vos consommations au m² par
> format de carreau.
> La démonstration dure quinze minutes et part du cas de pose que vous choisissez.
> Un simple « pas intéressé » me va aussi — je n'insisterai pas.

---

## 4. Séquencement et garde-fous avant envoi

1. **Ne pas démontrer la cloison sèche aujourd'hui.** Le défaut d'assiette est
   ouvert : une cloison à créer est chiffrée comme l'habillage des quatre murs
   de la pièce (25 plaques au lieu de ~7), test rouge volontaire à HEAD
   (`drywall-created-partition.spec.ts`), liens d'achat bloqués en conséquence
   (`SHOPPING_LIST_ENGINE_CORRECTED = false`). Conséquences pratiques :
   - l'e-mail **3.4** (Siniat/Knauf) ne part **qu'après** correction — c'est le
     seul dont la démonstration porte sur l'ouvrage défectueux ;
   - pour les e-mails **3.1 à 3.3**, choisir un chantier type en peinture ou en
     carrelage, et ne pas proposer la cloison si l'interlocuteur ne la demande
     pas. S'il la demande, le dire : « cet ouvrage est en cours de correction ».
2. **Envoyer par lots de deux, à trois jours d'intervalle.** Ce qui revient des
   deux premières réponses corrige les suivantes.
3. **Une seule relance**, à J+10, puis stop. Une deuxième relance coûte la
   relation.
4. **Rien n'est chiffré dans ces e-mails** — ni prix, ni commission, ni
   volume. La négociation commence après la démonstration, pas avant.
5. **Tenir un journal des envois** (date, destinataire, fonction, réponse) pour
   que la relance J+10 ne parte pas deux fois.
