# Sources du catalogue V1 — registre des rendements (E1-7)

Chaque matériau **lié à un ouvrage** (`work_type_materials`, curation E1-3) a une
ligne ici : rendement seedé vérifié contre une fiche technique fabricant réelle,
chargée en ligne, avec URL et date de consultation. Un matériau dont le
rendement n'a pas pu être sourcé est **sorti du périmètre V1** (décision
`retirer`, migration `…071`) — il reste au catalogue mais n'est plus servi par
les listes des 7 ouvrages.

**Périmètre V1 assumé après E1-7 : 35 matériaux liés (37 liaisons), dont
21 obligatoires chiffrés automatiquement.** Les 14 matériaux retirés sont les
outils purs et les consommables dont la grandeur fabricant n'est pas surfacique
(linéaire ou non normée). Le reste du catalogue (208 entrées) n'est pas servi
par la V1 et n'est pas couvert par ce registre.

**Sémantique** : `yield_per_unit` = quantité d'**assiette** couverte par unité
d'achat (L, kg, m, m², sachet, boîte, seau). Le moteur calcule
`qty = assiette / yield`, puis multiplie par le nombre de couches si
`applies_coats` (les rendements peinture des fiches sont par couche — vérifié),
puis applique le facteur de perte.

Depuis E1-3, l'assiette est nommée par matériau
(`materials_catalog.quantity_driver`) et c'est elle qui donne son unité au
rendement :

| `quantity_driver` | assiette | rendement exprimé en |
| --- | --- | --- |
| `work_surface` (défaut) | surface de l'ouvrage | m² d'ouvrage par unité |
| `clad_faces` | surface × nombre de faces à parementer | m² **de parement** par unité |
| `frame_runner` | `runner_courses` × longueur | m de lisse par unité |
| `frame_stud` | nombre de montants × hauteur | m de montant par unité |

**Les huit lignes `partition` ci-dessous ont donc changé d'unité en E1-3
(migration `…080`), pas de contenu.** Les fiches Placo® donnent leurs ratios
« par m² de cloison, deux faces comprises » : le facteur 2 était cuit dans le
rendement, il est désormais porté par l'assiette. Chaque valeur de parement est
l'ancienne × 2, chaque valeur d'ossature vaut 1 (un mètre de rail couvre un
mètre de lisse) — **à deux faces, le taux par m² de cloison est inchangé au
chiffre près**. La citation fabricant et la date de consultation, elles, n'ont
pas bougé.

**Hypothèses écrites** (chaque valeur en dépend) :

- `floor_tiling` : carreau par défaut 45 × 45 cm, sol intérieur — la fiche
  colle impose le **double encollage** pour ce format, la consommation retenue
  l'inclut. `wall_tiling` : faïence 25 × 40 cm, mur intérieur, double encollage
  également (fiche).
- `drywall` : cloison Placostil® 72/48, **simple peau**, montants simples,
  hauteur ≤ 2,6 m (fiche solution Placo® ; conforme à
  `docs/MATERIAUX_OUVRAGES.md` §6). Les ratios de la fiche sont « par m² de
  cloison, deux faces » ; les rendements seedés, eux, sont par m² de **parement**
  ou par mètre de trame depuis E1-3 — la conversion est écrite ligne par ligne.
  Le nombre de faces n'est plus une hypothèse : il est saisi
  (`project_work_items.declared_clad_faces`). L'entraxe 0,60 m non plus : il est
  déclaré par l'ouvrage (`work_types.frame_spec`). En montants doublés dos à
  dos, la consommation de montants double — non couvert par la V1.
- `Colle papier peint intissé` : les conditionnements seedés (seaux 5 et
  10 kg) désignent une **colle en pâte prête à l'emploi** (≈ 8 m²/kg, Quelyd
  Perfect). Une poudre à diluer ferait 100-160 m²/kg (fiches Quelyd Intissé /
  Semin) mais se vend en étuis de 250-300 g — incompatible avec les seaux
  seedés. La lecture pâte est retenue et écrite ici.
- `Film pare-vapeur PE` : lé de 1 m (Wineo), recouvrement ≥ 20 cm imposé par
  les fiches (Wineo, Tarkett) → 1 m² de film couvre 0,8 m² de sol.
- Les produits vendus au m² et posés bord à bord (carrelages, papiers peints,
  stratifiés, sous-couche, laine) ont un rendement **définitionnel** de
  1 m²/m² : la fiche sert à confirmer l'unité de vente et la pose, pas un
  chiffre de rendement.
