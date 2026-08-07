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
  **E1-5 — ces deux formats ne sont plus des hypothèses figées, ils sont des
  défauts.** `floor_tiling` demande désormais le format du carreau et la
  largeur de joint, et le moteur en dérive la consommation de colle et de joint
  (`estimations/tile-consumption.ts`). Les deux valeurs ci-dessus restent ce
  qu'on retient quand la question n'est pas posée — `wall_tiling` — ou pas
  répondue, et ce sont les géométries auxquelles les encadrements de la section
  « Encadrements de consommation » sont énoncés. Cf. la section
  « Consommation pilotée par la géométrie du carreau (E1-5) » plus bas.
- `drywall` : cloison Placostil® 72/48, **simple peau**, montants simples,
  hauteur ≤ 2,6 m (fiche solution Placo® ; conforme à
  `docs/MATERIAUX_OUVRAGES.md` §6). Les ratios de la fiche sont « par m² de
  cloison, deux faces » ; les rendements seedés, eux, sont par m² de **parement**
  ou par mètre de trame depuis E1-3 — la conversion est écrite ligne par ligne.
  Le nombre de faces n'est plus une hypothèse : il est saisi
  (`project_work_items.declared_clad_faces`). L'entraxe 0,60 m non plus : il est
  déclaré par l'ouvrage (`work_types.frame_spec`). En montants doublés dos à
  dos, la consommation de montants double — non couvert par la V1.
- `wall_covering` : rouleau standard européen 10,05 × 0,53 m, papier posé bord
  à bord (les intissés ne se recouvrent pas), hauteur sous plafond de la pièce,
  arasement de 10 cm par lé.
  **E1-6 — ces valeurs ne sont plus des hypothèses de rendement, ce sont des
  données.** Les dimensions du rouleau vivent dans
  `materials_catalog.roll_width_cm` / `roll_length_cm`, le raccord de motif et
  la marge de coupe sont demandés à l'ouvrage, et le moteur en dérive un nombre
  de lés. Cf. la section « Comptage en lés (E1-6) » plus bas.
- `Colle papier peint intissé` : les conditionnements seedés (seaux 5 et
  10 kg) désignent une **colle en pâte prête à l'emploi** (≈ 8 m²/kg, Quelyd
  Perfect). Une poudre à diluer ferait 100-160 m²/kg (fiches Quelyd Intissé /
  Semin) mais se vend en étuis de 250-300 g — incompatible avec les seaux
  seedés. La lecture pâte est retenue et écrite ici.
- `Film pare-vapeur PE` : lé de 1 m (Wineo), recouvrement ≥ 20 cm imposé par
  les fiches (Wineo, Tarkett) → 1 m² de film couvre 0,8 m² de sol.
- Les produits vendus au m² et posés bord à bord (carrelages, stratifiés,
  sous-couche, laine) ont un rendement **définitionnel** de 1 m²/m² : la fiche
  sert à confirmer l'unité de vente et la pose, pas un chiffre de rendement.
  **E1-6 a retiré les papiers peints de cette liste** : ils sont vendus au
  rouleau et non au mètre carré, et un rouleau ne rend pas sa surface en mur
  couvert — il rend un nombre entier de lés.
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
| Mortier-colle flexible (C2) | tiling | 0.14 | surface d'ouvrage | Cermix CERMIPLUS 2.0 (C2, « CONFORME À LA NORME EN 12004 »), sol intérieur, carreau 1 200-2 200 cm² : « 7 (U9) » kg/m² en double encollage — le 45×45 (2 025 cm²) tombe dans cette colonne | conserver (E1-5 : rendement à la géométrie de référence) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIPLUS-2.0_V2.pdf | 2026-08-07 |
| Mortier-colle standard (C1) | tiling | 0.14 | surface d'ouvrage | Cermix CERMICOL EXTRA (**C1 E**), sol intérieur, carreau 1 200-2 200 cm² : « 7 (U9) » — table identique à celle des C2, la classe de colle ne change pas la consommation | corriger (0.25 → 0.14) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMICOL_EXTRA.pdf | 2026-08-07 |
| Mortier-colle rapide (C2F) | tiling | 0.14 | surface d'ouvrage | Cermix CERMIPLUS RAPID, sol intérieur, carreau 1 200-2 200 cm² : « 7 (U9) » — table identique à CERMIPLUS 2.0 | corriger (0.25 → 0.14) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIPLUS_RAPID.pdf | 2026-08-07 |
| Mortier-colle grand format (C2S1) | tiling | 0.14 | surface d'ouvrage | Cermix CERMIFLEX (**C2S1 ET**), sol intérieur, carreau 1 200-2 200 cm² : « 7 (U9) » ; 2 200-3 600 cm² : « 8 (E10) » — c'est le format, pas la classe, qui fait la surconsommation | corriger (0.15 → 0.14) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIFLEX.pdf | 2026-08-07 |
| Colle en pâte prête à l'emploi | tiling | 0.22 | surface d'ouvrage | Cermix CERMIFIX (D2ET), mur intérieur, carreau 500-1 200 cm² : « 4,5 (U6) » kg/m² en double encollage — la faïence 25×40 (1 000 cm²) tombe dans cette colonne | corriger (0.4 → 0.22) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIFIX.pdf | 2026-08-03 |
| Joint fin 1-6mm | tiling | 5 | surface d'ouvrage | Cermix CERMIJOINT COLOR (CG2WA, 1-6 mm), cellule « carreau 45×45, joint 3 mm » : 0,2 kg/m² — et la formule de la même fiche, « 0,17 × ép(mm) × largeur de joint(mm) × (L + l)/(L × l) », vaut 0,204 kg/m² à cette géométrie avec une épaisseur de 9 mm | corriger (4 → 5) | https://www.cermix.com/wp-content/uploads/2020/02/FT_CERMIJOINT_COLOR.pdf | 2026-08-07 |
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
| Papier peint intissé uni | wall_covering | 1 | surface d'ouvrage | **E1-6 : `yield_per_unit` n'est plus lu.** Vendu au rouleau 10,05 × 0,53 m (`roll_length_cm` 1005, `roll_width_cm` 53) et débité en lés entiers ; la quantité vient de la découpe, pas d'un rendement au m². Bricoflor : « Un rouleau de papier peint de taille standard en Europe présente une longueur de 10,05 mètres. La largeur de lés est de 0,53 m » | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint intissé à motif | wall_covering | 1 | surface d'ouvrage | Idem, plus le raccord de motif saisi (`pattern_repeat_cm`) qui allonge chaque lé ; facteur de chute « patterned » du catalogue inchangé | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint vinyle expansé | wall_covering | 1 | surface d'ouvrage | Idem — même rouleau standard | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint vinyle sur intissé | wall_covering | 1 | surface d'ouvrage | Idem — même rouleau standard | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint intissé texturé | wall_covering | 1 | surface d'ouvrage | Idem — même rouleau standard | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint traditionnel | wall_covering | 1 | surface d'ouvrage | Idem — même rouleau standard | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier d'apprêt lisse | wall_covering | 1 | surface d'ouvrage | Compté en lés lui aussi, mais sur **son** rouleau : 10 × 0,50 m et non 10,05 × 0,53 m. C'est le conditionnement qui justifie que les dimensions soient une propriété du matériau et non une constante du moteur | ré-exprimer (compté en lés) | https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il | 2026-08-07 |
| Papier peint panoramique | wall_covering | 1 | surface d'ouvrage | **Pas de dimensions de rouleau** : vendu en panneaux calepinés sur le mur, pas en bobine à débiter. Reste au calcul surfacique | conserver (définitionnel) | — | 2026-08-07 |
| Toile de verre maille | wall_covering | 1 | surface d'ouvrage | **Pas de dimensions de rouleau** : deux longueurs de bobine (25 et 50 m²) pour la même référence, qu'un seul couple de dimensions par matériau ne peut pas décrire. Leur en inventer un chiffrerait faux la moitié des achats. Reste au calcul surfacique | conserver (définitionnel) | — | 2026-08-07 |
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

