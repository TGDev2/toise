# Veille concurrentielle — calcul automatique de quantités de matériaux (France, août 2026)

Note de veille factuelle sur les logiciels du marché français qui revendiquent un
**calcul automatique de quantités de matériaux** pour les artisans du bâtiment.
Recherches conduites les 6 et 7 août 2026, exclusivement sur sources publiques
(sites éditeurs, registre officiel des entreprises, annuaires logiciels, presse
professionnelle, plateformes d'avis).

## Méthode et conventions

Chaque fait porte l'un de ces trois statuts :

- **[VÉRIFIÉ]** — lu directement à la source citée (URL consultée avec succès) ;
- **[DÉDUIT]** — conclusion d'analyste tirée de faits vérifiés, raisonnement indiqué ;
- **[NON VÉRIFIÉ]** — introuvable ou inaccessible ; les tentatives sont documentées en §3.

Limites techniques transversales, valables pour toute la note :

- **web.archive.org est inaccessible** depuis l'outillage utilisé — aucune vérification
  d'historique de site n'a pu être faite.
- **Trustpilot bloque la consultation directe** (HTTP 403) — les notes Trustpilot citées
  proviennent d'extraits de moteur de recherche ou de sites tiers.
- **Les fiches francenum.gouv.fr se rendent vides** hors navigateur (rendu JavaScript) —
  l'existence des fiches est vérifiée, leur contenu ne l'est que par extraits de
  recherche. Un test témoin sur une fiche tierce confirme que le problème est propre au
  site, pas aux fiches visées.
- **Le contenu des vidéos YouTube n'a pas pu être visionné** — seuls les titres, dates et
  l'existence des chaînes sont vérifiés.

---

## 1. Cibles prioritaires

### 1.1 ArtisanSmart (artisansmart.fr) — fonction « SmartChiffrage »

**Existence.** Site actif sur artisansmart.fr et www.artisansmart.fr, page commerciale
complète d'un logiciel de devis/factures bâtiment. [VÉRIFIÉ — https://artisansmart.fr]

**Identité juridique.** RS NUMÉRIQUE, nom commercial ArtisanSmart. SASU au capital de
1 000 €, **SIREN 101 678 456**, RCS Angers, siège 25 rue Lenepveu, 49100 Angers,
président Romaric Sauvanet, mentions légales datées du 27/02/2026.
[VÉRIFIÉ — https://artisansmart.fr/mentions-legales.html] Registre officiel : créée le
**16/02/2026**, NAF 58.29C, **0 salarié** (non-employeur).
[VÉRIFIÉ — https://annuaire-entreprises.data.gouv.fr/entreprise/101678456]
Aucune fiche Pappers ni societe.com remontée par les recherches. [NON VÉRIFIÉ]
Réserve : un SIREN en plage 1xx est atypique au regard des attributions historiques ;
il est toutefois cohérent avec l'ouverture par l'INSEE des tranches commençant par 1
pour les immatriculations récentes — à contre-vérifier sur INSEE/INPI avant tout usage
juridique. [DÉDUIT]

**Prix.** **29 € HT/mois**, soit **34,80 € TTC** (TVA 20 %), formule « Solo Pro »
présentée comme « tout inclus », sans engagement, essai 14 jours sans CB.
[VÉRIFIÉ — https://artisansmart.fr/fonctionnalites/] Incohérence : un plan « Équipe » à
49 €/mois apparaît **uniquement** sur Software Advice, absent du site français.
[VÉRIFIÉ — https://www.softwareadvice.com/product/538554-ArtisanSmart/]

**Métiers.** 15 corps d'état listés : maçon, charpentier, couvreur, façadier, plombier,
électricien, chauffagiste, climaticien, installateur sécurité, menuisier, plaquiste,
peintre, carreleur, serrurier, paysagiste. [VÉRIFIÉ — https://artisansmart.fr/metiers/]
Incohérence temporelle : un article Batinfo du 22/04/2026 parlait de « 448 prix de
référence couvrant 13 métiers » ; le site affiche aujourd'hui 15 métiers pour le même
nombre de prix (448) — le catalogue métiers a grossi à base de prix constante.
[VÉRIFIÉ — https://batinfo.com/en/patented/Quotation--invoice-and-management-software-for-construction-tradespeople_2785]

**Ce que « SmartChiffrage » produit réellement.** D'après les exemples publiés par
l'éditeur lui-même :

- des **listes de matériaux en unités techniques** (u, ml, m³, m², L) — jamais de
  conditionnement commercial (sacs, cartons, pots) ;
- des **heures de main-d'œuvre** et un coût de revient HT.

Exemples exacts relevés : dalle 50 m² ép. 15 cm + mur parpaings 10×2 m → « Béton B25 :
7,5 m³ ; Parpaings 20×20×50 : 200 u ; MO équipe 2 pers. : 40 h »
[VÉRIFIÉ — https://artisansmart.fr/metiers/macon.html] ; « Tuiles 12/m² (80 m²) =
960 u ; Liteau = 267 ml ; MO pose = 48 h »
[VÉRIFIÉ — https://artisansmart.fr/fonctionnalites/] ; peintre : « surface développée
80 m² (murs + plafonds − ouvertures), plafond 10 L, murs 15 L, MO 24 h »
[VÉRIFIÉ — https://artisansmart.fr/metiers/peintre.html].

**Méthode apparente : ratios constants, sans perte.** Les exemples publiés sont des
multiplications exactes : 7,5 m³ = 50 × 0,15 (volume géométrique brut, zéro perte),
200 parpaings = 20 m² × 10/m² (zéro casse), 960 tuiles = 80 × 12 (ratio fixe malgré la
mention « selon la pente »). Seule la page peintre revendique une déduction
d'ouvertures ; rien n'indique un métré géométrique pièce par pièce. [DÉDUIT — des
exemples chiffrés ci-dessus, tous sans coefficient de perte]

**Sources citées.** Des DTU sont cités en argument marketing (DTU 20.1, NF DTU 59.1,
DTU 60.11, NFC 15-100, Eurocode 5) mais **aucune méthodologie, aucune fiche fabricant,
aucune bibliothèque tierce** (BatiPrix, BatiChiffrage) n'étaye les « 448 prix
calibrés ». [VÉRIFIÉ pour les citations DTU ; NON VÉRIFIÉ pour toute source des ratios]

**Avis et annuaires.** Aucune fiche sur appvizer.fr, capterra.fr, getapp.fr,
lebonlogiciel.com, tool-advisor.fr. Capterra India, GetApp Ireland et Software Advice :
fiches existantes à **0 avis**. Les « 5/5 Google et Pages Jaunes » affichés sur le site
sont autodéclarés et n'ont été retrouvés sur aucune plateforme tierce. Aucune vidéo de
démonstration trouvée. [VÉRIFIÉ — https://www.capterra.in/software/1086377/ArtisanSmart,
https://www.getapp.ie/software/2084273/artisansmart ; NON VÉRIFIÉ pour les avis Google]

**France Num.** La fiche activateur existe
(https://www.francenum.gouv.fr/activateurs/artisansmart) au nom de RS Numérique.
« Activateur France Num » référence un **prestataire** dans un annuaire déclaratif — ce
n'est ni un label de qualité ni une certification du logiciel ; le badge est exact au
sens strict mais son usage comme réassurance produit est un raccourci marketing.
[VÉRIFIÉ pour l'existence ; DÉDUIT pour la qualification]

**Synthèse.** Les revendications existent toutes (SmartChiffrage, 29 € HT, 15 métiers,
France Num), mais le profil réel est une SASU unipersonnelle de six mois, 0 salarié,
0 avis tiers, et un « moteur » qui, d'après ses propres exemples, applique ~448 ratios
fixes sans facteur de perte ni métré géométrique, habillés de références DTU non
sourcées. [DÉDUIT — de l'ensemble ci-dessus]

### 1.2 Tactidevis (tactidevis.fr)

**Existence.** Site actif (tactidevis.fr et www.tactidevis.fr), logiciel SaaS de
devis/factures bâtiment édité depuis Taverny (95). [VÉRIFIÉ — https://tactidevis.fr]

**Identité juridique.** **L.S.M.B.**, SAS au capital de 19 000 €, **SIREN
809 233 547**, RCS Pontoise, créée le **15/01/2015**, NAF 62.01Z, **0 salarié**
(non-employeur). Directeur de publication : Philippe Lemoine.
[VÉRIFIÉ — https://annuaire-entreprises.data.gouv.fr/entreprise/809233547 et
https://www.tactidevis.fr/mentions-legales-et-conditions-generales-de-vente]

**Prix.** **36 € HT/mois (43,20 € TTC)** ; annuel **396 € HT (475,20 € TTC)**, soit
33 € HT/mois. Option signature électronique +10 €/mois. Essai 5 jours. Abonnement à
durée déterminée sans reconduction tacite. [VÉRIFIÉ — https://www.tactidevis.fr/tarifs]

**Métiers.** 10 métiers ciblés : électriciens, plombiers, couvreurs, peintres,
menuisiers, plaquistes, serruriers, vitriers, carreleurs, poseurs de sol. Bibliothèque
revendiquée : « 800+ matériaux, 6 800+ tarifs ». [VÉRIFIÉ — https://tactidevis.fr]

**Ce que le calcul produit réellement.** Le site décrit un calcul de **prix** à partir
de quantités saisies par l'artisan : « ajoute les ouvrages souhaités, indique les
quantités en m², ml ou au forfait » puis le logiciel « calcule automatiquement le coût
total ». Le calculateur peinture demande surface, type de peinture, nombre de couches,
et affiche la méthode : « multipliez la longueur par la largeur » — sortie en € HT/TTC.
**Aucune quantité de peinture en litres, aucune heure de MO détaillée, aucune déduction
d'ouvertures, aucun facteur de perte, aucun conditionnement documentés.**
[VÉRIFIÉ — https://www.tactidevis.fr/outil-de-conception-et-calcul-devis et
https://www.tactidevis.fr/calculateur-peinture]

**Méthode apparente.** Chiffrage tarifaire (quantités saisies × prix de bibliothèque),
au mieux ratio au m² simple ; aucune preuve de métré géométrique. [DÉDUIT]

**Sources citées.** Aucune (ni DTU, ni fabricant, ni BatiChiffrage/BatiPrix). Origine
revendiquée des prix : « tarifs issus d'artisans expérimentés ».
[VÉRIFIÉ — https://www.tactidevis.fr/bibliotheque-de-prix-pour-electriciens]

**Partenariat CAPEB : non confirmé côté CAPEB.** La page « CAPEB & Tactidevis » du site
parle d'un logiciel « pensé pour répondre aux besoins […] du réseau CAPEB » — aucun
accord signé mentionné, aucun tarif adhérent.
[VÉRIFIÉ — https://www.tactidevis.fr/artisan-professionnel-capeb] Côté CAPEB : les
partenaires numériques listés sont Sage, IArtisans, Simplebo ; Tactidevis est **absent**
des deux pages partenaires de capeb.fr et une recherche restreinte au domaine capeb.fr
ne renvoie aucune occurrence. [VÉRIFIÉ — https://www.capeb.fr/service/les-partenaires et
https://www.capeb.fr/partenaires-commerciaux/nos-partenaires-departementaux-et-nationaux]
Conclusion : marketing de ciblage plutôt que partenariat officiel. Réserve : un accord
avec une CAPEB départementale isolée ne peut être exclu (guide PDF des offres
partenaires > 10 Mo, non lu). [DÉDUIT]

**Avis et annuaires.** Aucune fiche appvizer, tool-advisor, lebonlogiciel, Capterra,
GetApp. Trustpilot ~4/5 avec **2 avis** (extraits de recherche, page en 403). Buuyers :
2 avis 5/5 vieux de 6-8 ans, dont un déposé par Tactidevis lui-même. Fiche France Num
« L.S.M.B TACTIDEVIS » existante, contenu non extractible. ≈ 4 avis publics cumulés en
huit ans. [VÉRIFIÉ — https://www.buuyers.com/avis-tactideviscom ; DÉDUIT pour le signal]

**Synthèse.** Acteur micro (SAS sans salarié depuis 2015, quasi absent des plateformes),
« partenariat CAPEB » non corroboré, « calcul de quantités » qui est en réalité un
chiffrage tarifaire sur quantités manuelles. [DÉDUIT]

---

## 2. Cibles secondaires

### 2.1 Nexartis (nexartis.fr)

- **Identité** : Jérémy Schmitt, **entrepreneur individuel**, SIREN 840 059 687, créé le
  29/05/2018, **NAF 68.31Z (agences immobilières)** — pas l'édition logicielle —,
  0 salarié, franchise en base de TVA, contact sur adresse Gmail. « Nexartis » n'existe
  pas comme dénomination au registre.
  [VÉRIFIÉ — https://nexartis.fr/mentions-legales et
  https://annuaire-entreprises.data.gouv.fr/entreprise/840059687]
- **Prix** : Essentiel **15 €/mois**, Complet **25 €/mois** (tarifs de lancement, sans
  engagement) ; pas de TVA facturée (franchise en base), donc TTC = HT.
  [VÉRIFIÉ — https://nexartis.fr/tarifs ; DÉDUIT pour le TTC]
- **Métiers** : ~11 revendiqués, « pensé pour tous les artisans ». [VÉRIFIÉ]
- **Quantités** : la home affiche un « **Plan 3D (Beta)** » avec « métré du plan reporté
  dans le devis » — mais il est **absent de la page tarifs**, et la page métier
  plaquiste décrit une **saisie manuelle** (« créez une ligne par pièce avec ses
  dimensions »). Aucun conditionnement, aucune heure MO calculée, aucune source citée.
  [VÉRIFIÉ — https://nexartis.fr, https://nexartis.fr/tarifs,
  https://nexartis.fr/logiciel-devis-plaquiste]
- **Avis** : aucune fiche trouvée nulle part ; le blog de l'éditeur publie ses propres
  « comparatifs » qui le recommandent. Pas de fiche France Num. [NON VÉRIFIÉ / VÉRIFIÉ]
- Homonyme à ne pas confondre : nexartis.com, infrastructure blockchain, sans rapport.

### 2.2 ChantierFlow (chantierflow.com)

- **Identité** : **SIREN introuvable** — mentions légales et CGV se chargent vides
  (rendu JS), « chantierflow » inconnu du registre. Fondateur revendiqué : Clément
  Madinier, développeur solo (fiche Les Pépites Tech du 13/03/2026). Une EI homonyme
  « Clément Madinier » existe au registre sans lien établi.
  [NON VÉRIFIÉ pour le SIREN ; VÉRIFIÉ — https://lespepitestech.com/startup-de-la-french-tech/chantierflow]
- **Prix** : **22,50 € HT/mois (27 € TTC)**, formule unique, sans engagement.
  [VÉRIFIÉ — https://chantierflow.com/faq]
- **Métiers** : ~10 avec pages dédiées. [VÉRIFIÉ]
- **Quantités** : « l'IA génère automatiquement les postes du devis avec fournitures,
  main-d'œuvre, **quantités** et prix estimés » à partir d'une **description en texte
  libre**. Méthode non publiée ; la formulation correspond à une génération par modèle
  de langage, pas à un moteur de métré déterministe. Aucune mention d'ouvertures, de
  pertes, de conditionnements ; aucune source citée.
  [VÉRIFIÉ pour la revendication — https://chantierflow.com/faq ; DÉDUIT pour la nature]
- **Avis** : Capterra et Appvizer à **0 avis** ; un « test indépendant » La Fabrique du
  Net existe (contenu partiellement accessible, pas de note chiffrée relevée). Pas de
  fiche France Num. [VÉRIFIÉ — https://www.capterra.com/p/10037386/ChantierFlow/]

### 2.3 Vox Bati (vox-bati.com)

- **Identité** : Keevin Laidez, **entreprise individuelle**, SIREN 100 652 080, créée le
  **02/02/2026**, NAF 62.01Z, 0 salarié, Aubigny-en-Artois (62), franchise en base de
  TVA. [VÉRIFIÉ — https://www.vox-bati.com/mentions-legales et
  https://annuaire-entreprises.data.gouv.fr/entreprise/100652080]
- **Prix** : **39 €/mois** affiché « TTC » mais TVA non applicable (art. 293 B), donc
  39 € tout court ; 1er mois à 19 € ; sans engagement. [VÉRIFIÉ — https://www.vox-bati.com]
- **Métiers** : 15+, « tous les métiers du bâtiment » ; « 750+ prestations, 4 200
  produits pré-rédigés ». [VÉRIFIÉ]
- **Quantités** : **explicitement manuel** — « vous saisissez vos quantités poste par
  poste, VOX BATI les additionne ». La « liste de matériaux générée par chantier » est
  une agrégation des références saisies, pas un dimensionnement. « VOX IA » est un
  assistant conversationnel (questions techniques, relances), pas un métré. Aucune
  source citée. [VÉRIFIÉ — https://www.vox-bati.com/logiciel-devis-charpentier]
- **Avis** : Capterra à **0 avis** ; rien ailleurs ; pas de fiche France Num.
  [VÉRIFIÉ — https://www.capterra.com/p/10045968/VOX-BATI/]

### 2.4 Costructor (costructor.co)

- **Identité** : **JMJI GROUPE**, SAS, nom commercial Costructor, SIREN 918 895 277,
  créée le **01/09/2022**, NAF 58.29C, Nantes ; 0 salarié enregistré en 2023.
  [VÉRIFIÉ — https://annuaire-entreprises.data.gouv.fr/entreprise/918895277]
- **Prix** (HT, TTC non affiché) : Starter **gratuit** ; Pro **12,50 €/mois** en annuel
  (15 € en mensuel) ; Business+ 25/30 € ; Premium 50/60 €. Pack « Batiprix Data +
  Costructor Pro » : 247,20 € HT/an. [VÉRIFIÉ — https://costructor.co/tarifs/ et
  https://www.batiprix.com/data/465-batiprix-et-costructor-pro.html]
- **Métiers** : 14 listés. [VÉRIFIÉ — https://costructor.co]
- **Quantités** : **pas de calcul automatique revendiqué**. L'artisan saisit la quantité
  d'ouvrage ; les lignes viennent d'une bibliothèque (« 100M+ articles », catalogues
  fournisseurs) et surtout du **partenariat Batiprix** : les ouvrages Batiprix
  fournissent descriptif, prix, **temps de pose** et détail matériaux/MO du débours par
  unité d'ouvrage. C'est un chiffrage par ratios normalisés d'ouvrage, pas un métré
  géométrique. [VÉRIFIÉ — https://costructor.co/logiciel-devis/ ; DÉDUIT pour la méthode]
- **Sources** : **Batiprix** — seule source technique tierce citée de tout le panel avec
  BatiChiffrage. [VÉRIFIÉ]
- **Avis** : la cible secondaire la plus établie — Google 4,9/5 pour ~700 avis (recoupé
  par tool-advisor, MAJ 25/06/2026, et lebonlogiciel, mai 2026) ; Trustpilot 4,1/5 mais
  **5 avis** ; fiche France Num existante. Chiffres d'utilisateurs autodéclarés et
  fluctuants (80 000 → 140 000 → 150 000 selon les sources). [VÉRIFIÉ —
  https://tool-advisor.fr/logiciel-facturation/comparatif/costructor/,
  https://lebonlogiciel.com/organisation-facturation-et-planification-gestion-commerciale-erp-gpao/costructor/avis/2865]

### 2.5 Obat (obat.fr)

- **Identité** : OBAT, SASU, SIREN 852 304 229, créée le **05/07/2019**, Nantes,
  **50 à 99 salariés (2023)** — le plus gros acteur du panel.
  [VÉRIFIÉ — https://www.pappers.fr/entreprise/obat-852304229 et
  https://annuaire-entreprises.data.gouv.fr/entreprise/852304229] Le lien formel
  site/société est déduit (la page mentions légales d'obat.fr renvoie une 404). [DÉDUIT]
- **Prix** (HT ; TTC = ×1,20) : trois grilles selon le profil. Artisan assujetti TVA :
  Pro **49 €/mois** (39 € en annuel), Croissance 79/69 €, Booster 129/109 €.
  Micro-entreprise : Pro 32/25 €, Croissance 52/45 €, Booster 95/85 €. Option
  **BatiChiffrage : 12 €/mois par catalogue**. [VÉRIFIÉ — https://www.obat.fr/tarifs/]
- **Métiers** : tous corps d'état ; bibliothèque « 30 000 ouvrages » avec temps de pose.
  [VÉRIFIÉ — https://www.obat.fr/]
- **Quantités — revendication contredite par sa propre documentation.** La page
  bibliothèques affirme : « le calcul des surfaces et métrés est automatique […] vous
  pourrez calculer la quantité de fournitures nécessaires » — sans aucune capture ni
  démonstration. Mais la page d'aide officielle indique que l'utilisateur doit saisir
  « sa désignation, son unité, **sa quantité**, son prix unitaire HT » — seul le total
  se calcule. Et l'article du blog Obat « Les 8 meilleurs logiciels de métré » **ne cite
  pas Obat** parmi eux. Un « ouvrage » Obat = descriptif + fournitures + temps de MO +
  déboursé sec par unité d'ouvrage, appliqué à des quantités saisies à la main.
  [VÉRIFIÉ — https://www.obat.fr/devis-factures/bibliotheques/,
  https://aide.obat.fr/comment-ajouter-des-%C3%A9l%C3%A9ments-de-fourniture-et-de-main-d%C5%93uvre-%C3%A0-vos-devis-/factures,
  https://www.obat.fr/blog/logiciel-metre/]
- **Sources** : aucune référence DTU/fabricant ; BatiChiffrage en option payante.
  [VÉRIFIÉ]
- **Avis** : Google 4,9/5 pour ~2 650-2 700 avis (autodéclaré, recoupé par
  tool-advisor) ; Trustpilot 4,6/5, 675 avis (de seconde main) ; fiche France Num
  existante. Tool-advisor note un « prix au-dessus de la moyenne du marché ».
  [VÉRIFIÉ — https://tool-advisor.fr/logiciel-facturation/comparatif/obat/]

### 2.6 Mediabat — module « ScanPlan » (mediabat.com)

- **Identité** : MEDIABAT, SARL, SIREN 479 203 655, créée le **01/10/2004** (activité
  revendiquée depuis 1996), Montpellier, **10 à 19 salariés (2023)**.
  [VÉRIFIÉ — https://annuaire-entreprises.data.gouv.fr/entreprise/mediabat-479203655]
  Attention : mediabat.fr est injoignable ; le site actif est **mediabat.com**. [VÉRIFIÉ]
- **Prix** : PRO **37 €/mois** avec engagement ; VIP 67 € ; PRO sans engagement 47 €
  (4 mois min.) ; utilisateur supplémentaire 15 €/mois ; BatiChiffrage en option payante
  (montant non affiché). **La page tarifs ne précise pas HT ou TTC** ; l'hypothèse HT
  (usage B2B) donnerait 44,40 € TTC pour PRO. « Calcul de métrés » inclus dans toutes
  les formules. [VÉRIFIÉ — https://www.mediabat.com/tarifs/ ; DÉDUIT pour le TTC]
- **Métiers** : tous corps d'état BTP (15+ pages métier). [VÉRIFIÉ]
- **Quantités — le seul vrai relevé géométrique du panel, mais qui s'arrête aux
  mesures.** ScanPlan : scanner un plan (ou fichier numérique), « définir l'échelle »,
  « tracer » à la souris → **longueurs, surfaces, volumes**, envoyés automatiquement
  dans les chiffrages. C'est un métré géométrique sur plan — mais ScanPlan **ne produit
  ni quantités de matériaux, ni conditionnements, ni heures de MO** : la conversion
  passe par les bibliothèques de prix classiques (12 000 ouvrages fournis, imports
  fabricants/Tarifeo, BatiChiffrage 36 000+ en option). Déduction d'ouvertures, facteurs
  de perte, tout cela n'est documenté nulle part.
  [VÉRIFIÉ — https://www.mediabat.com/fonctionnalites/logiciel-metre-scanplan/ ;
  DÉDUIT pour la qualification géométrique]
- **Démonstrations** : nombreuses et récentes — playlist YouTube « Scanplan » avec
  webinaire du 11/02/2025 et tutoriels métier de juillet 2024 (peintres/plaquistes,
  carreleurs). Module réellement en production, pas une fonction vitrine.
  [VÉRIFIÉ pour l'existence et les titres ; contenu non visionnable ; DÉDUIT]
- **Avis** : Appvizer **0 avis** ; Google 4,1/5, 85 avis (de seconde main via
  independant.io) ; fiche France Num existante. [VÉRIFIÉ]

### 2.7 JLogiciels — « Pack Métré Artisan » (jlogiciels.fr)

- **Identité** : JLOGICIELS, SAS au capital de 40 500 €, SIREN 480 181 957, créée le
  **03/01/2005**, Colomiers (31), **10 à 19 salariés (2023)**, dirigeant Jean-Luc
  Delrieu. [VÉRIFIÉ — https://www.jlogiciels.fr/mentions-legales et
  https://annuaire-entreprises.data.gouv.fr/entreprise/480181957]
- **Prix** : abonnement **22 € HT/mois (26,40 € TTC)**, remise 12 % en annuel ; pas de
  licence perpétuelle affichée ; options : initialisation 460 € HT, reprise de données
  550 € HT. [VÉRIFIÉ — https://www.jlogiciels.fr/logiciel-metre-artisan-licence]
- **Métiers** : packs par métier (Artisan tous corps d'état, Maçon, Plaquiste,
  Carreleur, Charpentier-Couvreur, Maître d'Œuvre, Négoce Matériaux). [VÉRIFIÉ]
- **Quantités — la revendication la plus complète du panel, la moins démontrée.** Seul
  acteur à revendiquer explicitement la chaîne **plan importé → tracé → « quantifier
  automatiquement les matériaux »** (« Importer un plan », « Tracer des fondations,
  murs, cloisons », « Calculer surfaces, longueurs, volumes à la souris », « quantifier
  automatiquement les matériaux ou les ouvrages de votre devis »), adossé aux
  bibliothèques BatiChiffrage et à des références négoce (Leroy Merlin, BIGMAT, GEDIMAT
  — revendiquées, non recoupées).
  [VÉRIFIÉ — https://www.jlogiciels.fr/logiciel-metre-artisan] Mais : **aucune capture
  d'écran de résultat sur les 4 pages produit consultées, aucune vidéo intégrée**, une
  démo YouTube qui daterait de 2015, et rien sur les conditionnements, les pertes, la
  déduction d'ouvertures, les heures de MO ou la nature exacte des sorties. [VÉRIFIÉ
  pour l'absence ; NON VÉRIFIÉ pour le contenu réel du produit]
- **Avis** : Trustpilot **1 avis** ; lebonlogiciel 4,30/5 (10 avis) ;
  comparatif-logiciels 4,1/5 ; « interface datée » relevée par outilios (qui commet au
  passage une confusion en lui attribuant ScanPlan, fonction Mediabat). Pas de fiche
  France Num. [VÉRIFIÉ]

---

## 3. Ce qui n'a pas pu être vérifié

1. **Historique des sites** — web.archive.org inaccessible depuis l'outillage : aucune
   comparaison de versions antérieures.
2. **Notes Trustpilot en direct** (Tactidevis, Nexartis, Obat, Costructor, JLogiciels) —
   HTTP 403 systématique ; chiffres cités de seconde main.
3. **Contenu des fiches France Num** — pages rendues vides hors navigateur ; existence
   vérifiée, contenu par extraits seulement.
4. **Contenu des vidéos de démonstration** (Mediabat, JLogiciels, Obat) — les sorties
   réelles des modules de métré n'ont jamais été observées ; seuls titres et dates.
5. **SIREN de ChantierFlow** — introuvable au registre comme sur le site.
6. **Avis Google/Pages Jaunes revendiqués par ArtisanSmart** — retrouvés sur aucune
   plateforme.
7. **Partenariat CAPEB départemental éventuel de Tactidevis** — guide PDF des offres
   partenaires (> 10 Mo) non lu ; l'absence au niveau national, elle, est vérifiée.
8. **HT ou TTC des tarifs Mediabat** — non précisé sur la page officielle.
9. **Rattachement juridique exact d'obat.fr à la SASU OBAT** — mentions légales en 404 ;
   concordance forte mais formellement déduite.
10. **Ce que produit réellement chaque « moteur » en usage** — toute cette note repose
    sur la documentation publique ; aucun essai produit n'a été réalisé. Un essai
    gratuit d'ArtisanSmart, Obat, Mediabat et JLogiciels serait l'étape suivante logique.
11. **Tolteck** — hors du panel de cette note, donc **aucun de ses chiffres n'a été
    vérifié selon la méthode ci-dessus**. Les montants qui servent de repère tarifaire
    ailleurs dans le dépôt (25 € HT/mois sans engagement, 19 € HT en annuel, 12,35 € HT
    en annuel pour une entreprise de moins de cinq ans, tous corps d'état) sont
    consignés en [ADR 0002 §1.3](adr/0002-modele-economique-facturation-distribution.md)
    **avec leur réserve de contre-vérification**. Ils ne doivent pas être traités comme
    [VÉRIFIÉ] tant que les pages publiques de Tolteck n'ont pas été lues à la source.
    Même réserve pour l'affirmation « 30 000 clients construits par la distribution en
    négoce », qui fonde la décision D6 du même ADR.

---

## 4. Tableau comparatif face à Chiffréo — huit axes

« n.d. » = non documenté publiquement. Pour les concurrents, un « Non » signifie que la
documentation publique montre l'absence ; « n.d. » qu'elle ne dit rien.

| Acteur | Surface nette calculée | Pièces non rectangulaires | Déduction des ouvertures | Perte par pose et par niveau | Conditionnement commercial | Sources citées | Heures de main-d'œuvre | Métiers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ArtisanSmart | Non — ratios sur surfaces brutes¹ | n.d. | Revendiquée (page peintre seule), non démontrée | Non — exemples publiés sans aucune perte | Non — unités techniques (u, ml, m³, L) | DTU en vitrine ; ratios non sourcés | Oui (exemples publiés) | 15 |
| Tactidevis | Non — quantités saisies | n.d. | n.d. | n.d. | Non | Aucune | Non (coût MO global, pas d'heures) | 10 |
| Nexartis | Non — saisie par pièce² | n.d. | n.d. | n.d. | Non | Aucune | Non | ~11 (« tous ») |
| ChantierFlow | Non — « estimation » par IA, méthode non publiée | n.d. | n.d. | n.d. | Non | Aucune | Oui (« estimées » par IA) | ~10 |
| Vox Bati | Non — saisie manuelle explicite | n.d. | n.d. | n.d. | Non | Aucune | Non | 15+ (« tous ») |
| Costructor | Non — quantité d'ouvrage saisie | n.d. | n.d. | n.d. | Non | **Batiprix** (débours par ouvrage) | Oui (temps de pose Batiprix) | 14 |
| Obat | Revendiquée, contredite par sa propre aide | n.d. | n.d. | n.d. | Non | BatiChiffrage (option 12 €/mois) | Oui (temps de pose des ouvrages) | Tous corps d'état |
| Mediabat (ScanPlan) | Mesures sur plan (surfaces, longueurs, volumes) — pas de quantités | Oui — tracé libre sur plan | n.d. | n.d. | n.d. | BatiChiffrage (option) | Non (via bibliothèques de prix) | Tous corps d'état |
| JLogiciels (Pack Métré) | Revendiquée (plan → matériaux), jamais montrée | Oui — tracé sur plan, non démontré | n.d. | n.d. | n.d. | BatiChiffrage | n.d. | Tous corps d'état (packs) |
| **Chiffréo** | **Oui** — murs : périmètre × hauteur − ouvertures ; brute exposée³ | **Partiel** — formes rectilignes (union de rectangles, max 10) ; pas de pans coupés⁴ | **Oui** — intégrale, mais sans seuil (aucune règle type DTU)⁵ | **Oui** — 9 triplets pose × niveau de l'artisan ; pas de notion d'étage⁶ | **Oui** — achat panaché multi-formats, mutualisé multi-pièces⁷ | **Oui** — registre public de 35 matériaux sourcés fabricant, testé en CI ; pertes et temps MO non sourcés⁸ | **Partiel** — proposition de devis (min/m² par ouvrage) ; temps non sourcés⁹ | **5** (7 ouvrages de finition)¹⁰ |

Notes sur la colonne Chiffréo — l'honnêteté du tableau vaut dans les deux sens :

1. ArtisanSmart : 7,5 m³ = 50 × 0,15 exactement ; 960 tuiles = 80 × 12 — multiplications
   brutes, zéro perte [DÉDUIT des exemples publiés].
2. Nexartis affiche un « Plan 3D (Beta) » sur sa home, absent de l'offre tarifaire et
   contredit par ses pages métier.
3. `estimation-engine.ts:329-343` ; sol/plafond : aire de l'union sans déduction
   d'ouvertures (une porte ne retire pas de sol).
4. `room-geometry.ts` ; testé sur pièce en L (`l-shaped-room.spec.ts`). Défaut connexe
   relevé : un décroché sur le mur gauche ou bas produit des coordonnées négatives
   rejetées par le DTO (non couvert par les tests).
5. Toute ouverture est déduite intégralement, quelle que soit sa taille — aucun seuil de
   non-déduction, aucun retour de tableau.
6. « Niveau » = niveau de compétence de l'artisan (débutant/intermédiaire/expert), pas
   l'étage du bâtiment. Poses modélisées : standard, droite, diagonale, uni, à motif —
   pas de chevrons ni bâtons rompus ; question de pose exposée pour le seul carrelage sol.
7. `selectBestPackaging` + `aggregatePurchases` : « 1 × Pot 5 L + 1 × Pot 2,5 L » ;
   le critère de coût est un proxy (pas de prix au catalogue).
8. `docs/SOURCES_CATALOGUE.md` + `sources-catalogue.spec.ts` (le registre est un contrat
   exécutable). Les facteurs de perte sont des « valeurs d'usage métier, sans référence
   normative » ; l'appellation « catalogue DTU » a été volontairement retirée.
9. `labor_minutes_per_m2` par ouvrage → `GET /quotes/labor-proposal` ; un seul temps par
   ouvrage, sans modulation par niveau ni pose ; taux horaire à 0 € si profil non rempli.
10. Peintre, carreleur, solier-parqueteur, plaquiste, poseur de revêtements muraux.
    **Défaut majeur connu et non corrigé** : une cloison à créer est chiffrée comme
    l'habillage des quatre murs de la pièce (25 plaques au lieu de ~7) — test rouge
    volontaire à HEAD (`drywall-created-partition.spec.ts`), liens d'achat bloqués en
    conséquence.

---

## 5. Positionnement de Chiffréo

### 5.1 Phrase défendable

> **Chiffréo calcule les quantités de façon géométrique et traçable de bout en bout :
> surface nette calculée depuis la pièce avec déduction des ouvertures, rendements
> adossés fiche par fiche à des sources fabricants publiées et testées, facteur de perte
> selon la pose et le niveau de l'artisan, et résultat rendu en conditionnements
> commerciaux panachés. Parmi les neuf offres françaises étudiées, aucune ne documente
> cette chaîne de bout en bout : les ratios y sont appliqués de façon opaque à des
> quantités saisies à la main, ou le produit s'arrête à la mesure de surfaces sur un
> plan.**

Conditions de défendabilité, à respecter dans toute communication :

- **ne pas dire « le seul » ni « la seule »**, même borné à un panel. Le superlatif est
  invérifiable par le lecteur, il vieillit au premier concurrent qui bouge, et il
  transforme une constatation d'absence — « aucune des neuf offres étudiées ne le
  documente » — en affirmation d'unicité que nous aurions à prouver. Dire ce que le
  produit fait, puis ce que la veille a constaté chez les autres ;
- dire « parmi les offres étudiées » ou « à notre connaissance » — le panel est de neuf
  acteurs, sur documentation publique, à date d'août 2026 ;
- ne pas l'étendre à la justesse générale tant que le défaut d'assiette cloison sèche
  n'est pas corrigé ;
- ne jamais présenter le résultat comme une quantité exacte : c'est une base de commande
  que l'artisan valide (cf. `docs/PROMESSE_PRODUIT.md`) ;
- l'affirmation sur les sources ne vaut que pour les **rendements matériaux** — pas pour
  les facteurs de perte ni les temps de main-d'œuvre, non sourcés à ce jour.

### 5.2 Affirmations commerciales que Chiffréo ne peut PLUS faire sans mentir

1. **« Le seul outil qui calcule les quantités de matériaux »** — faux. ArtisanSmart
   publie des listes de matériaux chiffrées avec heures de MO ; ChantierFlow génère des
   quantités par IA ; JLogiciels revendique la chaîne plan → matériaux depuis des
   années ; Obat le revendique aussi (même contredit par sa propre aide, la revendication
   publique existe).
2. **« Le seul à faire du métré »** ou **« du métré géométrique »** — faux. Mediabat
   ScanPlan et JLogiciels font du relevé géométrique sur plan importé — chose que
   Chiffréo, qui part de dimensions saisies et non d'un plan, ne fait pas.
3. **« Le seul à déduire les ouvertures »** — risqué. ArtisanSmart le revendique
   publiquement (page peintre : « murs + plafonds − ouvertures »). Version défendable,
   sans superlatif : « la déduction est documentée et démontrée ouverture par ouverture
   dans le détail du calcul ».
4. **« Le seul à chiffrer la main-d'œuvre »** — faux. Les 30 000 ouvrages Obat incluent
   des temps de pose, Costructor embarque les débours Batiprix (temps compris),
   ArtisanSmart affiche des heures dans ses exemples.
5. **« Le seul adossé à des sources professionnelles »** — faux tel quel. Quatre
   concurrents s'adossent à Batiprix ou BatiChiffrage, bibliothèques établies. Version
   défendable, sans superlatif : « la source fabricant de chaque rendement est publiée
   et vérifiée automatiquement ».
6. **« Des ratios conformes aux DTU »** — interdit. L'appellation « catalogue DTU » a
   été retirée du produit précisément parce que les facteurs de perte sont des valeurs
   d'usage sans référence normative, et le moteur n'applique aucun seuil DTU de
   déduction d'ouvertures. C'est d'ailleurs l'argument-vitrine d'ArtisanSmart — ne pas
   reproduire ce travers.
7. **Toute promesse de justesse générale** (« des quantités justes pour tous vos
   travaux ») — interdit tant que le défaut cloison sèche (25 plaques au lieu de ~7,
   test rouge à HEAD, liens d'achat bloqués) n'est pas corrigé.
8. **Toute comparaison favorable en largeur de couverture** (« pour tous les artisans »,
   « tous les métiers ») — faux. 5 corps d'état de finition contre 10 (Tactidevis),
   14-15 (Costructor, ArtisanSmart) et « tous corps d'état » (Obat, Mediabat,
   JLogiciels). La largeur est le point faible objectif de Chiffréo ; sa profondeur sur
   chaque ouvrage couvert est son point fort démontrable.
9. **Toute promesse d'exactitude du calcul** (« la quantité exacte », « des quantités
   exactes », « une estimation précise ») — interdit, et vérifié par un test. Le
   vocabulaire admis et la raison juridique de cette interdiction sont dans
   `docs/PROMESSE_PRODUIT.md`.
10. **Tout superlatif d'unicité**, y compris borné au panel (« le seul à… », « la seule
    dont… »). Voir la première condition de défendabilité du §5.1.
