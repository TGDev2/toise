# Matériaux par ouvrage — curation E1-3

Décision métier matérialisée dans `work_type_materials` (seed :
`apps/api/src/materials/work-type-materials.data.ts`, migrations `…066`/`…067`).
Pour chaque ouvrage : le **principal** (un seul est chiffré par défaut, les
alternatives sont documentées mais jamais chiffrées automatiquement), les
**consommables** systématiques, la **sous-couche** quand elle couvre toute la
surface, et les **accessoires** (petit matériel couramment racheté par
chantier). Objectif : 3 à 6 lignes achetables par ouvrage.

**Règles transverses appliquées** (valables pour les sept listes) :

- L'outillage durable, réutilisé de chantier en chantier, n'apparaît jamais :
  bac à peinture, grille d'essorage, perche télescopique, mélangeur,
  coupe-carreaux, système de nivelage, table à tapisser, fil à plomb, règle
  alu, couteau à maroufler.
- Ce qui se chiffre au linéaire ou à l'unité n'entre pas dans une liste
  calculée à la surface : plinthes, barres de seuil, profilés et baguettes de
  finition, listels, frises, cornières.
- Ce qui dépend d'un diagnostic du support n'est pas systématique : enduits de
  rebouchage/lissage, papier abrasif, fixateur de fond, primaires
  d'accrochage, ragréages, SEL et bande d'étanchéité, natte de découplage,
  papier d'apprêt.
- Les produits d'un autre usage sont exclus d'office : peinture façade,
  peintures sol/fer/radiateur/boiseries, lasures et vernis, décapant, white
  spirit (inutile en acrylique), aérosols, peintures à effet.

**Deux limites connues, portées par les épics suivants** :