- Accès : `placo.fr` et `isover.fr` refusent les clients non-navigateur
  (403) ; leurs documents ont été lus via une copie Wayback Machine
  octet-à-octet de l'URL fabricant indiquée. Tous les autres domaines ont été
  chargés en direct le jour de la consultation.

## Registre

| Matériau | Catégorie | Rendement V1 | Assiette | Fiche technique | Décision | Source | Consulté le |
|---|---|---|---|---|---|---|---|
| Peinture acrylique mate | painting | 11 | surface d'ouvrage | Dulux Valentine Crème de Couleur Mat Velouté : « Rendement ≈11m²/L » | conserver | https://www.duluxvalentine.com/fr/produits/cr%C3%A8me-de-couleur-mat-velout%C3%A9 | 2026-08-03 |
| Peinture acrylique satinée | painting | 11 | surface d'ouvrage | Dulux Valentine Crème de Couleur Satin : « Rendement ±11m²/L » | conserver | https://www.duluxvalentine.com/fr/produits/cr%C3%A8me-de-couleur-satin | 2026-08-03 |
| Peinture acrylique velours | painting | 10 | surface d'ouvrage | Zolpan Cofavelours Évolution : « 10 à 12 m²/L/couche, selon nature et état de surface du support. » | conserver | https://www.zolpan.fr/produit/cofavelours-evolution | 2026-08-03 |
| Peinture cuisine et salle de bain | painting | 10 | surface d'ouvrage | Dulux Valentine Crème de Couleur Cuisine et Bain Satin : « Rendement ±10m²/L » (V33 Blanc Cuisine & Bain : 12 m²/L) | corriger (9 → 10) | https://www.duluxvalentine.com/fr/produits/cr%C3%A8me-de-couleur-cuisine-et-bain-satin | 2026-08-03 |
| Peinture plafond mate | painting | 10 | surface d'ouvrage | Ripolin Peinture Plafonds Cuisine & Salle de Bain Mat : « Rendement : 10 m²/L (NF 30 073) » | conserver | https://ripolin.fr/produit/peinture-plafonds-cuisine-salle-de-bain-mat | 2026-08-03 |
| Peinture plafond anti-traces | painting | 10 | surface d'ouvrage | V33 Blanc Perfection® : « Rendement (m²/L) 10 » ; corroboré Dulux Valentine Plafond Finition Parfaite (50 m² pour 5 L) | corriger (12 → 10) | https://www.v33.fr/blanc-perfection-r-peinture-plafond.html | 2026-08-03 |
| Sous-couche universelle | painting | 10 | surface d'ouvrage | Ripolin Sous-Couche Universelle Mat : « Rendement : 10 m²/L » | conserver | https://ripolin.fr/produit/sous-couche-universelle-mat | 2026-08-03 |
| Carrelage sol 45x45 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Carrelage sol 30x30 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Carrelage sol 60x60 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Carrelage imitation bois 20x120 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Faïence murale 25x40 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Carrelage métro 7.5x15 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Carrelage mural 20x40 cm | tiling | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Mortier-colle flexible (C2) | tiling | 0.14 | surface d'ouvrage | Cermix CERMIFLEX (C2S1ET), sol intérieur, carreau 1 200-2 200 cm² : « 7 (U9) » kg/m² en double encollage — le 45×45 (2 025 cm²) tombe dans cette colonne | corriger (0.22 → 0.14) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIFLEX.pdf | 2026-08-03 |
| Colle en pâte prête à l'emploi | tiling | 0.22 | surface d'ouvrage | Cermix CERMIFIX (D2ET), mur intérieur, carreau 500-1 200 cm² : « 4,5 (U6) » kg/m² en double encollage — la faïence 25×40 (1 000 cm²) tombe dans cette colonne | corriger (0.4 → 0.22) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIFIX.pdf | 2026-08-03 |
| Joint fin 1-6mm | tiling | 4 | surface d'ouvrage | Cermix CERMIJOINT COLOR (1-6 mm), carreau 45×45, joint 2-3 mm : 0,1-0,2 kg/m² ; PRB JOINT FR : « de 250 à 900 g/m² » — 0,25 kg/m² retenu, prudent | corriger (2.5 → 4) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIJOINT_COLOR.pdf | 2026-08-03 |
| Joint souple silicone | tiling | — | surface d'ouvrage | Bostik S300 Bain & Cuisine : « 12 m environ de cordon de diamètre 5 mm » par cartouche 300 ml — grandeur linéaire, aucun fabricant ne publie de rendement en m² | retirer (grandeur fiche linéaire) | https://www.bostik.com/files/live/sites/shared_bostik/files/documents-brochures/France/Documents/TDS/FT%20BOSTIK_S300%20BAIN%20CUISINE%20CERAMIQUE.pdf | 2026-08-03 |
| Croisillons 2mm (x200) | tiling | — | surface d'ouvrage | Sachet de 200 confirmé (Raimondi) mais aucune table de consommation par m² chez Rubi, Raimondi ni Taliaplast | retirer (non sourçable) | — | 2026-08-03 |
| Croisillons 3mm (x200) | tiling | — | surface d'ouvrage | Idem croisillons 2 mm | retirer (non sourçable) | — | 2026-08-03 |
| Éponge de carreleur | tiling | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Peigne à colle 10mm | tiling | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Stratifié 8mm AC4 | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Stratifié 12mm AC5 | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Parquet contrecollé chêne 14mm | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Sous-couche mousse 3mm | flooring | 1 | surface d'ouvrage | Quick-Step (FT Basic Plus + FT NETAPE50) : pose bord à bord sans chevauchement (« les bandes … doivent être parfaitement adjacentes ») ; « 1 rouleau = 15 m² » = sa surface | conserver (définitionnel) | https://www.quick-step.fr/-/media/Imported%20Assets/Flooring/9/6/5/TDSAccNETAPE50SelfadhesiveTapeFRpdf49942.ashx?rev=867c7b1de3ff4881ace0453be4832f00&type=original&filename=Informations+techniques.pdf | 2026-08-03 |
| Film pare-vapeur PE | flooring | 0.8 | surface d'ouvrage | Wineo PE-Dampfbremse : lé 1,00 m, « > 20 cm Stoßüberlappung » ; Tarkett : « chevauchement d'au moins 200 mm » → (1,00 − 0,20)/1,00 = 0,80 | corriger (1 → 0.8) | https://www.wineo.de/content/Dokumente/Zubehoer/Technische%20Datenblaetter/DE/PE-Dampfbremse-02-2019.pdf | 2026-08-03 |
| Ruban adhésif pare-vapeur | flooring | — | surface d'ouvrage | Aucune règle de consommation chiffrée en fiche (Quick-Step NETAPE50, Ursa UNI TAPE) ; Wineo : adhésivage non requis en conditions normales | retirer (non sourçable) | https://www.quick-step.fr/-/media/Imported%20Assets/Flooring/9/6/5/TDSAccNETAPE50SelfadhesiveTapeFRpdf49942.ashx?rev=867c7b1de3ff4881ace0453be4832f00&type=original&filename=Informations+techniques.pdf | 2026-08-03 |
| Cale de dilatation (x40) | flooring | — | surface d'ouvrage | Quantité au périmètre de la pièce, pas à la surface : pas de rendement en m²/unité | retirer (grandeur non surfacique) | — | 2026-08-03 |
| Plaque BA13 standard 2.5x1.2m | partition | 0.96 | parement | Placo® Fiche Solution Placostil® 72/48 BA13 (1 m² d'ouvrage) : « Placoplatre® BA 13 — M2 — 2,10 » (deux faces simple peau) → 1,05 m² par m² de parement | ré-exprimer par m² de parement (0.48 → 0.96) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Plaque BA13 hydro 2.5x1.2m | partition | 0.96 | parement | Ratio du système standard (2,10 m²/m², deux faces) ; variante hydro confirmée à géométrie identique (Knauf KM 72/48 KH13 : « une plaque … par côté ») | ré-exprimer par m² de parement (0.48 → 0.96) | https://tools.knauf.fr/file/71742/download?token=vZzSxXQF | 2026-08-03 |
| Rail R48 3m | partition | 1 | lisses | Placo® Fiche Solution 72/48 : « Rail Stil® R 48 — M — 0,90 » par m² de cloison — ratio valable à une hauteur donnée seulement ; depuis E1-3 la lisse est métrée sur le linéaire réel (2 × longueur), et un mètre de rail couvre un mètre de lisse | ré-exprimer par m de lisse (1.11 → 1) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Montant M48 2.7m | partition | 1 | montants | Placo® Fiche Solution 72/48 : « Montant Stil® ML 48-50 — M — 2,10 » (montants simples, entraxe 0,60) — les 2,10 m/m² étaient l'entraxe replié sur une surface ; depuis E1-3 les montants se comptent `ceil(longueur / entraxe) + 1` et se mesurent sur la hauteur | ré-exprimer par m de montant (0.48 → 1) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Vis placo 25mm (x500) | partition | 45.4 | parement | Placo® Fiche Solution 72/48 : « Vis TTPC 25 — UN — 22,00 » par m² (deux faces) → 11 vis par m² de parement, en boîtes de 500 → 500 ÷ 11 ≈ 45,4 | ré-exprimer par m² de parement (22.7 → 45.4) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Bande à joint papier 23m | partition | 0.72 | parement | Placo® Fiche Solution 72/48 : « Bande PP grand Rouleau — M — 2,80 » par m² (deux faces ; joints, cueillies et angles inclus) → 1,40 m par m² de parement | ré-exprimer par m² de parement (0.36 → 0.72) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Enduit à joint prêt 7kg | partition | 2 | parement | Placo® Placomix® : « Consommation minimum 470 g/m² » de parement ; corroboré Siniat PRÉGY S PE (0,40-0,45 kg/m²). La valeur retenue, 0,50 kg par m² de parement, est celle qui reconduit exactement le 1 kg/m² de cloison seedé par E1-7 | ré-exprimer par m² de parement (1 → 2) | https://www.placo.fr/Produits/enduits-joint/placomixr-5kg | 2026-08-03 |
| Enduit à joint poudre 5kg | partition | 3.04 | parement | Placo® Fiche Solution 72/48 : « Placojoint® PR4 25kg — KG — 0,66 » par m² de cloison (deux faces) → 0,33 kg par m² de parement | ré-exprimer par m² de parement (1.52 → 3.04) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Laine de verre 45mm | partition | 1 | surface d'ouvrage | Vendue au m² (Isover PAR PHONIC 45 mm, rouleau 0,6 × 13 m), posée entre montants sans recouvrement ; le quantitatif Placo compte 1,05 (chutes portées ici par les facteurs de perte) | conserver (définitionnel) | https://www.isover.fr/produits/laine-de-verre/par-phonic | 2026-08-03 |
| Papier peint intissé uni | wall_covering | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel (les chutes de raccord relèvent des facteurs de perte) | conserver (définitionnel) | — | 2026-08-03 |
| Papier peint intissé à motif | wall_covering | 1 | surface d'ouvrage | Idem, facteur de chute « patterned » du catalogue | conserver (définitionnel) | — | 2026-08-03 |
| Papier peint vinyle sur intissé | wall_covering | 1 | surface d'ouvrage | Idem | conserver (définitionnel) | — | 2026-08-03 |
| Colle papier peint intissé | wall_covering | 8 | surface d'ouvrage | Quelyd Perfect (pâte prête à l'emploi, guide Bostik 2024) : « Envers intissés — 11 [rouleaux] — 55 [m²] » par seau 7 kg ≈ 7,9 m²/kg — lecture pâte imposée par les seaux seedés (voir hypothèses) | corriger (30 → 8) | https://www.bostik.com/files/live/sites/shared_bostik/files/documents-brochures/France/Brochures/C&C/GUIDE%20SOLUTIONS%20PRO%202024%20QUELYD%20COLLES%20MURALES.pdf | 2026-08-03 |
| Rouleau méché 180mm | painting | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Pinceau à rechampir 25mm | painting | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Ruban de masquage 50m | painting | — | surface d'ouvrage | Consommation au périmètre et aux ouvertures, pas à la surface | retirer (grandeur non surfacique) | — | 2026-08-03 |
| Bâche de protection 4x5m | painting | — | surface d'ouvrage | Protège le sol, pas la surface peinte : quantité non proportionnelle | retirer (grandeur non surfacique) | — | 2026-08-03 |
| Brosse à maroufler | wall_covering | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Roulette de joint | wall_covering | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Cutter de précision | wall_covering | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |

## Encadrements de consommation : le pendant exécutable de ce registre

Ce registre dit ce que le catalogue **retient**. Il ne dit pas ce qu'une
consommation **peut** valoir — et c'est cette seconde information, seule, qui
permet à un test de constater qu'un rendement a dérivé. Sans elle, un rendement
faux produit une liste d'achat parfaitement plausible : c'est ainsi que douze
des vingt et un rendements ci-dessus ont vécu jusqu'à E1-7 sous 1 619 tests
verts.

`apps/api/src/materials/consumption-bounds.data.ts` porte donc, matériau par
matériau, un intervalle `min_per_m2` / `max_per_m2` — la consommation par m²
d'ouvrage et par couche — assorti de la phrase de fiche dont il est tiré. Le
harnais de non-régression du moteur (invariant I3,
`estimations/__tests__/seeded-catalog-harness.ts`) échoue hors de cet
intervalle, et échoue également sur un matériau lié qui n'en déclare aucun.

Une règle décide de tout : **une borne vient de l'étalement des chiffres publiés
par les fabricants sur l'hypothèse d'ouvrage écrite plus haut, jamais de la
valeur seedée ± une tolérance.** Une borne calée sur le seed ne peut rien
attraper — elle vérifie que le catalogue est égal à lui-même.

Un encadrement déjà violé, et assumé comme tel : `Joint fin 1-6mm` consomme
0,25 kg/m² quels que soient le format du carreau et la largeur de joint, quand
la ligne du registre ci-dessus cite elle-même « carreau 45×45, joint 2-3 mm :
0,1-0,2 kg/m² » et note que 0,25 a été « retenu, prudent ». La violation est
énumérée dans les suites du harnais, à supprimer le jour où le rendement du
joint suivra la géométrie de la pose.

