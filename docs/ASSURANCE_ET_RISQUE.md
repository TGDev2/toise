# Assurance et risque — Chiffréo

> Note d'évaluation, août 2026. Chiffréo est un éditeur de logiciel indépendant
> (CA < 50 000 €/an) qui produit des quantitatifs de matériaux du bâtiment.
> Risque principal : un quantitatif faux fait échouer ou retarder un chantier —
> préjudice purement économique pour l'artisan ou son client final.
> Ce document chiffre la RC Professionnelle nécessaire pour porter ce risque.
> Il n'a pas valeur de conseil juridique ni de conseil en assurance.
>
> Convention de lecture : chaque affirmation est marquée **[sourcé]** (URL
> vérifiée le 07/08/2026) ou **[estimé]** (déduction, raisonnement explicite).
> Ne rien décider sur un [estimé] seul.

---

## 1. Nature du risque : contractuel, pas délictuel

La qualification a été vérifiée sur le texte de la directive (UE) 2024/2853 sur
la responsabilité du fait des produits défectueux
([EUR-Lex](https://eur-lex.europa.eu/eli/dir/2024/2853/oj),
[version FR](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024L2853)) **[sourcé]** :

- **Le logiciel est un produit** : art. 4, point 1 (« produit » comprend les
  logiciels), considérant 13 dédié (y compris IA, quel que soit le mode de
  fourniture).
- **Mais le dommage type de Chiffréo n'est pas indemnisable dans ce régime** :
  l'art. 6 §1 limite les dommages couverts à (a) mort et lésions corporelles,
  (b) dommages aux biens *à l'exclusion* des « biens utilisés exclusivement à
  des fins professionnelles », (c) destruction de données *non utilisées à des
  fins professionnelles*. Le considérant 24 est explicite : « les pertes
  purement économiques […] ne devraient pas, par elles-mêmes, déclencher une
  responsabilité ».
- **Calendrier** : régime applicable aux produits mis sur le marché après le
  9 décembre 2026 (art. 2 §1) ; transposition française exigée au plus tard le
  9 décembre 2026 (art. 22). État au 07/08/2026 : aucun projet de loi déposé ;
  dernière position officielle, réponse ministérielle du 12/05/2026 à la
  question écrite AN n° 17-11448 — « un texte dédié est envisagé »
  ([questions.assemblee-nationale.fr](https://questions.assemblee-nationale.fr/q17/17-11448QE.htm)).

**Conclusion — la prémisse est confirmée, doublement** : la rupture de chantier
est une perte économique pure (hors art. 6), et même un dommage matériel chez
l'artisan tomberait sous l'exclusion des biens à usage exclusivement
professionnel. Le risque à assurer est donc **contractuel** : c'est la RC Pro,
et précisément sa garantie **dommages immatériels non consécutifs (DINC)**, qui
le porte.

Deux réserves **[estimé]** :

1. Si un quantitatif faux causait un dommage **matériel au logement d'un
   particulier** (bien à usage privé), le régime produit pourrait jouer — cas
   marginal tant que la cible est l'artisan, à réévaluer si le B2C revient.
2. La CJUE (aff. *Moteurs Leroy Somer*, C-285/08) laisse les États libres
   d'indemniser les biens professionnels par des régimes nationaux : le texte
   français de transposition est à surveiller d'ici décembre 2026.

---

## 2. La garantie qui compte : les DINC

Deux lignes de garantie cohabitent dans les contrats, souvent packagées :

| Ligne | Couvre | Pertinence Chiffréo |
|---|---|---|
| **RC Exploitation** | Dommages corporels/matériels causés aux tiers dans la vie courante de l'entreprise | Quasi nulle (pas de locaux recevant du public, pas d'intervention physique) |
| **RC Professionnelle** | La faute, l'erreur ou l'omission dans la prestation intellectuelle — dont le **préjudice financier pur** du client (DINC) | **C'est la seule qui joue** pour « quantitatif faux → chantier retardé » |

Le critère de choix n° 1 d'un contrat est donc que les DINC soient couverts
**explicitement**, avec leur plafond propre. Assurup avertit que « la prise en
charge de ce risque par une RC Pro n'est pas automatique » et que certaines
polices l'excluent en tout ou partie
([assurup.com](https://www.assurup.com/blog/articles/rc-pro-prejudice-financier)) **[sourcé]**.

---

## 3. Offres du marché **[sourcé]**

| Acteur | Type | Offre logiciel/IT | DINC | Souscription | Prix indicatif publié |
|---|---|---|---|---|---|
| [Hiscox](https://www.hiscox.fr/courtage/toutes-assurances-hiscox/responsabilite-civile-professionnelle) | Assureur | « RC Pro métiers de l'informatique » — IPID consultés via tiers ([01/19](https://www.neo-dpo.fr/wp-content/uploads/2021/03/IPID_TECH_DIRECT_0119.pdf), [TECH0623](https://imentreprises.fr/ime/services-en-ligne/doc/IPID/IPID_HISCOX_TEC.pdf)) | **Couverts par construction** (« erreurs, fautes ou omissions ») + garantie PI de série | En ligne (TPE) ou courtier | 175 €/an « à partir de » ([Coover](https://www.coover.fr/responsabilite-civile-pro/assureurs/hiscox)) ; 455 €/an pour 100 k€ de garantie ([Sidecare](https://www.sidecare.com/responsabilite-civile-professionnelle/hiscox-assurances-rc-pro-informatique-2)) |
| [Orus](https://www.orus.eu/assurance-rc-pro/informatique) | Assurtech | RC Pro informatique | **Couverts** (exemples publiés : erreur de code, préjudice financier du client) | En ligne, 3 min | Dès 16 €/mois ; dev CA 20 k€ ≈ 16 €/mois |
| [Coover](https://www.coover.fr/responsabilite-civile-pro/metiers/informatique) | Courtier (porte Hiscox) | RC Pro informatique | Selon assureur porteur | En ligne | Consultant 180 €/an, ESN 225 €/an |
| [Assurup](https://www.assurup.com/activities/edition-logiciels-mode-saas) | Courtier (30+ assureurs) | Page dédiée **« Édition de logiciels en mode SaaS »** | Oui, mais avertit que ce n'est pas automatique — à exiger au contrat | En ligne, 3 min | Dès 9 €/mois (RC Pro générale) |
| [Simplis](https://www.simplis.fr/assurance-professionnelle/technologie-informatique) | Courtier | Gamme « Technologie & informatique » (éditeur non listé explicitement) | Non précisé formellement | En ligne | Dès 9,99 €/mois |
| [Stello](https://www.stello.eu/rc-pro) | Courtier | Métiers informatique | Non précisé formellement | En ligne | Dev CA 50 k€ ≈ 17 €/mois |
| [Wemind](https://www.wemind.io/rcpro) | Courtier | RC Pro indépendants, spécificités IT | Préjudice client couvert jusqu'à 500 k€/an | En ligne | 17,92 €/mois |
| [Onlynnov](https://onlynnov.com/assurance-editeur-de-logiciel/) | Courtier spécialiste IT | Page dédiée **« éditeur de logiciel »** | Objet du produit (erreurs, négligences) | Simulateur + devis | Dès 20 €/mois ; simulations publiées à partir de 42,78 €/mois (CA 300–400 k€) |
| [AXA](https://www.axa.fr/pro/responsabilite-civile-professionnelle/rc-entreprise.html) | Assureur | RC entreprise, exemple cité « erreur dans l'adaptation d'un logiciel » | Non précisé | Conseiller | Non public |
| [MMA](https://entreprise.mma.fr/votre-activite/assurance-materiel-informatique.html) | Assureur | RC Pro par activité | Non confirmé sur page officielle | Agent | 150–322 €/an ([Pappers](https://services.pappers.fr/blog/assurances/rc-pro/mma)) |
| [+Simple](https://www.plussimple.com/fr/assurances/rcpro-metiers-informatique-digital/) | Courtier grossiste | RC Pro informatique et digital | Objet du contrat ; sans franchise jusqu'à 1 M€ | En ligne jusqu'à 1 M€ | Non public |
| Allianz | Assureur | Site en 403, non vérifié à la source | Non vérifié | Agent | Non public |

Écartés : Luko/Allianz Direct (pas d'offre RC Pro), Olino (pas d'offre
spécifique éditeur, tarif au devis).

**Les deux seuls acteurs affichant une page dédiée « éditeur de logiciel/SaaS »
sont Assurup et Onlynnov** ; Hiscox et Orus couvrent l'activité sous le
libellé « métiers de l'informatique ».

---

## 4. Fourchette de prime pour un CA < 50 k€

### Points de prix publics **[sourcé]**

| Source | Profil | Prix |
|---|---|---|
| [Orus](https://www.orus.eu/assurance-rc-pro/informatique) | Dev freelance, CA 20 k€ | ≈ 16 €/mois (~192 €/an) — exemple constaté |
| [Stello](https://www.stello.eu/articles/rc-pro-du-freelance-informatique) | Développeur, CA 50 k€ | ≈ 17 €/mois (~204 €/an) |
| [Wemind](https://www.wemind.io/rcpro) | Indépendant | 17,92 €/mois (215 €/an) — prix affiché |
| [Coover](https://www.coover.fr/responsabilite-civile-pro/metiers/informatique) | Consultant informatique | 180–250 €/an — constaté |
| [Sidecare](https://www.sidecare.com/responsabilite-civile-professionnelle/hiscox-assurances-rc-pro-informatique-2) | Hiscox informatique, garantie 100 k€ | Dès 455 €/an, franchise mini 500 € |
| [Philtr](https://philtr.fr/responsabilite-civile-professionnelle/assureur/hiscox) | Hiscox, toutes activités | 300–2 000 €/an — constaté |
| [Orus blog](https://www.orus.eu/blog-orus/rc-pro-auto-entrepreneur-tarif) | Indépendant, moyenne | 250–300 €/an |

Les « à partir de 9–20 €/mois » (Simplis, Assurup, Onlynnov) sont des prix
d'appel pour les plus petits CA avec plafonds bas — pas des prix constatés.

### Fourchette retenue **[estimé]**

Pour Chiffréo — éditeur SaaS, CA < 50 k€, garantie DINC explicite d'au moins
100 k€ :

- **Fourchette de travail : 180 à 455 €/an** (15 à 38 €/mois).
- **Point central vraisemblable : 250–350 €/an**, l'activité « éditeur diffusé »
  étant souvent tarifée au-dessus de la prestation au forfait, et la garantie
  DINC sérieuse tirant vers le haut de la fourchette (le plancher Hiscox à
  455 €/an pour 100 k€ de garantie est le meilleur proxy d'un contrat réellement
  adapté).
- Rapporté au modèle (palier Conformité à **279 €/an**,
  [ADR 0002 §D4](adr/0002-modele-economique-facturation-distribution.md)) : la
  prime annuelle équivaut au revenu brut de **moins d'un à deux clients** — ce
  n'est pas un facteur de viabilité, c'est un coût fixe à provisionner dès la
  première vente.
- **Le chiffrage étant désormais gratuit et ouvert à tous, l'exposition
  s'élargit sans que le revenu suive.** Une erreur de quantité peut atteindre
  un utilisateur qui n'a jamais rien payé, et la responsabilité de l'éditeur
  ne se limite pas à ses clients. La garantie doit couvrir les dommages
  immatériels non consécutifs sans clause restreignant l'indemnisation aux
  seuls utilisateurs sous contrat — **point à vérifier explicitement dans les
  conditions particulières.**

---

## 5. Plafonds et franchises usuels

**[sourcé]** sauf mention contraire :

- **Plafonds** : 100 k€ à 1,5 M€/an pour un petit éditeur
  ([+Simple](https://www.plussimple.com/fr/assurances/rcpro-metiers-informatique-digital/) :
  RC Pro 100 k€–1,5 M€ ; [Wemind](https://www.wemind.io/rcpro) : faute pro
  500 k€/an ; Hiscox affiche jusqu'à 30 M€ en haut de gamme, IPID précités).
  Règle de place : plafond ≥ CA annuel, minimum 100 k€
  ([Coover](https://www.coover.fr/responsabilite-civile-pro/metiers/informatique)).
- **Franchises** : de 0 € (+Simple jusqu'à 1 M€ ; Hiscox hors exceptions selon
  [Philtr](https://philtr.fr/responsabilite-civile-professionnelle/assureur/hiscox))
  à 500 € (plancher Hiscox informatique via Sidecare). Le chiffre « DINC
  500 k€ / franchise 1 500 € » circule chez des comparateurs mais n'a pas été
  retrouvé dans un document Hiscox — seconde main, à confirmer sur devis.
- **Dimensionnement Chiffréo [estimé]** : un plafond DINC de **100 à 300 k€**
  couvre plusieurs fois le pire scénario réaliste (surcoût matériaux + retard
  sur un chantier de rénovation TPE, typiquement < 30 k€). Inutile de payer
  pour 1 M€ en V1.

---

## 6. Exclusions typiques **[sourcé]**

Relevées dans les IPID Hiscox ([01/19](https://www.neo-dpo.fr/wp-content/uploads/2021/03/IPID_TECH_DIRECT_0119.pdf),
[TECH0623](https://imentreprises.fr/ime/services-en-ligne/doc/IPID/IPID_HISCOX_TEC.pdf)),
la [FAQ Stello](https://www.stello.eu/faq/quelles-sont-les-exclusions-de-la-rc-pro)
et [Assurup](https://www.assurup.com/blog/articles/rc-pro-non-respect-delais-legaux) :

| Exclusion | Incidence pour Chiffréo |
|---|---|
| Faute intentionnelle ou dolosive (art. L113-1 c. assur.) | Standard, ordre public |
| Amendes et sanctions pécuniaires | Standard |
| Pénalités contractuelles | **Attention aux CGV** : ne jamais promettre contractuellement une exactitude chiffrée assortie de pénalités — elles ne seraient pas assurées (nuance : Hiscox prend en charge les « pénalités contractuelles libératoires ») |
| Retard contractuel pur / délibéré | Couvert seulement si le retard découle d'une faute non intentionnelle |
| « Passé connu » / vice connu avant souscription | **Un défaut de calcul connu et non corrigé ferait tomber la garantie** — cf. le test rouge documenté dans `tasks/todo.md` (assiette drywall) : à corriger avant souscription, ou à déclarer |
| Engagements disproportionnés / promesse de résultat | Les CGV doivent qualifier le quantitatif d'**estimation à valider par l'artisan**, jamais de résultat garanti |
| Brevets et secrets de fabrique (limité aux É.-U. dans TECH0623) | Sans objet ; la PI droit d'auteur/bases de données reste couverte |
| Cyber / faille de sécurité | Extension séparée (Hiscox Cyberclear, module Orus) — hors sujet ici |
| Perte de données sans procédure de sauvegarde | Pertinent pour un SaaS : les sauvegardes documentées dans `docs/deploy/BACKUP.md` sont aussi une condition assurantielle |

---

## 7. Citer des fiches fabricants change-t-il la couverture ?

**Présomption de départ : non. Verdict : confirmée pour la garantie erreur de
calcul, mais incomplète.**

1. **Aucune clause conditionnant la garantie à l'origine des données** n'a été
   trouvée dans les documents publics consultés (IPID Hiscox, pages Orus,
   Assurup, +Simple, Stello) **[sourcé, par absence]**. La garantie DINC se
   déclenche sur la faute non intentionnelle de l'assuré, quelle que soit la
   matière première du calcul
   ([Assurup](https://www.assurup.com/blog/articles/rc-pro-erreur-de-programmation)).
   Réserve : les IPID sont des résumés — l'absence de clause est à re-vérifier
   dans les conditions générales complètes du contrat retenu.
2. **La diligence de vérification des sources reste exigée** : le cas analogue
   le plus proche (erreur issue d'une source externe,
   [FAQ Simplis sur le conseil généré par IA](https://www.simplis.fr/assurances/rc-pro/ma-rc-pro-me-couvre-t-elle-si-je-donne-un-mauvais-conseil-genere-par-une-ia-chatgpt-claude-gemini-a-mon-client))
   confirme que l'erreur est couverte quelle que soit son origine, mais que le
   professionnel reste seul responsable de son livrable. Le registre
   [`docs/SOURCES_CATALOGUE.md`](SOURCES_CATALOGUE.md) — chaque rendement V1
   vérifié contre une fiche fabricant réelle, avec URL et date — est exactement
   la preuve de diligence attendue **[estimé quant à sa portée assurantielle]**.
3. **En revanche, la reproduction des données crée une exposition distincte :
   la propriété intellectuelle.** L'extraction substantielle de données
   techniques structurées peut relever du droit *sui generis* des bases de
   données ([APP](https://www.app.asso.fr/centre-information/base-de-connaissances/code-bases-de-donnees/la-protection-du-contenu-par-le-droit-sui-generis/description-des-droits-sui-generis),
   [Ledieu-Avocats](https://ledieu-avocats.fr/protection-juridique-contenu-des-bases-de-donnees/))
   **[sourcé]**. Ce risque est assurable et couvert de série chez Hiscox
   (« atteinte aux droits de propriété intellectuelle », IPID précités), mais
   Assurup avertit que certaines polices excluent tout ou partie de la PI : la
   garantie PI explicite devient le **critère de choix n° 2** du contrat.
4. **Déclarer l'activité avec précision** conditionne la validité de la
   garantie (IPID Hiscox, obligations du souscripteur, sous peine de nullité) :
   la formule à employer au devis est « édition d'un logiciel SaaS de calcul de
   quantitatifs de matériaux du bâtiment, s'appuyant sur des données techniques
   publiées par les fabricants ».

---

## 8. Trois actions pour obtenir le chiffre ferme

1. **Passer trois simulateurs en ligne avec la déclaration d'activité exacte**
   (formule du §7.4, CA déclaré < 50 k€) : [Orus](https://www.orus.eu/assurance-rc-pro/informatique),
   [Coover](https://www.coover.fr/responsabilite-civile-pro/metiers/informatique)
   (porte Hiscox) et [Assurup](https://www.assurup.com/activities/edition-logiciels-mode-saas)
   (page « édition de logiciels en mode SaaS »). Livrable : trois devis écrits
   mentionnant chacun le plafond DINC, le plafond PI et la franchise — pas les
   prix d'appel.
2. **Obtenir les conditions générales complètes** (pas l'IPID) du meilleur
   devis et y vérifier quatre points : DINC explicites couvrant l'erreur de
   calcul et de données ; garantie PI incluant le droit des bases de données ;
   absence de clause sur l'usage de données tierces ; périmètre exact des
   exclusions de pénalités. Les IPID Hiscox publics datent de 2019 et 2023 —
   exiger la version en vigueur.
3. **Faire confirmer par écrit, avant signature**, que l'activité déclarée
   (« quantitatifs s'appuyant sur des fiches techniques de fabricants ») est
   bien celle enregistrée au contrat, et que le scénario type « quantitatif
   erroné → surcoût et retard de chantier chez le client de l'utilisateur »
   entre dans la garantie DINC. Un courriel de l'assureur ou du courtier suffit
   et fait preuve.

Préalable interne avant souscription : corriger le défaut d'assiette `drywall`
documenté dans `tasks/todo.md` — un vice connu non corrigé au jour de la
souscription tombe sous l'exclusion « passé connu » (§6).