**E1-5 — l'encadrement violé a été refermé, et la portée des bornes a changé.**
`Joint fin 1-6mm` consommait 0,25 kg/m² quels que soient le format du carreau
et la largeur de joint, quand la ligne du registre citait elle-même
« 0,1-0,2 kg/m² ». Le rendement suit désormais la géométrie, et les deux
violations `[I3]` du harnais ont été supprimées, pas mises à jour.

En contrepartie, un matériau qui porte une loi de consommation
(`materials_catalog.consumption_model`) n'a plus *une* consommation mais une
courbe : la même colle va de 4,5 à 8 kg/m² selon le format, et le même joint
varie d'un facteur 6. Un intervalle qui contiendrait toute la courbe ne
prouverait plus rien. Les bornes de ces matériaux encadrent donc la
consommation **à la géométrie par défaut de l'ouvrage** — celle qu'obtient un
utilisateur qui répond « Recommandé pour ce format ». Le reste de la courbe est
éprouvé cellule par cellule contre les tables fabricant dans
`estimations/tile-consumption.spec.ts`, ce qui est plus exigeant qu'un
intervalle.

**E1-6 étend la même doctrine au papier peint.** Un matériau vendu au rouleau
(`materials_catalog.roll_width_cm`) n'a plus de rendement du tout : sa quantité
est une découpe, qui dépend de la hauteur sous plafond et du raccord de motif.
Son encadrement change donc de grandeur — des m² de **papier acheté** par m² de
mur, et non plus des m² posés par m² posés — et n'encadre lui aussi que la
géométrie par défaut de l'ouvrage. Cf. « Comptage en lés (E1-6) ».

## Consommation pilotée par la géométrie du carreau (E1-5)

Le format du carreau était demandé, obligatoire, stocké — et lu par aucun
calcul. Il pilote désormais la colle et le joint. Deux lois, portées par
`materials_catalog.consumption_model`, dont les tables et les citations vivent
dans `estimations/tile-consumption.ts`.

**Ce que devient `yield_per_unit` pour ces matériaux.** Il cesse d'être « le
rendement » pour devenir « le rendement **à la géométrie de référence du
modèle** ». Le catalogue garde le niveau, le moteur porte la forme :

    rendement effectif = yield_per_unit / facteur(géométrie)

Le facteur vaut 1 à la référence — un 45 × 45 posé au sol avec son joint
recommandé chiffre donc exactement ce que le registre ci-dessus annonce.

| Modèle | Géométrie de référence | Consommation à la référence |
| --- | --- | --- |
| `tile_adhesive` | 45 × 45 cm, sol intérieur, double encollage | 7 kg/m² (seedé 0,14 → 7,14) |
| `tile_grout` | 45 × 45 cm, épaisseur 9 mm, joint 3 mm | 0,2 kg/m² (seedé 5) |

### Double encollage : seuil retenu et source

