# Conformité de la facturation — Chiffréo

> Évaluation préalable à BACKLOG PRO-4 (« Devis → facture »), août 2026.
> Ce document fixe ce que le produit couvre, ce qu'il ne couvre pas, et pourquoi.
> Il n'a pas valeur de conseil juridique : les artisans utilisateurs restent
> responsables du contenu de leurs factures.

---

## 1. Réforme de la facturation électronique : ce qui s'applique, et à qui

| Échéance | Obligation | Concernés |
|---|---|---|
| **1er septembre 2026** | **Réception** de factures électroniques | Toutes les entreprises assujetties à la TVA |
| **1er septembre 2026** | **Émission** + e-reporting | Grandes entreprises et ETI |
| **1er septembre 2027** | **Émission** + e-reporting | PME, TPE, micro-entreprises |

**Conséquence pour Chiffréo.** La cible du produit — artisans TPE, micro-entrepreneurs,
petites entreprises du bâtiment — relève de l'échéance **septembre 2027**, pas 2026.
L'obligation de *réception* de septembre 2026 pèse sur l'entreprise de l'artisan, via
la plateforme qu'il aura choisie ; ce n'est pas une obligation que Chiffréo porte,
puisque le produit n'est pas la boîte aux lettres fiscale de l'artisan.

### Le rôle des plateformes agréées (PA)

Depuis la révision d'octobre 2024, le Portail Public de Facturation (PPF) ne fournit
plus de solution mutualisée gratuite d'émission/réception : il se limite à l'annuaire
et à la concentration des données. **Toute facture électronique B2B doit transiter par
une Plateforme Agréée (PA, anciennement PDP), agréée par la DGFiP.**

Chiffréo n'est pas une PA. Le devenir suppose un agrément DGFiP, un audit, un
raccordement à l'annuaire et la gestion des cycles de vie de facture — un projet
réglementé pluriannuel, sans rapport avec l'effort d'un lot de backlog. La voie
réaliste, le moment venu, est le statut d'**opérateur de dématérialisation (OD)
raccordé à une PA tierce**, ou l'export d'un fichier que l'artisan dépose lui-même
dans sa PA.

### Formats du socle

Le socle minimal repose sur la norme sémantique européenne **EN 16931**, décliné en
trois syntaxes : **Factur-X** (hybride : PDF/A-3 lisible + XML CII embarqué),
**UBL 2.1** et **CII**. Factur-X est le format naturel pour une TPE, puisqu'il reste
un PDF à l'œil.

### E-reporting

La clientèle d'un artisan est majoritairement composée de **particuliers (B2C)**. Ces
opérations ne relèvent pas de la facturation électronique mais de l'**e-reporting** :
transmission périodique à l'administration des données de transaction et de paiement.
L'e-reporting passe lui aussi par une PA.

---

## 2. Décision de périmètre pour PRO-4

**Ce qui est livré :** une facture PDF conforme au droit français en vigueur —
mentions obligatoires complètes (y compris les quatre nouvelles de 2026),
numérotation continue et inaltérable, document immuable et archivable.

**Ce qui n'est pas livré, et pourquoi :**

| Écarté | Raison |
|---|---|
| Sérialisation Factur-X / XML CII | Échéance TPE en septembre 2027 ; inutile sans PA pour transmettre. PDFKit ne produit pas de PDF/A-3 (XMP + OutputIntent ICC à écrire à la main) |
| Connecteur Plateforme Agréée | Hors de portée : agrément, contrat commercial, annuaire, cycles de vie de facture |
| E-reporting B2C | Dépend d'une PA |
| Avoir / annulation de facture | Instrument juridique distinct, à part entière (cf. §6) |
| Facture d'acompte | Le modèle est ouvert (cf. §5), la fonctionnalité ne l'est pas encore |
| Autoliquidation TVA sous-traitance BTP | Art. 283-2 nonies du CGI — cas métier réel mais distinct (cf. §6) |

