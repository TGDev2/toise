# Matériaux par ouvrage — curation E1-3

Décision métier matérialisée dans `work_type_materials` (seed :
`apps/api/src/materials/work-type-materials.data.ts`, migrations `…066`/`…067`).
Pour chaque ouvrage : le **principal** (un seul est chiffré par défaut, les
alternatives sont documentées mais jamais chiffrées automatiquement), les
**consommables** systématiques et la **sous-couche** quand elle couvre toute
la surface. Objectif : 2 à 6 lignes achetables par ouvrage, toutes au
rendement sourcé (`docs/SOURCES_CATALOGUE.md`).

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

**La limite des accessoires est tranchée (E1-7)** : un outil pur — rouleau,
pinceau, ruban de masquage, bâche, éponge, peigne, brosse, roulette, cutter,
cale — n'a pas de rendement exprimable en m² par unité ; « un rouleau couvre
1 m² » faisait acheter 35 rouleaux pour une chambre. Ces 10 outils sortent des
liaisons (migration `…071`) et restent au catalogue, hors chiffrage. Sortent
aussi, faute de source : les croisillons (aucune table de consommation
fabricant), le joint silicone et le ruban pare-vapeur (grandeur fiche
linéaire ou non normée — un modèle à la surface ne peut pas les porter
honnêtement). L'assertion « aucun accessoire au-dessus de 5 unités » du test
E1-1 est verte. Réintégrer outils et consommables linéaires comme rappel
d'achat forfaitaire reste possible via `complementary_materials`, qui porte
déjà ce mécanisme (bac à peinture) — hors périmètre V1, à inscrire au backlog
si souhaité.

**Le doublon avec les compléments est tranché (E1-6)** — rouleau, bâche, ruban,
colle, joint, croisillons, peigne, bande/enduit à joint, colle papier peint et
cutter existaient *aussi* comme « compléments » (migrations `…009`/`…010`),
donc deux fois dans la même liste. La règle retenue : **cette liaison est la
seule source des produits chiffrés ; dès qu'une quantité dépend de la
géométrie, le produit relève du catalogue.** Le catalogue est lié par ouvrage
(le sol reçoit du mortier-colle C2, le mur de la colle en pâte — la catégorie
`tiling` ne savait pas les distinguer), il passe par le rendement, le facteur
de perte par pose et niveau, le choix du conditionnement et la mutualisation
entre pièces, et lui seul est atteignable par l'appariement fournisseur, les
alternatives éco et les facteurs de perte appris. La migration `…069` supprime
les 14 compléments redondants et la colonne `formula_code` ; ne restent en
complément que **bac à peinture**, **profil de finition** et **barre de seuil**,
que les règles transverses ci-dessus excluent explicitement du chiffrage à la
surface.

**Manque de curation révélé par cet arbitrage, refermé par E1-7** :
`wall_tiling` n'avait pas de peigne à colle. Sans objet désormais — le peigne
est un outil pur, retiré du périmètre chiffré au même titre que celui de
`floor_tiling`.

Légende rôle : P = principal · SC = sous-couche · C = consommable ·
A = accessoire. Les lignes « optionnel » ne sont pas chiffrées.

---

## 1. wall_painting — Peinture murale intérieure

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Peinture acrylique mate | P | obligatoire | Le défaut le plus courant en rénovation intérieure |
| 2 | Sous-couche universelle | SC | obligatoire | Parti pris sûr quel que soit le support |
| 3 | Peinture acrylique satinée | P | optionnel | Alternative lessivable |
| 4 | Peinture acrylique velours | P | optionnel | Alternative intermédiaire mat/satin |
| 5 | Peinture cuisine et salle de bain | P | optionnel | Variante pièces humides |

**Écartés qu'on pourrait croire nécessaires** :

- Rouleau méché 180mm, pinceau à rechampir 25mm, ruban de masquage 50m, bâche de protection 4x5m — outils purs, rendement non sourçable en m²/unité, retirés par E1-7.
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
| 3 | Peinture plafond anti-traces | P | optionnel | Le choix rénovation en lumière rasante |

**Écartés qu'on pourrait croire nécessaires** :

- Rouleau méché 180mm, pinceau à rechampir 25mm, bâche de protection 4x5m, ruban de masquage 50m — outils purs, rendement non sourçable en m²/unité, retirés par E1-7.
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
| 4 | Carrelage sol 30x30 cm | P | optionnel | Ancien défaut, conservé comme variante petit format |
| 5 | Carrelage sol 60x60 cm | P | optionnel | Grand format — le nivelage reste une limite documentée, la surconsommation de colle non (E1-5) |
| 6 | Carrelage imitation bois 20x120 cm | P | optionnel | Grand format — même réserve que le 60x60 |