1. **Quantités des accessoires** — E1-4 a supprimé la moitié du défaut : le
   nombre de couches ne s'applique plus qu'aux matériaux qui le déclarent
   (`materials_catalog.applies_coats`), donc un rouleau est passé de ~70 à
   ~35 unités pour 33 m². Reste l'autre moitié : la quantité d'un accessoire
   demeure proportionnelle à la surface, parce que son `yield_per_unit` vaut 1
   — un rouleau « couvrirait » 1 m². Il faut soit un rendement réel (E1-7,
   sourçage des rendements), soit une règle de quantité portée par le rôle
   `accessoire` (« jeu d'outils par chantier », indépendant de la surface).
   Tant que ce n'est pas tranché, l'assertion « aucun accessoire au-dessus de
   5 unités » du test E1-1 reste rouge.
2. **Doublons avec les compléments calculés** — rouleau, bâche, ruban,
   croisillons, bande/enduit à joint, colle papier peint et cutter existent
   aussi comme « compléments » (migrations `…009`/`…010`). L'arbitrage entre
   les deux mécanismes est confié à E1-6 ; en attendant, la liaison est la
   source curée de référence.

Légende rôle : P = principal · SC = sous-couche · C = consommable ·
A = accessoire. Les lignes « optionnel » ne sont pas chiffrées.

---

## 1. wall_painting — Peinture murale intérieure

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Peinture acrylique mate | P | obligatoire | Le défaut le plus courant en rénovation intérieure |
| 2 | Sous-couche universelle | SC | obligatoire | Parti pris sûr quel que soit le support |
| 3 | Rouleau méché 180mm | A | obligatoire | Le manchon se rachète par chantier |
| 4 | Pinceau à rechampir 25mm | A | obligatoire | Angles et bords |
| 5 | Ruban de masquage 50m | A | obligatoire | Consommé à chaque chantier |
| 6 | Bâche de protection 4x5m | A | obligatoire | Protection des sols et meubles |
| 7 | Peinture acrylique satinée | P | optionnel | Alternative lessivable |
| 8 | Peinture acrylique velours | P | optionnel | Alternative intermédiaire mat/satin |
| 9 | Peinture cuisine et salle de bain | P | optionnel | Variante pièces humides |

**Écartés qu'on pourrait croire nécessaires** :

- Enduit de rebouchage — dépend du diagnostic d'état du support, pas de la surface à peindre.
- Enduit de lissage — prestation de préparation distincte, chiffrée à part si le support l'exige.
- Papier abrasif grain 120 — égrenage selon l'état du support, relève de la préparation.
- Fixateur de fond — réservé aux fonds farinants ou poreux, sur diagnostic.
- White spirit 1L — inutile en acrylique, les outils se nettoient à l'eau.
- Peinture glycéro satinée — réservée boiseries/métaux, plus utilisée en murs intérieurs (COV).
- Bac à peinture, grille d'essorage, perche, mélangeur — outillage durable, réutilisé de chantier en chantier.

## 2. ceiling_painting — Peinture plafond

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Peinture plafond mate | P | obligatoire | Formulation anti-goutte, mat profond |
| 2 | Sous-couche universelle | SC | obligatoire | — |
| 3 | Rouleau méché 180mm | A | obligatoire | — |
| 4 | Pinceau à rechampir 25mm | A | obligatoire | Rechampi en périphérie |
| 5 | Bâche de protection 4x5m | A | obligatoire | Tout le sol est exposé |
| 6 | Ruban de masquage 50m | A | obligatoire | Protection du haut des murs finis |
| 7 | Peinture plafond anti-traces | P | optionnel | Le choix rénovation en lumière rasante |

**Écartés qu'on pourrait croire nécessaires** :

- Perche télescopique 1.2-2.4m — l'outil du plafond, mais outillage durable : on ne le rachète pas à chaque chantier.
- Peinture acrylique mate (murale) — non formulée pour l'application en sous-face ; le produit plafond dédié est le bon défaut.
- Peinture anti-humidité — traite un symptôme ; ne s'applique qu'après diagnostic et traitement de la cause.
- Fixateur de fond — fonds farinants uniquement, sur diagnostic.
- Enduits de rebouchage / lissage — état du support, prestation de préparation distincte.

## 3. floor_tiling — Carrelage sol intérieur

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Carrelage sol 45x45 cm | P | obligatoire | Format standard actuel en rénovation (le 30x30 est daté) |
| 2 | Mortier-colle flexible (C2) | C | obligatoire | Le bon défaut sur supports existants |
| 3 | Joint fin 1-6mm | C | obligatoire | Largeur courante en 45x45 intérieur |
| 4 | Croisillons 3mm (x200) | A | obligatoire | Consommable de pose |
| 5 | Éponge de carreleur | A | obligatoire | Jointoiement, usée par chantier |
| 6 | Peigne à colle 10mm | A | obligatoire | Denture sol ; s'use et se rachète par chantier |
| 7 | Carrelage sol 30x30 cm | P | optionnel | Ancien défaut, conservé comme variante petit format |
| 8 | Carrelage sol 60x60 cm | P | optionnel | Grand format — appellerait colle C2S1 et nivelage (limite documentée) |
| 9 | Carrelage imitation bois 20x120 cm | P | optionnel | Grand format — même réserve que le 60x60 |

**Écartés qu'on pourrait croire nécessaires** :

- Primaire d'accrochage carrelage — seulement selon le support (ancien carrelage, support fermé).
- Ragréage autolissant — dépend de la planéité constatée, diagnostic préalable.
- Plinthe carrelage 8x30 cm — chiffrage au linéaire, ouvrage de finition séparé.
- SEL + bande d'étanchéité — zone douche / pièce d'eau uniquement.
- Natte de découplage — supports fissurés ou planchers bois seulement.
- Système de nivelage (kit 100) — utile à partir des grands formats, pas en 45x45.
- Mortier-colle standard (C1) — déconseillé en rénovation sur supports existants ; le C2 flexible est le bon défaut.
- Joint souple silicone — joint périphérique traité au linéaire en finition sol.
- Coupe-carreaux manuel 600mm — outillage durable.

## 4. wall_tiling — Faïence murale

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Faïence murale 25x40 cm | P | obligatoire | Format courant cuisine / salle de bain |
| 2 | Colle en pâte prête à l'emploi | C | obligatoire | Le choix pro en mural intérieur, **hors zone douche** (immersion → mortier-colle) |
| 3 | Joint fin 1-6mm | C | obligatoire | Joints fins muraux |
| 4 | Joint souple silicone | C | obligatoire | Angles rentrants et périphéries (bac, plan de travail) |
| 5 | Croisillons 2mm (x200) | A | obligatoire | — |
| 6 | Éponge de carreleur | A | obligatoire | — |
| 7 | Carrelage métro 7.5x15 cm | P | optionnel | Même colle, mêmes croisillons |
| 8 | Carrelage mural 20x40 cm | P | optionnel | — |

**Écartés qu'on pourrait croire nécessaires** :

- SEL + bande d'étanchéité 120mm — zone douche uniquement (locaux EB+, DTU 52.2), pas du systématique.
- Primaire d'accrochage carrelage — selon support (peinture, plâtre lisse), sur diagnostic.
- Profilé de finition alu / baguette PVC — au linéaire, selon les angles sortants du chantier.
- Listel décoratif inox — décoratif, au choix du client, au linéaire.
- Croisillons auto-nivelants — grands formats muraux, superflu en 25x40.
- Peigne à colle 6mm — défendable, mais le silicone est plus incontestable dans la limite des 6 lignes.

## 5. parquet_flooring — Parquet / stratifié en pose flottante

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Stratifié 8mm AC4 | P | obligatoire | Défaut rénovation pièce à vivre |
| 2 | Sous-couche mousse 3mm | SC | obligatoire | Défaut courant |
| 3 | Film pare-vapeur PE | SC | obligatoire | Support minéral (dalle, chape) — à proscrire sur plancher bois (documenté) |
| 4 | Ruban adhésif pare-vapeur | C | obligatoire | Jointoiement des lés — va toujours avec le film |
| 5 | Cale de dilatation (x40) | A | obligatoire | Le consommable de la pose flottante |
| 6 | Parquet contrecollé chêne 14mm | P | optionnel | Montée en gamme bois véritable |
| 7 | Stratifié 12mm AC5 | P | optionnel | Usage intensif |

**Écartés qu'on pourrait croire nécessaires** :

- Kit de pose stratifié (cale+tire-lame+maillet) — tire-lame et maillet sont de l'outillage durable ; seul le consommable (cales) est retenu.
- Plinthes MDF / chêne — chiffrage au linéaire, pas à la surface.
- Barres de seuil — à l'unité, par passage de porte.
- Colle parquet — pose collée uniquement, hors sujet en pose flottante.
- Sous-couches acoustique 5mm / liège / fibre de bois — variantes selon exigence acoustique ou support, la mousse 3mm est le défaut.
- Ragréage fibré + primaire d'accrochage sol — selon planéité constatée, diagnostic préalable.

## 6. drywall — Cloison sèche sur ossature (72/48, simple peau)

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Plaque BA13 standard 2.5x1.2m | P | obligatoire | Quantité à couvrir : les **deux** faces (moteur) |
| 2 | Rail R48 3m | C | obligatoire | Lisses haute et basse |
| 3 | Montant M48 2.7m | C | obligatoire | Ossature verticale |
| 4 | Vis placo 25mm (x500) | C | obligatoire | La bonne longueur en simple peau sur métal |
| 5 | Bande à joint papier 23m | C | obligatoire | Règle de l'art sur joints neufs |
| 6 | Enduit à joint prêt 7kg | C | obligatoire | — |
| 7 | Plaque BA13 hydro 2.5x1.2m | P | optionnel | Pièces humides |
| 8 | Laine de verre 45mm | C | optionnel | Isolement de la cloison, très souvent pris en pratique |
| 9 | Enduit à joint poudre 5kg | C | optionnel | Alternative économique à prise contrôlée |

**Écartés qu'on pourrait croire nécessaires** :

- Vis placo 35mm / 45mm — double peau ou rechargement uniquement.
- Enduit de finition placo — selon le niveau de finition exigé ; la finition courante avant peinture s'arrête à l'enduit à joint.
- Cornière de protection d'angle — angles sortants seulement, au linéaire selon configuration.
- Bande armée fibre — angles exposés aux chocs, pas les joints courants.
- Calicot adhésif — dépannage / réparation de fissures ; sur joints neufs, la bande papier est la règle de l'art.
- Fourrure F530, suspente, fixation fourrure — ossature de **plafond**, pas de cloison.
- Chevilles Molly — fixation d'équipements après coup, pas la construction de la cloison.
- BA13 feu / phonique / BA10 / BA18 — exigences réglementaires ou cas spécifiques, hors rénovation courante.

## 7. wall_covering — Papier peint (intissé)

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Papier peint intissé uni | P | obligatoire | On encolle le mur, pas le lé |
| 2 | Colle papier peint intissé | C | obligatoire | Colle dédiée (consistance, glisse) |
| 3 | Brosse à maroufler | A | obligatoire | Marouflage des lés |
| 4 | Roulette de joint | A | obligatoire | Le geste du raccord invisible |
| 5 | Cutter de précision | A | obligatoire | Lames changées en continu — arasement net |
| 6 | Papier peint intissé à motif | P | optionnel | Le facteur de chute « patterned » du catalogue le couvre |
| 7 | Papier peint vinyle sur intissé | P | optionnel | Papiers lourds → colle renforcée (limite documentée) |

**Écartés qu'on pourrait croire nécessaires** :

- Table à tapisser — outillage durable ; et en intissé on encolle le mur, elle ne sert même pas.
- Fil à plomb / règle alu 2m — outillage durable.
- Couteau à maroufler — guide de coupe utile mais durable ; la roulette et le cutter suffisent.
- Papier d'apprêt lisse — fonds dégradés ou hétérogènes seulement, sur diagnostic.
- Colle universelle / vinyle / renforcée — dépendent du papier choisi, pas du défaut intissé uni.
- Toile de verre / voile de verre à peindre — revêtement à peindre : autre ouvrage, avec sa propre colle.
- Frise murale décorative — décoratif au choix du client, au linéaire.