**Le choix structurant :** le modèle de données porte **dès maintenant** les champs
qu'exige EN 16931 et la réforme 2026 (SIREN de l'acheteur, adresse de livraison,
catégorie d'opération, option TVA sur les débits, pays des parties, date de
prestation, devise, ventilation de TVA). Ils sont gratuits à la création et coûteux à
rajouter en migration sur des factures déjà émises. Ajouter un sérialiseur Factur-X et
un connecteur PA en 2027 devient un travail **additif** : de la sérialisation et du
transport, pas une refonte du modèle.

---

## 3. Mentions obligatoires portées par la facture

### Mentions générales
Art. 242 nonies A de l'annexe II au CGI, art. L441-9 du code de commerce.

- Numéro de facture unique, séquentiel, sans rupture — cf. §4
- Date d'émission
- **Date de la vente ou de la prestation**, distincte de la date d'émission
- Identité de l'émetteur : dénomination, adresse, SIRET, forme juridique et capital
  social (sociétés), immatriculation RCS ou répertoire des métiers
- Numéro de TVA intracommunautaire — ou, en franchise en base,
  **« TVA non applicable, art. 293 B du CGI »**
- Identité et adresse du client
- Désignation, quantité et prix unitaire HT de chaque ligne
- Taux de TVA par ligne et ventilation par taux
- Totaux HT, TVA et TTC
- Date d'échéance du règlement
- Taux des pénalités de retard
- **Indemnité forfaitaire de recouvrement de 40 EUR** (art. L441-10 du code de commerce)
- Conditions d'escompte pour paiement anticipé

### Mention propre aux artisans du bâtiment
Art. L243-2 du code des assurances : **assurance décennale** — nom de l'assureur,
numéro de contrat, couverture géographique. Obligatoire sur les devis **et** les
factures. C'est une mention bloquante dans Chiffréo.

### Les quatre nouvelles mentions du 1er septembre 2026

1. **SIREN du client**, lorsqu'il est assujetti en France (routage par l'annuaire)
2. **Adresse de livraison**, si différente de l'adresse de facturation
3. **Catégorie d'opération** : livraison de biens, prestation de services, ou mixte
4. **« Option pour le paiement de la taxe d'après les débits »**, le cas échéant

Chaque mention manquante ou inexacte est sanctionnée d'une amende de 15 EUR,
plafonnée au quart du montant de la facture.

### Ce que Chiffréo bloque, et ce qu'il n'impose pas

Le contrôle vit dans [`invoice-legal-mentions.ts`](../apps/api/src/invoices/invoice-legal-mentions.ts)
et renvoie un `400 MISSING_LEGAL_MENTIONS` listant les champs manquants.

**Bloquant :** SIRET, adresse complète, TVA intracom *ou* franchise en base,
immatriculation (RCS ou répertoire des métiers), assurance décennale (assureur +
couverture).

**Non bloquant :** forme juridique et capital social — obligatoires pour les seules
sociétés, non déductibles de façon fiable des données saisies. Ils sont imprimés s'ils
sont renseignés. Un refus abusif qui empêcherait un artisan de facturer coûte plus
cher qu'une mention facultative absente.

---

## 4. Numérotation

Art. 242 nonies A du CGI : le numéro doit reposer sur une **séquence chronologique
continue et sans rupture**. Un numéro ne peut être ni modifié après émission, ni
réattribué après annulation.

**Mise en œuvre.** Table compteur `invoice_sequences (user_id, year, last_number)`,
allouée dans la **même transaction** que l'insertion de la facture :

```sql
INSERT INTO invoice_sequences (user_id, year, last_number) VALUES ($1, $2, 1)
ON CONFLICT (user_id, year)
DO UPDATE SET last_number = invoice_sequences.last_number + 1
RETURNING last_number
```

L'upsert prend un verrou de ligne : les allocations concurrentes du même artisan se
sérialisent, et un échec restitue le numéro au lieu de laisser un trou. Format
`F-AAAA-NNNN`, série remise à 1 chaque année civile (série annuelle admise).

L'année et la date d'émission proviennent d'une **source unique en `Europe/Paris`** :
sur un serveur en UTC, le 31 décembre à 23 h 30 heure de Paris, l'année civile
calculée en UTC serait la précédente, et produirait un `F-2026-xxxx` émis après un
`F-2027-0001`.

