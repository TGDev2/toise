# Matériaux par ouvrage — curation E1-3, étendue par E1-10

Décision métier matérialisée dans `work_type_materials` (seed :
`apps/api/src/materials/work-type-materials.data.ts`, migrations
`…066`/`…067`/`…092`). Pour chaque ouvrage : le **principal** (un seul est
chiffré par défaut, les alternatives sont documentées mais jamais chiffrées
automatiquement), les **consommables** systématiques, la **sous-couche** quand
elle couvre toute la surface, et depuis E1-10 les **accessoires** au linéaire
ou à l'unité (plinthes, barres de seuil) et les lignes **conditionnelles**
(SEL, ragréage — présentes quand la question de l'ouvrage les déclenche).
Objectif : une liste avec laquelle un professionnel peut partir au dépôt,
chaque ligne au rendement sourcé ou définitionnel
(`docs/SOURCES_CATALOGUE.md`).

**Règles transverses appliquées** (valables pour les sept listes) :

- L'outillage durable, réutilisé de chantier en chantier, n'apparaît jamais :
  bac à peinture, grille d'essorage, perche télescopique, mélangeur,
  coupe-carreaux, système de nivelage, table à tapisser, fil à plomb, règle
  alu, couteau à maroufler.
- **Règle E1-10, qui remplace « pas de rendement surfacique, pas de ligne »
  (E1-7)** : une ligne entre au chiffrage si, et seulement si, **sa quantité se
  dérive d'une grandeur que le modèle connaît ET son rendement dans cette
  grandeur est sourcé ou définitionnel**. Les grandeurs connues sont : la
  surface d'ouvrage, le parement, la trame (lisses, montants), le périmètre au
  sol portes déduites, le nombre de passages de porte, et la géométrie du
  carreau. Le linéaire et le comptage à l'unité sont des assiettes comme les
  autres (`floor_perimeter`, `door_count` — E1-10) : c'est ce qui fait entrer
  plinthes, barres de seuil, silicone périphérique et croisillons. Restent
  exclus : ce dont la grandeur n'est connue d'aucune donnée du modèle (angles
  sortants d'une cloison, linéaire d'angles verticaux d'une paroi,
  recouvrement des lés d'un film), ce dont aucun fabricant ne publie ni ne
  laisse dériver la consommation (espacement des cales de dilatation), et
  l'outillage, qui n'a pas de rendement du tout. En bref : **pas d'assiette
  connue ou pas de rendement sourçable, pas de ligne.**
- Ce qui dépend d'un diagnostic que le produit sait **demander** est
  conditionnel, pas absent (E1-10) : le SEL suit l'exposition à l'eau du local
  (`water_exposure`), le ragréage et son primaire la planéité du support
  (`floor_flatness`) — lignes obligatoires, déclenchées par la réponse,
  exclusions motivées sinon. Ce qui dépend d'un diagnostic que le produit ne
  sait **pas** demander reste hors chiffrage : enduits de rebouchage/lissage,
  papier abrasif, fixateur de fond, primaire seul sur support fermé, natte de
  découplage, papier d'apprêt.
- Les produits d'un autre usage sont exclus d'office : peinture façade,
  peintures sol/fer/radiateur/boiseries, lasures et vernis, décapant, white
  spirit (inutile en acrylique), aérosols, peintures à effet.

**La limite des accessoires est tranchée (E1-7), et déplacée par E1-10** : un
outil pur — rouleau, pinceau, ruban de masquage, bâche, éponge, peigne,
brosse, roulette, cutter, cale — n'a pas de rendement exprimable par unité ;
« un rouleau couvre 1 m² » faisait acheter 35 rouleaux pour une chambre. Ces
10 outils sont sortis des liaisons (migration `…071`) et restent au catalogue,
hors chiffrage — E1-10 n'y change rien. Ce qu'E1-7 avait sorti **faute
d'assiette**, en revanche, est revenu par la règle E1-10 : le joint silicone
(fiche Sika en mètres de cordon → assiette `floor_perimeter`), les croisillons
(dérivation géométrique par le format du carreau → loi `tile_spacers`), les
plinthes et barres de seuil. Le ruban adhésif pare-vapeur, lui, reste dehors :
sa grandeur — le linéaire de recouvrement des lés d'un film — n'est connue
d'aucune donnée du modèle.

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
les 14 compléments redondants et la colonne `formula_code`. E1-10 applique la
même règle à la **barre de seuil** : sa quantité dépend du nombre de portes,
donc de la géométrie — elle sort du forfait (migration `…093`) et entre au
catalogue sur l'assiette `door_count`. Ne restent en complément que **bac à
peinture** et **profil de finition**.

**Manque de curation révélé par cet arbitrage, refermé par E1-7** :
`wall_tiling` n'avait pas de peigne à colle. Sans objet désormais — le peigne
est un outil pur, retiré du périmètre chiffré au même titre que celui de
`floor_tiling`.

Légende rôle : P = principal · SC = sous-couche · C = consommable ·
A = accessoire. Les lignes « optionnel » ne sont pas chiffrées. Les lignes
« obligatoire (si …) » sont **conditionnelles** (E1-10) : chiffrées quand la
question de l'ouvrage les déclenche, écartées avec un motif visible sinon.

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
| 4 | Croisillons 3mm (x200) | C | obligatoire | E1-10 — un par intersection, dérivé du format (loi `tile_spacers`) |
| 5 | Joint souple silicone | C | obligatoire | E1-10 — joint périphérique, au périmètre portes déduites (Sika : 3 m/cartouche) |
| 6 | Plinthe carrelage 8x30 cm | A | obligatoire | E1-10 — au périmètre portes déduites, lot de 10 (3 m) |
| 7 | Barre de seuil alu 93cm | A | obligatoire | E1-10 — une par passage de porte (sortie du forfait complément) |
| 8 | Ragréage autolissant | SC | obligatoire (si support à ragréer) | E1-10 — question `floor_flatness`, seuil 5 mm/2 m, 3 mm retenus |
| 9 | Primaire d'accrochage carrelage | SC | obligatoire (si support à ragréer) | E1-10 — prescrit par la fiche du ragréage, suit son déclencheur |
| 10 | SEL (Système d'Étanchéité Liquide) | SC | obligatoire (si salle d'eau) | E1-10 — question `water_exposure`, kit 32 kg (PRB) |
| 11 | Bande d'étanchéité 120mm | C | obligatoire (si salle d'eau) | E1-10 — jonctions sol/mur, au périmètre portes déduites |
| 12 | Carrelage sol 30x30 cm | P | optionnel | Ancien défaut, conservé comme variante petit format |
| 13 | Carrelage sol 60x60 cm | P | optionnel | Grand format — le nivelage reste une limite documentée, la surconsommation de colle non (E1-5) |
| 14 | Carrelage imitation bois 20x120 cm | P | optionnel | Grand format — même réserve que le 60x60 |
| 15 | Croisillons 5mm (x100) | C | optionnel | Variante joint large (5-8 mm) |
| 16 | Natte de découplage | SC | optionnel | Supports fissurés / planchers bois, alternative documentée |

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

**Réintégrés par E1-10** (ils figuraient ci-dessous depuis E1-7) : croisillons
(dérivation géométrique), silicone (assiette linéaire), plinthe carrelage et
barre de seuil (périmètre et comptage), SEL + bande et ragréage + primaire
(conditionnels par question). Le détail — assiettes, sources, dates — est au
registre (`docs/SOURCES_CATALOGUE.md`, sections E1-10).

**Écartés qu'on pourrait croire nécessaires** :

- Éponge de carreleur, peigne à colle 10mm — outils purs, pas de rendement du tout.
- Système de nivelage (kit 100) — utile à partir des grands formats, pas en 45x45 ; et outillage pour partie réutilisable.
- Mortier-colle standard (C1) — déconseillé en rénovation sur supports existants ; le C2 flexible est le bon défaut.
- Coupe-carreaux manuel 600mm — outillage durable.
- Primaire seul sur support fermé (ancien carrelage, sans ragréage) — ce diagnostic-là n'a pas de question honnête en V1 ; le C2 flexible est précisément retenu pour adhérer aux supports existants.

**Double achat assumé, documenté** : plinthes et barre de seuil sont liées
aussi au parquet. Deux ouvrages de sol **dans la même pièce** achèteraient
deux jeux — entrée dégénérée ; dans deux pièces différentes, c'est le compte
juste.

## 4. wall_tiling — Faïence murale

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Faïence murale 25x40 cm | P | obligatoire | Format courant cuisine / salle de bain |
| 2 | Colle en pâte prête à l'emploi | C | obligatoire | Le choix pro en mural intérieur, **hors zone douche** (immersion → mortier-colle) |
| 3 | Joint fin 1-6mm | C | obligatoire | Joints fins muraux |
| 4 | Croisillons 3mm (x200) | C | obligatoire | E1-10 — 10/m² à la faïence 25x40 (loi `tile_spacers`) |
| 5 | SEL (Système d'Étanchéité Liquide) | SC | obligatoire (si salle d'eau) | E1-10 — question `water_exposure`, surface murale nette |
| 6 | Carrelage métro 7.5x15 cm | P | optionnel | Même colle |
| 7 | Carrelage mural 20x40 cm | P | optionnel | — |
| 8 | Croisillons 2mm (x200) | C | optionnel | Variante joint fin (carreaux rectifiés) |

**E1-5 — cet ouvrage ne demande toujours aucune question**, et c'est assumé.
Le moteur retient pour lui la faïence 25 × 40 cm, l'hypothèse déjà écrite au
registre depuis E1-7, et en dérive la consommation de joint (0,228 kg/m² au
lieu des 0,25 kg/m² constants d'avant). La colle en pâte, elle, ne bouge pas :
c'est un adhésif D2 dont la fiche est distincte de celle des mortiers, et sans
question de format sa valeur ne pourrait de toute façon pas varier. Ajouter le
format au carrelage mural resterait à planifier.

**Réintégrés par E1-10** : croisillons (dérivation géométrique) et SEL
(conditionnel par `water_exposure` — le mur d'une douche est aussi exposé que
son sol, NF DTU 52.2, locaux EB+).

**Écartés qu'on pourrait croire nécessaires** :

- Bande d'étanchéité murale (angles verticaux) — le linéaire des angles verticaux d'une paroi n'est connu d'aucune donnée du modèle ; la bande des jonctions sol/mur, elle, est chiffrée côté `floor_tiling` sur le périmètre au sol.
- Joint souple silicone — le cordon sanitaire mural (pourtour de bac, plan de travail) ne se dérive d'aucune grandeur du modèle ; le joint périphérique au sol, lui, est chiffré côté `floor_tiling`.
- Primaire d'accrochage carrelage — selon support mural (peinture, plâtre lisse) : diagnostic sans question honnête en V1 — la question `floor_flatness` parle du sol, pas d'un mur peint.
- Éponge de carreleur — outil pur, pas de rendement du tout.
- Profilé de finition alu / baguette PVC — au linéaire des **angles sortants** du chantier, grandeur inconnue du modèle ; reste en complément (`complementary_materials`, profil de finition).
- Listel décoratif inox — décoratif, au choix du client, au linéaire.
- Croisillons auto-nivelants — grands formats muraux, superflu en 25x40.
- Peigne à colle 6mm — outil pur.

## 5. parquet_flooring — Parquet / stratifié en pose flottante

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Stratifié 8mm AC4 | P | obligatoire | Défaut rénovation pièce à vivre |
| 2 | Sous-couche mousse 3mm | SC | obligatoire | Défaut courant |
| 3 | Film pare-vapeur PE | SC | obligatoire | Support minéral (dalle, chape) — à proscrire sur plancher bois (documenté) |
| 4 | Plinthe MDF 60mm 2.4m | A | obligatoire | E1-10 — au périmètre portes déduites, barre de 2,40 m (TDS Quick-Step) |
| 5 | Barre de seuil alu 93cm | A | obligatoire | E1-10 — une par passage de porte |
| 6 | Ragréage fibré sol | SC | obligatoire (si support à ragréer) | E1-10 — question `floor_flatness` ; fibré : requis sur planchers bois (DTU 51.3, fiche PRB) |
| 7 | Primaire d'accrochage sol | SC | obligatoire (si support à ragréer) | E1-10 — suit le ragréage |
| 8 | Parquet contrecollé chêne 14mm | P | optionnel | Montée en gamme bois véritable |
| 9 | Stratifié 12mm AC5 | P | optionnel | Usage intensif |
| 10 | Plinthe chêne 70mm 2.4m | A | optionnel | Assortie au contrecollé |
| 11 | Plinthe MDF 80mm 2.4m | A | optionnel | Variante haute |
| 12 | Barre de seuil alu 180cm | A | optionnel | Baies larges |

**Réintégrés par E1-10** : plinthes et barres de seuil (assiettes linéaires et
comptées), ragréage fibré + primaire (conditionnels par `floor_flatness`).

**Écartés qu'on pourrait croire nécessaires** :

- Cale de dilatation (x40) — réexaminée par E1-10 : l'assiette linéaire existe désormais, mais la notice de pose Quick-Step, qui impose le jeu de 8-10 mm, **ne publie aucune règle d'espacement des cales** — sans pas sourcé, pas de rendement au mètre. Écartée plutôt qu'inventée (registre, ligne « Cale de dilatation »).
- Ruban adhésif pare-vapeur — sa grandeur est le linéaire de recouvrement des lés du film, qu'aucune donnée du modèle ne porte ; et la fiche du film (Wineo) ne l'exige pas en conditions normales. Le recouvrement des lés, lui, est chiffré (rendement du film 0,8).
- Kit de pose stratifié (cale+tire-lame+maillet) — tire-lame et maillet sont de l'outillage durable.
- Colle parquet — pose collée uniquement, hors sujet en pose flottante.
- Sous-couches acoustique 5mm / liège / fibre de bois — variantes selon exigence acoustique ou support, la mousse 3mm est le défaut.

## 6. drywall — Cloison sèche sur ossature (72/48, simple peau)

| # | Matériau | Rôle | Statut | Note |
|---|---|---|---|---|
| 1 | Plaque BA13 standard 2.5x1.2m | P | obligatoire | Quantité à couvrir : les **deux** faces (moteur) |
| 2 | Rail R48 3m | C | obligatoire | Lisses haute et basse |
| 3 | Montant M48 2.7m | C | obligatoire | Ossature verticale |
| 4 | Vis placo 25mm (x500) | C | obligatoire | La bonne longueur en simple peau sur métal |
| 5 | Bande à joint papier 23m | C | obligatoire | Règle de l'art sur joints neufs |
| 6 | Enduit à joint prêt 7kg | C | obligatoire | — |
| 7 | Laine de verre 45mm | C | obligatoire | E1-10 — le quantitatif Placostil 72/48 (39 dB) l'inclut (« M2 — 1,05 ») ; sans elle la cloison n'atteint pas l'affaiblissement promis |
| 8 | Bande résiliente 50mm | C | obligatoire | E1-10 — « se colle sous les rails » (Knauf) : assiette `frame_runner`, rouleau 30 m |
| 9 | Plaque BA13 hydro 2.5x1.2m | P | optionnel | Pièces humides |
| 10 | Enduit à joint poudre 5kg | C | optionnel | Alternative économique à prise contrôlée |

**Écartés qu'on pourrait croire nécessaires** :

- **Cornière de protection d'angle — écartée, et voici pourquoi (arbitrage E1-10)** : elle ne protège que les **angles sortants**, et le modèle n'en connaît aucun — une cloison est saisie en linéaire × hauteur, une cloison droite n'a pas d'angle sortant, et ni la pièce ni l'ouvrage ne portent cette grandeur. Une question « nombre d'angles sortants » à défaut 0 produirait une ligne à zéro sur presque tous les chantiers — du bruit, pas un achat ; la lier en optionnel exigerait au registre une assiette qu'aucun driver ne peut dire honnêtement. Si le besoin se confirme, la porte d'entrée est une question dédiée sur l'ouvrage.
- Vis placo 35mm / 45mm — double peau ou rechargement uniquement.
- Enduit de finition placo — selon le niveau de finition exigé ; la finition courante avant peinture s'arrête à l'enduit à joint.
- Bande armée fibre — angles exposés aux chocs, pas les joints courants ; même grandeur inconnue que la cornière.
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