## Facteurs de perte : statut

Les `waste_factors` seedés (6 familles, 9 triplets pose × niveau,
`seed-catalog.data.ts:46-113`) sont des **valeurs d'usage métier, sans
référence normative** : aucun DTU ne fixe de pourcentage de perte, et
l'appellation « catalogue DTU » a été retirée du code et de la documentation
par E1-7 (la seule référence DTU réelle du dépôt, le DTU 52.2 cité pour le SEL
en zone douche, concerne l'étanchéité, pas les pertes). Ces valeurs sont
étalonnées depuis ENG-5, prudentes pour un débutant, et sont affinées par les
facteurs **appris** sur les achats réels (DATA-3, `learned_waste_factors`) —
c'est ce mécanisme, pas une norme, qui les rapproche du terrain.

## Temps unitaires de main-d'œuvre : statut (E2-3)

`work_types.labor_minutes_per_m2` (migration `…072`) propose, par ouvrage, un
temps de pose indicatif en minutes par m² — utilisé pour préremplir une ligne
de MO du devis à partir de la surface de l'ouvrage. **Ce ne sont pas des
rendements sourcés au sens du registre ci-dessus** : il n'existe pas de fiche
technique fabricant pour un temps de pose, contrairement à un rendement
matière. Ces valeurs ont le même statut que les `waste_factors` de la section
précédente — des ordres de grandeur métier, sans référence normative — et sont
documentées ici pour la même raison : ne jamais laisser croire qu'un chiffre
métier est une donnée sourcée.

| Ouvrage | min/m² | Hypothèse |
| --- | --- | --- |
| `wall_painting` | 8 | Peinture murale, 2 couches, protection et rechampi compris, artisan seul |
| `ceiling_painting` | 10 | Peinture plafond, 2 couches, travail en hauteur |
| `wall_covering` | 15 | Revêtement mural, intissé, lés pleins |
| `parquet_flooring` | 20 | Parquet/stratifié, pose flottante, sous-couche comprise |
| `drywall` | 35 | Cloison sèche Placostil® 72/48, simple peau 2 faces, bandes comprises |
| `floor_tiling` | 40 | Carrelage sol 45 × 45, double encollage (même hypothèse que le registre ci-dessus) |
| `wall_tiling` | 50 | Carrelage mural, faïence 25 × 40, plus de découpes qu'au sol |

Nullable et jamais un défaut à l'échelle du produit : si la colonne est vide
pour un ouvrage (le 8e ouvrage d'une future extension, par exemple), aucune
ligne de MO n'est proposée pour cet ouvrage plutôt que d'en inventer une à
0 min — l'UI l'affiche comme un temps indicatif, modifiable ligne à ligne.

## Réintégrer un matériau retiré

Deux portes, toutes deux hors périmètre V1 (mise à jour de
`docs/BACKLOG_V1.md` requise) :

- **Rappel d'achat forfaitaire** : `complementary_materials` porte déjà des
  quantités par défaut indépendantes de la surface (bac à peinture, profil de
  finition, barre de seuil) — le mécanisme naturel pour « un jeu d'outils par
  chantier ».
- **Rendement sourcé** : si un fabricant publie un jour une table de
  consommation au m² (croisillons par format, par exemple), ajouter la ligne
  ici puis re-lier le matériau.