**E1-5 — le format du carreau et la largeur de joint pilotent la colle et le
joint.** Cet ouvrage porte trois questions contextuelles requises :
`tile_format`, `joint_width_mm` et `laying_pattern`. Le format sélectionne le
peigne, et le NF DTU 52.2 déclenche le double encollage au-delà de 1 200 cm²
(500 cm² pour un carreau peu poreux) : la colle passe de 4,5 kg/m² en 20 × 20 à
8 kg/m² en 60 × 60. La largeur de joint, elle, fait varier le joint d'un
facteur 6 entre un 20 × 20 à 5 mm et un 60 × 60 à 2 mm. Le mode d'encollage
n'est **pas** demandé : c'est une obligation de mise en œuvre, déduite du format
et de la destination. Seuils, tables et sources :
`docs/SOURCES_CATALOGUE.md`, section « Consommation pilotée par la géométrie du
carreau (E1-5) ».

La réserve « le 60 × 60 appellerait une colle C2S1 » n'en est plus tout à fait
une : les quatre mortiers du catalogue consomment la même chose à format égal —
aucune fiche fabricant lue ne lie la consommation à la classe de colle — et la
surconsommation du grand format est désormais chiffrée quel que soit le mortier
retenu. Ce qui reste une limite documentée, c'est le **nivelage** exigé par les
grands formats, absent du chiffrage.

**Écartés qu'on pourrait croire nécessaires** :

- Croisillons 3mm (x200) — aucune table de consommation par m² publiée par un fabricant (Rubi, Raimondi, Taliaplast vérifiés) : non sourçable, retirés par E1-7.
- Éponge de carreleur, peigne à colle 10mm — outils purs, rendement non sourçable en m²/unité, retirés par E1-7.
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
| 4 | Carrelage métro 7.5x15 cm | P | optionnel | Même colle |
| 5 | Carrelage mural 20x40 cm | P | optionnel | — |

**E1-5 — cet ouvrage ne demande toujours aucune question**, et c'est assumé.
Le moteur retient pour lui la faïence 25 × 40 cm, l'hypothèse déjà écrite au
registre depuis E1-7, et en dérive la consommation de joint (0,228 kg/m² au
lieu des 0,25 kg/m² constants d'avant). La colle en pâte, elle, ne bouge pas :
c'est un adhésif D2 dont la fiche est distincte de celle des mortiers, et sans
question de format sa valeur ne pourrait de toute façon pas varier. Ajouter le
format au carrelage mural relèverait d'une mise à jour de
`docs/BACKLOG_V1.md`.

**Écartés qu'on pourrait croire nécessaires** :

- Joint souple silicone — les fiches fabricant ne publient qu'un métrage linéaire de cordon (12 m par cartouche, Bostik S300), jamais un rendement au m² : non sourçable dans un modèle à la surface, retiré par E1-7 — même logique que son exclusion côté sol.
- Croisillons 2mm (x200) — aucune table de consommation par m² publiée par un fabricant : non sourçable, retirés par E1-7.
- Éponge de carreleur — outil pur, rendement non sourçable en m²/unité, retirée par E1-7.
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
| 4 | Parquet contrecollé chêne 14mm | P | optionnel | Montée en gamme bois véritable |
| 5 | Stratifié 12mm AC5 | P | optionnel | Usage intensif |

**Écartés qu'on pourrait croire nécessaires** :

- Ruban adhésif pare-vapeur — aucune fiche fabricant ne norme sa consommation au m², et la fiche du film (Wineo) ne l'exige pas en conditions normales : non sourçable, retiré par E1-7. Le recouvrement des lés, lui, est chiffré (rendement du film 0,8).
- Cale de dilatation (x40) — sa quantité suit le périmètre de la pièce, pas la surface : pas de rendement en m²/unité, retirée par E1-7.
- Kit de pose stratifié (cale+tire-lame+maillet) — tire-lame et maillet sont de l'outillage durable.
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
| 3 | Papier peint intissé à motif | P | optionnel | Le facteur de chute « patterned » du catalogue le couvre |
| 4 | Papier peint vinyle sur intissé | P | optionnel | Papiers lourds → colle renforcée (limite documentée) |

**Écartés qu'on pourrait croire nécessaires** :

- Brosse à maroufler, roulette de joint, cutter de précision — outils purs, rendement non sourçable en m²/unité, retirés par E1-7.
- Table à tapisser — outillage durable ; et en intissé on encolle le mur, elle ne sert même pas.
- Fil à plomb / règle alu 2m — outillage durable.
- Couteau à maroufler — guide de coupe utile mais durable ; la roulette et le cutter suffisent.
- Papier d'apprêt lisse — fonds dégradés ou hétérogènes seulement, sur diagnostic.
- Colle universelle / vinyle / renforcée — dépendent du papier choisi, pas du défaut intissé uni.
- Toile de verre / voile de verre à peindre — revêtement à peindre : autre ouvrage, avec sa propre colle.
- Frise murale décorative — décoratif au choix du client, au linéaire.