Le mode d'encollage **n'est pas demandé à l'utilisateur** : c'est une
obligation de mise en œuvre, pas une préférence. Il est déduit du format et de
la destination.

| Destination | Double encollage obligatoire |
| --- | --- |
| Mur intérieur | **S ≥ 500 cm²**, seuil sec |
| Sol intérieur | **S > 1 200 cm²** quelle que soit la porosité ; **500 ≤ S ≤ 1 200 cm²** si porosité < 0,5 % |
| Extérieur | S > 50 cm² — hors périmètre V1, aucun ouvrage ne pose en extérieur |

**Source** : NF DTU 52.2 (juin 2022), « Pose collée des revêtements céramiques
et assimilés — Pierres naturelles ». **Le texte intégral est payant et n'a pas
été lu** ([boutique CSTB](https://boutique.cstb.fr/Detail/Documents-Techniques-Unifies/DTU-NF-DTU/52-Revetements-durs/NF-DTU-52-2-Pose-collee-des-revetements-ceramiques)).
Les seuils viennent du mémento « Les points-clés — LA RÉGLEMENTATION DTU 52.2 »,
retrouvé **identique sur deux hôtes indépendants**, ce qui écarte l'erreur de
transcription d'un seul site :
<https://checkmy-house.fr/wp-content/uploads/2021/08/DTU-52.2.pdf> et
<https://carrelage-au-carre.com/pdf/extraits-dtu-52-2.pdf> (consultés le
2026-08-07). Verbatim, murs intérieurs : « Double encollage obligatoire à
partir de 500 cm², que ce soit avec un mortier-colle (jusqu'à 3 600 cm²) ou un
adhésif (jusqu'à 2 200 cm²). » Sols : « En intérieur au-delà de 1 200 cm²
quelle que soit la porosité. En intérieur entre 500 et 1 200 cm² uniquement si
la porosité < 0,5 (ou < 2,0 pour la pierre naturelle). »

**Écarté explicitement** : le seuil de 900 cm² / 30 × 30 cm que répètent
plusieurs pages marchandes n'est corroboré par aucune des deux copies du
mémento, et les pages qui l'avancent se contredisent entre elles.

**Hypothèse assumée** : le catalogue ne porte pas la porosité de ses carreaux.
Les carrelages sol seedés sont du grès cérame, dont la porosité est couramment
inférieure à 0,5 % : la tranche 500-1 200 cm² bascule donc en double encollage.
`LOW_POROSITY_ASSUMED` rend l'hypothèse lisible dans le code, et il n'y aura
qu'un prédicat à brancher le jour où la porosité sera saisie.

**Surconsommation du double encollage : +1,5 kg/m², additive et non
multiplicative.** Note (1) des fiches Cermix : « Double encollage si carreaux à
faible porosité (DTU 52.2) : soit une consommation supplémentaire de 1 à
1.5 kg/m² ». Les fabricants qui publient deux colonnes distinctes donnent le
même écart : Weber webercol flex +1,5 exactement sur ses trois lignes
(3 → 4,5 ; 4 → 5,5 ; 5 → 6,5), Mapei KERAFLEX +1,5, PRB +1,5 à +2,5. Un
facteur multiplicatif constant calé sur le petit format (× 1,5) surestimerait
la colle de 15 à 20 % au-delà de 1 200 cm².

### Colle : la classe ne change pas la consommation, le format oui

C'est le résultat qui décide du volet catalogue. **Quatre fiches Cermix de
classes différentes publient la même table** de consommation en sol intérieur,
consistance normale :

| Produit | Classe | ≤ 300 | 300-500 | 500-1 200 | 1 200-2 200 | 2 200-3 600 |
| --- | --- | --- | --- | --- | --- | --- |
| CERMICOL EXTRA | C1 E | 3,5 (U6) | 4,5 (U9) | 4,5 (U9)¹ | 7 (U9) | — |
| CERMIPLUS 2.0 | C2 | 3,5 | 4,5 | 4,5¹ | 7 | 8 (E10) |
| CERMIPLUS RAPID | C2 rapide | 3,5 | 4,5 | 4,5¹ | 7 | 8 (E10) |
| CERMIFLEX | C2S1 ET | 3,5 | 4,5 | 4,5¹ | 7 | 8 (E10) |

La consommation dépend du **peigne**, que le format sélectionne, et du mode
d'encollage. Les quatre mortiers-colle seedés portent donc le même rendement de
référence, `0,14`, et ce qui les sépare à l'usage est le format sur lequel on
les pose :

| Format | Surface | Encollage | Colle |
| --- | --- | --- | --- |
| 20 × 20 | 400 cm² | simple | 4,5 kg/m² |
| 30 × 30 | 900 cm² | double (porosité) | 6,0 kg/m² |
| 45 × 45 | 2 025 cm² | double | 7,0 kg/m² |
| 30 × 60 | 1 800 cm² | double | 7,0 kg/m² |
| 60 × 60 | 3 600 cm² | double | 8,0 kg/m² |

**C'est la correction de l'inversion du « grand format ».** Le C2S1 était seedé
à `0,15`, soit 6,67 kg/m², donc **moins** que le C2 à `0,14` (7,14) : un
mortier grand format qui consommait moins que le standard. Aucune fiche lue ne
fait dépendre la consommation de la classe de colle — l'inversion ne se corrige
donc pas en faisant consommer plus le C2S1 à format égal, mais en exprimant
toute la famille à une référence commune et en laissant le format faire son
travail. Sur un 60 × 60, le grand format demande bien 8 kg/m² contre 7 pour un
45 × 45.

### Joint : la formule fabricant

    consommation (kg/m²) = ((L + l) / (L × l)) × e × j × d

L, l, e (épaisseur du carreau) et j (largeur de joint) en millimètres, `d` la
densité apparente du mortier de jointoiement. C'est la formule que **neuf
fabricants publient à l'identique**. Cermix l'imprime sur chaque fiche sous la
forme « 0,17 × ép(mm) × largeur de joint(mm) × (L + l)/(L × l) » avec L et l en
centimètres — algébriquement la même, avec `d = 1,7`. Bostik publie la même en
nommant explicitement le coefficient « D / 10 », ce qui confirme la lecture.

**La densité n'apparaît pas dans le moteur** : elle se simplifie dans le
rapport de deux géométries. C'est elle, et elle seule, qui distingue un joint
fin d'un joint époxy — donc elle appartient au rendement catalogue du produit,
pas à la loi de forme. C'est ce qui permet à une seule loi de servir toute la
famille sans qu'aucun produit n'ait à déclarer sa densité au moteur.

**Vérification de la formule contre la table de la même fiche.** Les 16
cellules publiées par CERMIJOINT COLOR de 20 × 20 à 60 × 60 sont reproduites
exactement — **à une épaisseur de 7 mm**, constatée et non supposée : c'est la
seule valeur de la plage « 7-10 mm » que la fiche annonce qui les reproduise
toutes. La table est donc une illustration au bas de la plage, pas un carreau
réel. `estimations/tile-consumption.spec.ts` fige cette vérification.

### Format → largeur de joint et épaisseur : ce qui est sourcé, ce qui ne l'est pas

| Format | Épaisseur retenue | Joint recommandé |
| --- | --- | --- |
| 20 × 20 | 8 mm | 5 mm |
| 30 × 30 | 8 mm | 3 mm |
| 45 × 45 | 9 mm | 3 mm |
| 30 × 60 | 9 mm | 3 mm |
| 60 × 60 | 10 mm | 2 mm |
| 25 × 40 (faïence murale) | 7 mm | 3 mm |

**L'épaisseur est une interpolation à l'intérieur d'une plage publiée, pas un
chiffre de fiche.** CERMIJOINT COLOR annonce « 7-10 mm » pour tous les formats
de 20 × 20 à 100 × 100 sans les distinguer ; la progression retenue reste dans
cette plage et suit le fait qu'un grand format se fait plus épais. C'est le
terme le moins déterminant : il varie de 30 % quand la largeur de joint varie
de 300 %.

**La largeur de joint recommandée est un défaut de catalogue, au-dessus des
minimums normatifs.** Le NF DTU 52.2 ne donne que des planchers, lus dans le
même mémento : sol intérieur, carreaux NF UPEC « joints ≥ 2 mm » ; mur
intérieur, carreaux pressés à chants rectifiés « 2 mm minimum », non rectifiés
« 2 mm pour les formats ≤ 500 cm² et 3 mm pour les formats > 500 cm² ». Au-delà
de ces planchers, le défaut retenu élargit le joint quand le format rétrécit,
parce qu'un petit format multiplie les lignes de joint et pardonne moins un
joint fin. **Ce n'est pas une prescription** : `joint_width_mm` est une question
posée à l'écran, et la réponse de l'artisan prime toujours sur la
recommandation.

### Ce que ce lot n'a pas sourcé

`Joint large 5-20mm` (1 kg/m²) et `Joint époxy` (1,25 kg/m²) restent **non
marqués et inchangés**. Ils ne sont liés à aucun ouvrage V1, donc chiffrés par
personne, et leur coefficient de densité n'a pas pu être lu sur une fiche
fabricant : les URL Cermix correspondantes (CERMIJOINT TX / PRO LARGE pour les
joints larges, EPOSOL 2.0 / EPOGLASS 2.0 pour l'époxy) répondent 404 sur le
motif d'URL qui sert les autres fiches de la marque. Les marquer sans avoir lu
leur référence ferait dire à leur rendement une géométrie qui n'est pas la
sienne — c'est exactement le défaut que ce lot corrige. Ordres de grandeur
relevés en seconde main, à confirmer avant usage : densité 1,8 pour un joint
large cimentaire, 1,6 pour un époxy (consensus resserré, 1,55-1,63 chez sept
fabricants).

## Comptage en lés (E1-6)

Le revêtement mural était chiffré au mètre carré : le catalogue annonçait un
rouleau « 10.05m x 0.53m (~5.3 m²) » et le moteur divisait la surface murale
nette par 5,3. **Un rouleau ne rend jamais 5,3 m² utiles.** Il rend un nombre
*entier* de lés, dont la longueur est la hauteur sous plafond augmentée du
raccord de motif et d'une marge de coupe ; le bout de bobine est perdu. Et un lé
ne tourne pas un angle : la dernière laize de chaque pan s'arrondit au lé
entier.

Le défaut était invisible à l'écran et visible sur le dernier mur. Sur la
chambre de référence (4 × 3 m, une porte, 28 lés) :

| Hauteur | Lé (marge 10 cm) | Lés par rouleau | Rouleaux | Ancien calcul |
| --- | --- | --- | --- | --- |
| 2,40 m | 2,50 m | 4 | 7 | 7 |
| 2,50 m | 2,60 m | 3 | **10** | 7 |
| 2,60 m | 2,70 m | 3 | **10** | 8 |

La ligne de backlog annonçait « 8 au lieu de 10 » à 2,60 m et « juste par
coïncidence » à 2,50 m. Les deux se vérifient **à marge de coupe nulle**
(10,05 / 2,50 = 4,02 lés). Avec les 10 cm d'arasement du métier, le sous-achat
commence dès 2,50 m.

### La loi, et où elle vit

    lé              = hauteur + raccord + marge de coupe
    lés par rouleau = ⌊ longueur du rouleau / lé ⌋              (entier)
    lés nécessaires = Σ_pans ⌈ longueur du pan / largeur ⌉      (pan par pan)
    rouleaux        = lés nécessaires / lés par rouleau

Le module `estimations/wallpaper-strips.ts` porte la loi ; les dimensions du
rouleau sont des **données** (`materials_catalog.roll_width_cm` /
`roll_length_cm`), parce que le catalogue en porte déjà deux — 10,05 × 0,53 m
pour les papiers peints, 10 × 0,50 m pour le papier d'apprêt. Une constante de
moteur aurait chiffré le second comme le premier.

**Ce que devient `yield_per_unit` pour ces matériaux : il n'est plus lu.** La
géométrie du rouleau le remplace entièrement. Il reste à 1 au registre parce que
c'est la valeur juste du seul énoncé qu'il porte encore, et parce que la colonne
« Rendement V1 » est un contrat vérifié par `sources-catalogue.spec.ts`.

### Valeurs de référence et sources

| Valeur | Retenue | Verbatim |
| --- | --- | --- |
| Rouleau standard européen | 10,05 m × 0,53 m | Bricoflor : « Un rouleau de papier peint de taille standard en Europe présente une longueur de 10,05 mètres. La largeur de lés est de 0,53 m. » |
| Marge de coupe | 10 cm (5 en haut, 5 en bas) | Bricoflor : « Vous pouvez ajouter 10 cm supplémentaires à la hauteur, soit 5 cm en haut et en bas pour des finitions plus propres. » ; sol-peinture : « Hauteur sous plafond + 10 cm (5 cm en haut et 5 cm en bas) pour les coupes d'arasement. » ; ManoMano : « 10 ÷ (2,5 + 0,10) » |
| Longueur d'un lé | hauteur + raccord + marge | sol-peinture publie la formule : « L_lé-coupé = H_mur + M_sécurité + R_raccord » ; Bricoflor : « Additionnez le raccord du papier peint avec la hauteur de votre mur » |
| Lés par rouleau | partie entière | ManoMano, raccord de 80 cm : « 10 ÷ (2,5 + 0,10 + 0,80) = 2,94 » → 2 lés utilisables |

Sources consultées le 2026-08-07 :
<https://www.bricoflor.fr/blog/2020/02/14/calcul-rouleau-papier-peint-quelle-quantite-me-faut-il>,
<https://www.sol-peinture.fr/combien-de-les-dans-un-rouleau-de-papier-peint>,
<https://www.manomano.fr/conseil/comment-calculer-le-nombre-de-rouleaux-de-papier-peint-7098>
(cette dernière refuse les clients non-navigateur — 403 — et n'a été lue qu'au
travers de l'index de recherche, ce qui est signalé ici plutôt que masqué).

**Forme sûre du raccord, et non forme exacte.** Le rigoureux, pour un raccord
droit, serait `⌈(hauteur + marge) / raccord⌉ × raccord` — 3,20 m à 2,60 m de lé
utile et 64 cm de raccord, contre 3,24 m retenus. La forme retenue majore d'au
plus la fraction de raccord perdue avant le premier point de départ utilisable
de la bobine : une perte réelle, dont on ne sait pas où elle tombe tant que le
rouleau n'est pas déroulé. C'est aussi la forme que publient les trois guides.

### Ce qui n'est pas déduit, et pourquoi

**Ni les ouvertures, ni les zones exclues** ne réduisent le nombre de lés. Le lé
au-dessus d'une porte se coupe dans un lé entier et sa chute ne fait pas un
second lé. C'est la règle de tous les guides de pose, et elle penche du côté
sûr. Le nombre de lés d'un mur ne dépend donc que de sa longueur.

**Le découpage pan par pan est une règle de métier, pas une donnée fabricant** —
au même titre que les `waste_factors`, et étiquetée comme telle. Aucun fabricant
ne la publie ; Bricoflor traite bien chaque mur séparément dans ses exemples
chiffrés, et la raison physique se suffit. `estimations/room-geometry.ts` expose
les pans réels d'une pièce (`unionWallRunsCm`) : sur le séjour en L de
référence, le périmètre total donne 34 lés, les six pans réels en demandent 36.

**Le facteur de perte n'a pas été retouché.** La découpe capture désormais la
chute géométrique que `wallCoveringWaste()` représentait forfaitairement ; les
deux se recouvrent partiellement. Les facteurs de perte sont le périmètre
d'E1-7, qui doit trancher la question sur les sept ouvrages à la fois et avec
ses propres sources.

### Encadrement de consommation : changement de grandeur

`Papier peint intissé uni` passe d'un rendement définitionnel (1 m²/m²) à un
intervalle de **m² de papier acheté par m² de mur**, `1,34` à `1,80`. Le
plancher est exact et se relit : à 2,50 m sous plafond avec 10 cm de marge, un
rouleau donne 3 lés de 2,60 m, donc `10,05 / (3 × 2,50) = 1,34`. Les deux
majorations qui s'y ajoutent sont ≥ 1 par construction — l'arrondi de la
dernière laize de chaque pan, et les ouvertures non déduites.

Comme pour E1-5, l'intervalle encadre la **géométrie par défaut de l'ouvrage** ;
le reste de la courbe est éprouvé lé par lé dans
`estimations/wallpaper-strips.spec.ts`, ce qui est plus exigeant.

### Deux limites assumées

1. **Mutualisation à hauteurs différentes.** Les rouleaux sont comptés
   fractionnairement pour que la mutualisation ENG-2 fonctionne. Deux pièces de
   hauteurs différentes n'ont pourtant pas des lés interchangeables : l'achat
   mutualisé peut valoir un rouleau de moins que la somme des besoins réels.
   Sans effet à hauteur égale — le cas courant.
2. **Toiles et voiles de verre non couverts.** Deux longueurs de bobine (25 et
   50 m²) pour la même référence : un seul couple de dimensions par matériau ne
   peut pas les décrire. Ils restent au calcul surfacique, et le dire vaut mieux
   que leur inventer un conditionnement.

## Facteurs de perte (E1-7 — registre)

Les `waste_factors` seedés sont des **valeurs d'usage métier, sans référence
normative**. Ce n'est pas une prudence de rédaction, c'est un résultat de
recherche : le texte intégral du NF DTU 52.1 a été extrait et « chute » n'y
apparaît que pour la bille d'un essai de choc ; les deux guides CAPEB du
NF DTU 25.41 ne contiennent ni « chute », ni « perte », ni « majoration » ; le
NF DTU 51.11 et le NF DTU 59.4 n'en publient pas davantage — ce dernier
**prescrit une méthode** (compter les lés selon la hauteur du raccord) plutôt
qu'un pourcentage, ce qu'E1-6 a implémenté. Aucun DTU ne fixe de pourcentage de
perte. Toute valeur ci-dessous est un usage de la profession, relevé chez des
fabricants, des enseignes ou des poseurs, et cité comme tel.

Ces valeurs restent affinées par les facteurs **appris** sur les achats réels
(DATA-3, `learned_waste_factors`) — c'est ce mécanisme, et pas une norme, qui
les rapproche du terrain.

### Ce que la structure dit, avant les chiffres

Trois décisions d'E1-7 comptent autant que les valeurs :

1. **`standard` n'est pas un repli, c'est le nom de la pose unique** des
   ouvrages sans variante de calepinage. Un matériau déclare soit cette pose
   seule, soit des poses variantes sans elle — jamais les deux. La résolution
   n'a plus de troisième temps : ce qui n'est pas au catalogue lève
   (`MissingWasteFactorError`).
2. **La perte de coupe ne s'applique qu'à ce qui se coupe.** Les produits dosés
   — mortiers-colles, joints, primaires, ragréages, SEL, colles à papier peint —
   suivent la surface **nette**, jamais la surface achetée : une chute de carreau
   est reposée ailleurs, et sa colle est comptée avec elle. La doctrine du métré
   dit la même chose, coefficient par ligne : « Quantité élémentaire […]
   augmentée **le cas échéant** par les pertes, casses, chutes » (SYNERGIE,
   *Métré – Étude de prix*). Un sous-détail de carrelage corrigé l'applique
   littéralement — carreaux à `34,5 × 1,10`, colle et joint sur `34,50 m²` :
   « Les quantités de colle et de joint sont directement proportionnelles à la
   surface nette à carreler » (Étudiant Génie Civil, Wayback 2026-01-14).
3. **Le raccord de papier peint n'est plus un pourcentage.** E1-6 l'a rendu
   géométrique ; le reporter aussi en perte le comptait deux fois.

### Carrelage — `tileCoveringWaste()` (inchangé par E1-7)

| Pose | Débutant | Intermédiaire | Expert |
| --- | --- | --- | --- |
| droite | 15 % | 10 % | 5 % |
| diagonale | 20 % | 15 % | 10 % |

Les six valeurs étaient déjà cohérentes avec la profession ; ce que ce lot a
corrigé, c'est la **liste des matériaux** qui les portaient.

| Valeur | Citation | Source | Consulté le |
| --- | --- | --- | --- |
| droite 5 % | « pour une pose droite, c'est-à-dire lorsque les joints sont parallèles aux murs, il faudra majorer la surface réelle de 5% » | [Réflex Boutique, *Aide aux métrés*](https://reflex-boutique.fr/content/16-aide-aux-metres) | 2026-08-07 |
| droite 10 % | « ajoutez environ 10 % de chutes (15 % en pose diagonale) » | [Mon Coach Brico, *Calepinage carrelage*](https://www.moncoachbrico.com/tutos/mur/comment-faire-un-calepinage/) | 2026-08-07 |
| droite 15 % (débutant) | « ajouter une marge de sécurité entre 8% et 10%, vous pouvez même aller jusqu'à 15% **si vous êtes novice** ou si votre type de pose est en diagonale ou en pose décalée » | [Castorama, *Calculer la bonne quantité de carrelage mural*](https://www.castorama.fr/idees-et-conseils/murs/carrelage-mural/calculer-la-bonne-quantite-de-carrelage-mural) | 2026-08-07 |
| diagonale 10 % | « pour une pose en diagonale, il faudra majorer de 10% » | [Réflex Boutique](https://reflex-boutique.fr/content/16-aide-aux-metres) | 2026-08-07 |
| diagonale 15 % | « prévoir une marge de perte de matériau de l'ordre de 15 % (contre 10 % pour la pose droite) » | [Malrieu (Espace Aubade), *La pose diagonale*](https://www.malrieu.fr/blog/carrelage/la-pose-diagonale-comment-utiliser-cette-technique-pour-corriger-les-defauts-d-une-piece) | 2026-08-07 |
| 5–15 % (cadre) | « Appliquez systématiquement un coefficient de perte selon les matériaux : 5 à 10 % pour le carrelage » | [Obat, *Déboursé sec*](https://www.obat.fr/blog/debourse-sec/) | 2026-08-07 |

Le **débutant en diagonale (20 %)** est le seul des six à ne pas être cité tel
quel : c'est l'extrapolation du « novice **ou** diagonale = 15 % » de Castorama
au cas où les deux se cumulent. Écrit ici plutôt que présenté comme sourcé.

### Sols en lames — `floorCoveringWaste()`

| Pose | Débutant | Intermédiaire | Expert | Statut E1-7 |
| --- | --- | --- | --- | --- |
| droite | 10 % | 7 % | 5 % | valeurs inchangées, pose **renommée** `standard` → `straight` |
| diagonale | 20 % | 17 % | 15 % | **corrigée** (était 15/10/7) |
| chevrons | 25 % | 22 % | 20 % | **ajoutée** |

| Valeur | Citation | Source | Consulté le |
| --- | --- | --- | --- |
| droite 5 % | « vous pouvez vous prévoir 5 % de sol en plus » | [Quick-Step, *De quelle quantité ai-je besoin ?*](https://www.quick-step.fr/fr-fr/foire-aux-questions/sol-stratifie/preparation-et-pose/de-quelle-quantite-de-revetement-de-sol-ai-je-besoin-pour-ma-piece) | 2026-08-07 |
| droite 5–10 % | « Lorsque vous posez du stratifié, vous devez donc en général prévoir 5 à 10 % de chutes. » | [Woodstore24, *Calculer les chutes*](https://woodstore24.fr/guide-du-bois/guide-du-sol/calculer-la-coupe.html) | 2026-08-07 |
| droite 10 % (débutant) | « il est généralement conseillé d'ajouter minimum 10% de lames afin de pallier les éventuelles erreurs et découpes » | [Castorama, *Calculer la bonne quantité de parquet*](https://www.castorama.fr/idees-et-conseils/sols/parquet/calculer-la-bonne-quantite-de-parquet) | 2026-08-07 |
| diagonale 15 % | « 15 % de surface supplémentaire sont à prévoir pour votre projet » | [Bricozor, *Dans quel sens poser un parquet ?*](https://comptoir.bricozor.com/dans-quel-sens-poser-un-parquet.html) | 2026-08-07 |
| diagonale 20 % | grille du simulateur, pose diagonale : « Pièce carrée 20% / Pièce rectangulaire 25% / Pièce irrégulière 30% » | [Castorama, *Calculer la bonne quantité de parquet*](https://www.castorama.fr/idees-et-conseils/sols/parquet/calculer-la-bonne-quantite-de-parquet) — tableau publié en **image**, lu visuellement | 2026-08-07 |
| chevrons 15–20 % | « Si vous optez pour un parquet en bâtons rompus, il est conseillé de prévoir entre 15 et 20% de chute, soit presque 2 fois plus que pour une pose droite. » | [Parquets Protat](https://www.parquetsprotat.com/blog/dans-quel-sens-poser-parquet-piece-rectangulaire/) | 2026-08-07 |
| chevrons 12–15 % | « Surface de votre pièce + 12 à 15% en fonction de la complexité » (point de Hongrie & bâton rompu) | [La Sélection d'André, *Calculatrice* (PDF)](https://laselectiondandre.fr/calculatrice/calculatrice.pdf) | 2026-08-07 |

**Pourquoi l'expert ne prend pas le bas de la fourchette sur les poses à
motif.** Ailleurs, l'expert reçoit le bas de la fourchette professionnelle. Pour
la diagonale et les chevrons il reçoit le haut, délibérément : le bas d'une
fourchette publiée suppose des chutes réutilisables, or dans un calepinage à
angle fixe la chute d'une rangée ne démarre pas la suivante. Et le mode de
défaillance n'est pas symétrique — une lame manquante en fin de chantier ne se
remplace pas par une lame d'un autre bain de teinte.

Le **débutant en chevrons (25 %)** dépasse toutes les fourchettes relevées
(12-20 %) : c'est une marge de prudence assumée, pas une valeur sourcée. Elle
reste sous les 30 % que la grille Castorama atteint pour une pièce irrégulière
en simple diagonale.

**Non sourçable, et donc non implémenté** : la pose en chevrons du **carrelage**.
Ni Point.P ni Espace Aubade ne publient de taux pour elle, et une valeur trouvée
en ligne s'est révélée fabriquée par l'outil de lecture plutôt que présente dans
la page. Aucune option « chevrons » n'est donc offerte au carrelage — une donnée
qu'on ne sait pas chiffrer ne vaut pas mieux qu'une donnée absente.

### Papier peint — `wallpaperStripWaste()`

| Pose | Débutant | Intermédiaire | Expert |
| --- | --- | --- | --- |
| unique | 15 % | 8 % | 3 % |

Les poses `plain` (10/7/3) et `patterned` (18/12/7) sont **supprimées**. Le
raccord est compté par la découpe depuis E1-6, conformément au NF DTU 59.4
§6.6.5 : « La quantité nécessaire sera calculée selon le nombre de lés au
périmètre de la pièce […] Pour les revêtements à motif, il convient de calculer
les lés selon la hauteur du raccord. » Ce qui reste ne dépend plus du papier
mais du poseur.

| Valeur | Citation | Source | Consulté le |
| --- | --- | --- | --- |
| débutant 15 % | « Un poseur novice doit effectivement prévoir 15 à 20 % de papier supplémentaire afin de compenser les erreurs de découpe ou les faux départs. » | [Bricomarché, *Calculer le nombre de rouleaux*](https://www.bricomarche.com/conseils/comment-calculer-le-nombre-de-rouleaux-de-papier-peint) | 2026-08-07 |
| ~10 % (cadre) | « Ajoutez 10 % de marge pour les pertes, raccords et finitions. » | [Delzongle](https://www.delzongle.fr/2726-comment-calculer-la-quantite-de-papier-peint-necessaire) | 2026-08-07 |
| expert 3 % | valeur `plain` d'avant E1-7, conservée : un lé gâché sur une trentaine | — | — |

### Produits dosés — `dosedWaste()`

| Pose | Débutant | Intermédiaire | Expert |
| --- | --- | --- | --- |
| unique | 5 % | 3 % | 2 % |

**Ces trois valeurs ne sont pas sourcées, et c'est un choix.** Les fiches
fabricants donnent une consommation « à titre indicatif » et renvoient toute la
variation au peigne, au double encollage et à la planéité du support — jamais
aux chutes : « Consommation : elle dépend du format et du relief du carreau, du
mode d'encollage et de la taloche crantée utilisée » (Weber, *webercol flex*) ;
« Les valeurs ne tiennent pas compte de l'état du support » (Cermix, *CERMIPRO*).
Les calculateurs Weber, PRB et Sika n'ont **aucun champ de chutes**. La valeur
sourcée serait donc 0 %.

Ce qui subsiste — fond de seau, gâchée durcie, peigne trop chargé — n'est chiffré
nulle part. Ces trois valeurs sont une marge de prudence, placée délibérément
**sous toutes les échelles de chute du catalogue** pour qu'on ne puisse pas les
confondre avec une perte de coupe.

### Ce que ce lot n'a pas corrigé, et pourquoi

**Plâtrerie — `partitionWaste()` (12/8/4) est probablement un double comptage.**
Le SNIP publie le seul coefficient chiffré de toute cette page : « Le coefficient
de perte est pris à 5%, signifiant que le calcul des quantitatifs des produits
est majoré de 5% pour tenir compte des chutes sur chantier »
([Fiche conseil n°18](https://www.lesindustriesduplatre.org/wp-content/uploads/2025/03/SNIP-FICHE-CONSEIL-18-VERSIONS-2025_V6-13fevrier.pdf),
déc. 2024). Ces 5 % sont **déjà dans les quantitatifs** dont nos rendements
dérivent — 2,10 m² de plaque par m² de cloison à deux faces, soit 2 × 1,05 — et
notre `Plaque BA13` porte bien `yield_per_unit: 0,96`, c'est-à-dire 1,042 m² par
m² de parement. Nos 12/8/4 s'ajoutent donc à une marge déjà présente.

Corriger demande de réexprimer les rendements en géométrie pure, ce qui touche le
registre ci-dessus **et** les encadrements de consommation : c'est le périmètre
d'E1-8, pas celui d'un lot sur les facteurs de perte. Le sens de l'écart est le
sens sûr — on achète un peu trop — et il est écrit ici pour ne pas être
redécouvert. Le SNIP traite d'ailleurs l'enduit à part, hors de ses tableaux et
« à titre indicatif », sans dire si les 5 % s'y appliquent : ni Placo, ni Siniat,
ni Semin ne chargent l'enduit ou la bande d'une majoration.

**Peinture — `paintWaste()` (15/10/5) est conservé.** Les 10 % de
l'intermédiaire sont l'usage cité par [Tollens](https://www.tollens.com/conseils/conseils-travaux/comment-calculer-ma-quantite-de-peinture)
(« TOLLENS vous recommande de calculer 10% de marge ») et
[Castorama](https://www.castorama.fr/idees-et-conseils/calculer-votre-besoin-en-peinture/CF_CPRD_npcart_100567.art)
(« Une marge de 10% est assez classique »). Le levier techniquement juste n'est
d'ailleurs pas un taux de chute mais le rendement : « A majorer selon la nature
et la structure du support » (Zolpan, FT Proalkyd Velours). Hors périmètre.

**Accessoires — `accessoryWaste()` (10/5/2) est conservé sans source.** Ces
matériaux ne sont plus liés à aucun ouvrage V1 depuis la migration `…071`.

### Accès aux sources

Refus systématique des clients non-navigateur (HTTP 403) : Leroy Merlin,
Point.P, ManoMano, Lapeyre, `placo.fr`, Knauf, Gerflor, `fr.weber`. Les valeurs
Placo ont été lues via une copie Wayback Machine, la fiche Weber via le miroir
distributeur `media.adeo.com`. **Aucun chiffre Leroy Merlin n'est cité** : ses
pages ne sont ni accessibles ni archivées, et les pourcentages de son
calculateur vivent dans du JavaScript non récupérable.

Deux valeurs vues en première lecture ont été **écartées après re-vérification
du HTML brut** : une ligne « chevrons 12 à 15 % » attribuée à Réflex Boutique,
absente de la page, et un « Coefficient de chute NF DTU 53.2 » dont
l'attribution normative est inventée. Les contenus de `macalculatriceenligne`,
`tropical-woods` (trois valeurs différentes sur trois pages du même site) et des
fermes de contenu généralistes ne sont cités nulle part ici.

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