**Immuabilité.** Aucune route ne modifie le contenu d'une facture ni ne la supprime —
seul l'état de règlement (`issued` ↔ `paid`) évolue. C'est ce qui rend la continuité
de la séquence vérifiable : une facture supprimée serait un trou définitif.

> **Note sur les devis.** `QuotesService.generateNextQuoteNumber` numérote les devis
> par `LIKE` + `MAX` sans verrou : c'est racy et le tri lexical casse au-delà de 999.
> Ce n'est pas corrigé ici parce qu'un devis n'est soumis à aucune exigence légale de
> continuité — un doublon y produit au pire une erreur d'unicité. À reprendre si un
> jour la numérotation des devis devient visible d'un tiers.

---

## 5. Conservation

- **10 ans** au titre du code de commerce (art. L123-22)
- **6 ans** au titre du livre des procédures fiscales (art. L102 B)

Les factures sont des documents **autoportants** : identités vendeur et acheteur,
lignes et ventilation de TVA sont figées en JSON à l'émission. Une facture se
réimprime à l'identique même si le profil entreprise a changé, ou si le client, le
devis ou le projet d'origine ont été supprimés (toutes les clés étrangères sont en
`ON DELETE SET NULL`, et `source_quote_number` conserve la référence du devis).

Le type `invoice_type` prévoit déjà `acompte` et `avoir`, et la contrainte d'unicité
est un index partiel sur les seules factures de solde : les factures multiples par
devis sont une évolution additive, sans migration structurante.

**Non couvert :** la loi anti-fraude TVA de 2018 (inaltérabilité, sécurisation,
conservation, archivage — NF525) vise les logiciels de **caisse et d'encaissement**.
Chiffréo n'enregistre pas de règlement au sens de cette obligation. Si un jour le
produit encaisse pour le compte de l'artisan, l'analyse est à refaire.

---

## 6. Limites connues

- **Pas d'avoir ni d'annulation.** Annuler une facture émise exige légalement un
  avoir, qui est lui-même une facture (numérotée dans la même séquence). Un statut
  « annulée » sans avoir n'aurait aucune valeur juridique : il n'a donc pas été ajouté.
- **Pas de facture d'acompte.** « 30 % à la commande, solde à la livraison » est
  pourtant le cas courant. Aujourd'hui la conversion produit une facture de solde
  unique, et les conditions de règlement du devis sont reportées en texte libre.
- **Un seul taux de TVA par facture**, hérité du devis. Un chantier de rénovation
  mêle légitimement 20 %, 10 % et 5,5 %. Passer le devis en TVA par ligne changerait
  la sémantique de devis déjà acceptés et imposerait une migration de données. La
  facture stocke néanmoins une **ventilation** (`vat_breakdown`) et le PDF la rend
  sous forme de tableau même à une seule ligne : le multi-taux sera une pure évolution
  de données, sans travail sur le PDF.
- **Pas d'autoliquidation en sous-traitance BTP** (art. 283-2 nonies du CGI) : un
  sous-traitant facture sans TVA au donneur d'ordre, avec la mention
  « Autoliquidation ». Cas métier réel, non traité.
- **Écart d'un centime possible avec le devis.** La facture calcule
  `TVA = arrondi(HT × taux)` puis `TTC = HT + TVA`, alors que le devis calcule
  `TTC = arrondi(HT × (1 + taux))`. La facture fait foi.
- **Pas de logo sur le PDF.** Le service PDF n'embarque aucune image.

---

## 7. Chemin d'évolution vers 2027

1. **Compléter le profil client** — le SIREN acheteur n'est exigé qu'en B2B, mais
   l'annuaire en dépend.
2. **Sérialiseur EN 16931** — produire le XML CII depuis `Invoice` : les champs
   nécessaires existent déjà. Travail isolé et testable, sans toucher au reste.
3. **Factur-X** — embarquer ce XML dans un PDF/A-3. Suppose d'abandonner PDFKit pour
   la sortie facture, ou d'écrire à la main les métadonnées XMP et l'OutputIntent ICC.
