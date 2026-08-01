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
   de facture, et e-reporting pour les opérations B2C.

Les étapes 1 et 2 sont réalisables sans décision commerciale. Les étapes 3 et 4
supposent un partenaire PA choisi.