4. **Raccordement à une PA** — statut d'opérateur de dématérialisation, cycles de vie
   de facture, et e-reporting pour les opérations B2C. Coût : cf. §8.

Les étapes 1 et 2 sont réalisables sans décision commerciale. Les étapes 3 et 4
supposent un partenaire PA choisi.

---

## 8. Coût d'une Plateforme Agréée

> Recherche du 07/08/2026 — état du marché à cette date. Convention de lecture :
> **[sourcé]** = URL vérifiée le 07/08/2026 ; **[estimé]** = déduction dont le
> raisonnement est écrit. Ne rien décider sur un [estimé] seul.

### 8.1 État du marché **[sourcé]**

- La [liste officielle des plateformes agréées](https://www.impots.gouv.fr/liste-des-plateformes-agreees-immatriculees-sous-reserve)
  (DGFiP, mise à jour du 06/08/2026) compte **146 plateformes** ayant passé les
  tests d'interopérabilité (immatriculées sous réserve du rapport d'audit) et
  **20** en attente de ces tests. Les fichiers officiels donnent la date de
  délivrance mais **pas le numéro d'immatriculation** — les numéros qui
  circulent viennent de tiers non officiels.
- **52 plateformes se déclarent prêtes pour l'émission dès le 01/09/2026, dont
  15 « infrastructurelles »** (offre en marque blanche pour éditeurs) —
  [compta-online](https://www.compta-online.com/plateformes-agreees-facturation-electronique-ao6026).
- Pistes écartées après vérification : **Libeo n'est pas une PA** (c'est
  lui-même un OD adossé à la PA Docaposte Sérès —
  [libeo.io](https://libeo.io/blog/facture-electronique-libeo-obtient-accreditation-pdp)) ;
  **Cegid, Esker, Generix, Yooz, Qonto, Tiime** : aucun programme partenaire
  éditeur/OD public trouvé — positionnement grands comptes (Esker, Generix) ou
  PA captive de leur propre logiciel. **Sage** est immatriculée (22/12/2025) et
  évoque des « API alignées AFNOR pour logiciels tiers », mais sans programme
  partenaire public, et sa PA sert un écosystème dont Batigest vise les mêmes
  artisans que Chiffréo **[déduit]** : à ne solliciter qu'en dernier recours.

### 8.2 Cinq partenariats éditeur documentés **[sourcé]**

Toutes immatriculées en liste 1 (tests d'interopérabilité validés).

| PA | Immatriculée le | Programme éditeur | Tarif partenariat | Formats | Délai annoncé |
|---|---|---|---|---|---|
| [Iopole](https://www.iopole.com/nos-partenaires) | 11/12/2025 | Pure player API ; modèles « Distributeur » et apporteur, marque blanche (plan Enterprise), sandbox gratuite | **NON PUBLIC** — 3 plans sans prix (set-up + volume) ; contact@iopole.com ou formulaire partenaires | Factur-X, UBL, CII, **JSON converti**, Peppol, EDIFACT | Non publié |
| [Pennylane](https://www.pennylane.com/fr/partenaires) | 11/12/2025 | Catégorie dédiée « Partenaires Plateforme Agréée : éditeurs qui proposent Pennylane comme PA à leurs clients » ; raccordement via [API Entreprise V2](https://help.pennylane.com/fr/articles/18770-utiliser-les-api-publiques-pennylane) (import d'un Factur-X généré par l'éditeur) | **NON PUBLIC** — mais PA annoncée **gratuite** (févr. 2024, rappelé par compta-online) ; formulaire « Devenir partenaire » | Factur-X, UBL, CII ; API REST JSON | Non publié ; précédent raccordé en mai 2026 (cf. ci-dessous) |
| [Serensia by Quadient](https://serensia.com/avis-d039expert/pourquoi-choisir-une-pdp-en-marque-blanche/) | 11/12/2025 | « PA en marque blanche » pour éditeurs : l'utilisateur reste dans le logiciel de l'éditeur | **NON PUBLIC** — formulaire de démo API sur la même page | UBL, CII, Factur-X ; API REST + webhooks, Peppol | Non publié |
| [Seqino](https://seqino.com/articles-blog/seqino-lance-une-pdp-en-marque-blanche-et-en-marque-grise/) (Crédit Mutuel Arkéa) | 15/01/2026 | Marque blanche (instance dédiée, l'éditeur au registre) **et « marque grise »** (API sur l'immatriculation de Seqino — le schéma OD exact de Chiffréo) | **NON PUBLIC** — contact via seqino.com | API RESTful ; SecNumCloud, ISO 27001, NF203 | Non publié |
| [B2BRouter](https://www.b2brouter.net/fr/api-facturation-electronique/) | 12/12/2025 | API pour éditeurs, marque blanche et grise, sandbox et [docs développeur](https://developer.b2brouter.net) publiques | API **NON PUBLIC** ; tarifs applicatifs publics : 0 € (24 transactions/an), 110 €/an HT illimité, 300 €/an HT ([tarifs](https://www.b2brouter.net/fr/tarifs/)) | Factur-X, UBL, CII, EDIFACT, XRechnung, Peppol, Chorus Pro | Non publié |

**Le précédent qui compte** : [ArtisanSmart](https://artisansmart.fr/blog/pennylane/),
SaaS de facturation pour artisans — le schéma exact visé par Chiffréo (OD
raccordé à la PA Pennylane) — a été raccordé et validé en **mai 2026**, flux
émission et réception opérationnels, coût du raccordement **absorbé dans son
abonnement à 29 € HT/mois sans surcoût** facturé par Pennylane. La faisabilité
technique et économique du schéma est donc démontrée sur notre marché.
Contrepartie à peser : Pennylane vend aussi un logiciel de facturation —
c'est un fournisseur potentiellement concurrent.

Piste secondaire : [Qweeby](https://www.qweeby.fr/plateforme-agreee)
(immatriculée 22/12/2025, modèle « prix tout compris par e-facture » sur devis,
hello_pdp@qweeby.com) — orientée PME/ETI, mais son modèle par facture vaut
d'être chiffré en comparaison.

### 8.3 Points de prix publics **[sourcé]**

Aucune PA ne publie son tarif de partenariat éditeur. Les prix publics
disponibles encadrent néanmoins le marché :

| Signal | Valeur | Source |
|---|---|---|
| Tarification au volume, marché PA | **0,10 à 0,50 € par facture** | [comparateur-efacturation.fr](https://comparateur-efacturation.fr/guide/prix-plateforme-agreee-facturation-electronique) |
| Abonnement PA pour une TPE (client final) | 15 à 60 €/mois ; nombreuses PA gratuites (Indy, Tiime, VosFactures, Abby…) ; Qonto 9 €/mois, Pennylane 14 €/util./mois, Sage 25 €/mois | même guide + [comparepdp.com](https://comparepdp.com/articles/prix-plateforme-agreee) |
| B2BRouter, plans applicatifs | 0 € (24 transactions/an) ; 110 €/an HT illimité ; 300 €/an HT | [b2brouter.net](https://www.b2brouter.net/fr/tarifs/) |
| A-Cube, API e-invoicing (offre italienne, proxy de leur pricing) | 19,90 €/mois pour 50 docs (+0,45 €/doc) à 39,90 €/mois pour 200 docs (+0,25 €/doc) | [blog.acubeapi.com](https://blog.acubeapi.com/en/revolutionize-your-stripe-experience-the-one-click-e-invoicing-app-by-a-cube-is-here/) |
| FactPulse, middleware Factur-X en marque blanche pour éditeurs (**pas une PA** : se raccorde aux PA) | à partir de 29 €/mois, sandbox gratuite | [factpulse.fr](https://factpulse.fr/) |
| PA gratuites côté éditeurs-PA | Pennylane (annonce févr. 2024), AGIRIS eFacture (juil. 2025) | [compta-online](https://www.compta-online.com/plateformes-agreees-facturation-electronique-ao6026) |
| Précédent OD artisan tout compris | Raccordement PA Pennylane inclus dans 29 € HT/mois | [artisansmart.fr](https://artisansmart.fr/blog/pennylane/) |

### 8.4 Fourchette raisonnée, en € par client et par mois **[estimé]**

Hypothèses posées avant calcul : un artisan TPE émet **3 à 10 factures/mois**
(B2B électroniques + transactions B2C partant en e-reporting) ; base V1 de
l'ordre de **50 clients payants** pour amortir un éventuel forfait socle.

| Scénario | Raisonnement | Coût par client/mois |
|---|---|---|
| **Bas** — PA Pennylane gratuite | Le précédent ArtisanSmart le démontre à l'échelle d'un SaaS artisan : coût marginal nul, le coût réel est le développement du connecteur (sérialiseur Factur-X + API, §7) | **≈ 0 €** |
| **Central** — PA API-first au volume | 3–10 factures × 0,10–0,30 €/facture, plus un forfait socle estimé 20–30 €/mois amorti sur 50 clients (+0,40–0,60 €) | **≈ 0,70 à 3,60 €** |
| **Haut** — marque blanche dédiée | Instance dédiée type Iopole Enterprise/Seqino marque blanche, avec set-up : injustifiable à l'échelle V1 | > 5 € — écarté |

**Fourchette retenue : 0 à ~3,50 € par client et par mois, centre de gravité
autour de 1 €** — soit 0 à 18 % du palier Artisan à 19 €/mois
([ADR 0001 §D4](adr/0001-cible-et-perimetre-v1.md)), ~5 % au centre. Ce qui est
sourcé dans cette fourchette : les prix unitaires 0,10–0,50 €/facture, les
plans B2BRouter/A-Cube, la gratuité annoncée de la PA Pennylane et le précédent
ArtisanSmart. Ce qui est estimé : le nombre de factures par artisan, la taille
du forfait socle, son amortissement — et l'hypothèse que l'e-reporting B2C est
inclus dans ces prix, ce qu'aucune source ne confirme : **c'est le premier
point à faire chiffrer** (le B2C domine le volume d'un artisan).

Conclusion d'orientation **[estimé]** : au coût central (~1 €/client/mois), le
raccordement PA n'est pas un sujet de viabilité mais un sujet de marge (~5 % du
MRR) ; la facturation reste dans l'offre. Seul le scénario haut, ou un
e-reporting B2C facturé à la transaction, rouvrirait la question du repli
(export Factur-X déposé par l'artisan dans sa propre PA).

### 8.5 Trois actions pour obtenir le chiffre ferme

Seuil d'acceptabilité fixé **avant** de recevoir les devis : **≤ 2 € par client
et par mois tout compris** (≈ 10 % du palier à 19 €). Au-delà, le repli
« export Factur-X » redevient l'option de référence.

1. **Candidater au programme partenaire Pennylane** via le formulaire
   [pennylane.com/fr/partenaires](https://www.pennylane.com/fr/partenaires)
   (catégorie « Partenaires Plateforme Agréée »), en citant le précédent
   ArtisanSmart. Questions à poser par écrit : gratuité effective pour un
   éditeur OD (par facture ? par SIREN ?), e-reporting B2C inclus, conditions
   contractuelles du statut d'OD, engagement de réversibilité.
2. **Demander deux devis comparables à des PA infrastructurelles** — Iopole
   (contact@iopole.com ou formulaire partenaires) et Seqino en « marque grise »
   (via seqino.com) — sur un profil chiffré identique : 50 artisans, 5 factures
   B2B/mois chacun, e-reporting B2C, émission Factur-X générée par Chiffréo.
   Exiger la décomposition : set-up, minimum mensuel, prix unitaire, archivage.
3. **Comparer sur une grille unique des coûts complets** : set-up, minimum de
   facturation, prix par facture, prix ou forfait de l'e-reporting B2C,
   archivage à valeur probante 10 ans, gestion de l'annuaire et des cycles de
   vie, frais de sortie. C'est cette grille — pas le prix unitaire affiché —
   qui donne le vrai € par client et par mois, à confronter au seuil ci-dessus.
