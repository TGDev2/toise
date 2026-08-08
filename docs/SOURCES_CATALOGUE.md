# Sources du catalogue V1 — registre des rendements (E1-7)

Chaque matériau **lié à un ouvrage** (`work_type_materials`, curation E1-3) a une
ligne ici : rendement seedé vérifié contre une fiche technique fabricant réelle,
chargée en ligne, avec URL et date de consultation. Un matériau dont le
rendement n'a pas pu être sourcé est **sorti du périmètre V1** (décision
`retirer`, migration `…071`) — il reste au catalogue mais n'est plus servi par
les listes des 7 ouvrages.

**Périmètre V1 après E1-10 : 54 matériaux liés (59 liaisons), dont
37 liaisons obligatoires chiffrées automatiquement (32 matériaux distincts).**
E1-7 avait retiré 14 matériaux — les outils purs, et les consommables dont la
grandeur fabricant n'est pas surfacique. E1-10 réintègre les seconds : le
linéaire et le comptage sont désormais des assiettes du moteur
(`floor_perimeter`, `door_count`), et seuls restent retirés les outils et ce
dont la grandeur n'est connue d'aucune donnée du modèle (cf.
`docs/MATERIAUX_OUVRAGES.md`, règle E1-10). Six liaisons obligatoires sont
**conditionnelles** : SEL, bande d'étanchéité, ragréages et primaires ne
produisent une ligne que si la question de l'ouvrage les déclenche (sections
« Déclenchement du SEL » et « Préparation du support » plus bas). Le reste du
catalogue (~190 entrées) n'est pas servi par la V1 et n'est pas couvert par ce
registre.

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
| `floor_perimeter` (E1-10) | contour au sol de la pièce, **portes déduites** | m de périmètre par unité |
| `door_count` (E1-10) | nombre de passages de porte | passages de porte par unité |

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
- Accès : `placo.fr`, `isover.fr` et `knauf.fr` refusent les clients
  non-navigateur (403) ; leurs documents ont été lus via une copie Wayback
  Machine octet-à-octet de l'URL fabricant indiquée. `mapei.com` refuse tout
  accès (403, y compris ses PDF) : **aucun chiffre Mapei n'est cité**. Les
  domaines PRB, Cermix, Parexlanko, Sika et Quick-Step (E1-10) ont été chargés
  en direct le jour de la consultation, comme tous les autres.

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
| Joint souple silicone | tiling | 3 | périmètre au sol | Sika Sanisil, table « Consommation », cartouche 300 ml : « 10 / 10 / 3,0 » (largeur/profondeur du joint en mm, m de joint pour 300 ml) — la section la plus petite publiée ; la fiche ne publie pas de cordon de 5 mm, la valeur retenue est donc la plus défavorable, sens sûr. Le retrait E1-7 (« grandeur fiche linéaire ») est levé par l'assiette linéaire d'E1-10 : le joint périphérique suit le périmètre au sol, portes déduites (NF DTU 52.2) | ré-exprimer par m de joint périphérique (6 → 3) | https://fra.sika.com/dms/getdocument.get/4bf61a71-0ba4-45cb-95e6-0d7c3ab8cb48/sika_sanisil_.pdf | 2026-08-08 |
| Croisillons 2mm (x200) | tiling | 40.5 | surface d'ouvrage | Aucune table fabricant (Rubi, Raimondi, Taliaplast vérifiés en E1-7 ; sachet de 200 confirmé chez Raimondi) — la quantité est une **dérivation géométrique** : un croisillon par intersection de joints, soit 10 000/(L × l) par m² (`estimations/tile-consumption.ts`, `spacersPerM2`, loi `tile_spacers`). Rendement à la géométrie de référence 45 × 45 : 200 × 2 025/10 000 = 40,5 m² par sachet | ré-exprimer à la géométrie de référence (définitionnel — dérivation géométrique, 1 → 40.5) | — | 2026-08-08 |
| Croisillons 3mm (x200) | tiling | 40.5 | surface d'ouvrage | Idem croisillons 2 mm — même dérivation, même sachet de 200 | ré-exprimer à la géométrie de référence (définitionnel — dérivation géométrique, 1 → 40.5) | — | 2026-08-08 |
| Croisillons 5mm (x100) | tiling | 20.25 | surface d'ouvrage | Idem, sachet de 100 : 100 × 2 025/10 000 = 20,25 m² à la référence | ré-exprimer à la géométrie de référence (définitionnel — dérivation géométrique, 1 → 20.25) | — | 2026-08-08 |
| Plinthe carrelage 8x30 cm | tiling | 1 | périmètre au sol | Vendue et posée au mètre le long des murs : rendement définitionnel — un mètre de plinthe couvre un mètre de périmètre, portes déduites. Chutes portées par les facteurs de perte (réutilisables d'un mur à l'autre) | ré-exprimer par m de périmètre (définitionnel) | — | 2026-08-08 |
| SEL (Système d'Étanchéité Liquide) | tiling | 0.3333 | surface d'ouvrage | PRB CEL CÉRAMIC : « Consommation du mélange Poudre + Résine en 2 couches : 2,5 à 3,5 kg/m². », « Densité du mélange : 1,50 ± 0,10. », « Kit de 32 kg. » ; corroboré Cermix CERMIPROOF ST : « 3 kg de mélange/m² pour les 2 couches. » Milieu retenu 3 kg/m² → 0,3333 m²/kg. L'unité passe du litre au kilo : les fiches publient en kg de mélange et les kits se pèsent — le litre seedé ne correspondait à aucun conditionnement réel (l'ancien 0,7 m²/L ≈ 1,43 L/m² × 1,5 ≈ 2,1 kg/m², sous la plage fiche) | ré-exprimer en kg de mélange (0.7 → 0.3333) | https://pim.prb.fr/PRB/Fiches%20Techniques/fr/ft_prb_cel_ceramic_fr_4_04_2024.pdf | 2026-08-08 |
| Bande d'étanchéité 120mm | tiling | 1 | périmètre au sol | Marouflée en continu dans la première couche du SEL le long des jonctions sol/mur — PRB CEL CÉRAMIC : « Un renfort d'armature est obligatoire à chaque angle, liaison sol-mur, retombée et points singuliers. » ; Cermix CERMIPROOF ST : « Parties angulaires, relevés, huisseries : bande d'armature AR12 ». Un mètre de bande par mètre de jonction : définitionnel. Rouleau de 10 m (Cermix AR12) ; le rouleau de 50 m d'avant ce lot ne correspondait à aucune fiche et sort du conditionnement | ré-exprimer par m de jonction (définitionnel) | https://www.cermix.com/fr/produit/outillage/bande-darmature-ar12-associee-a-nos-systemes-detancheite/ | 2026-08-08 |
| Primaire d'accrochage carrelage | tiling | 5 | surface d'ouvrage | PRB ACCROSOL PLUS : « CONSOMMATION — 150 à 300 g/m² selon support (porosité, rugosité). », « Jerricans de 5 kg … Jerricans de 1 kg », « Masse volumique apparente : 1,05 ± 0,1 t/m³ » ; corroboré weberprim RP : « 150 à 250 g/m² environ » (miroir media.adeo.com). 0,2 kg/m² retenu, milieu de plage → 5 m²/kg — la valeur d'avant ce lot à l'unité près, la densité 1,05 confondant litre et kilo | ré-exprimer par kg (5 m²/L → 5 m²/kg) | https://pim.prb.fr/PRB/Fiches%20Techniques/fr/(1)ft_prb_accrosol_plus_fr_18_04_2024.pdf | 2026-08-08 |
| Ragréage autolissant | tiling | 0.2222 | surface d'ouvrage | PRB PLANIDUR PRO : « CONSOMMATION — 1,5 kg/m²/mm d'épaisseur. », « Épaisseur d'emploi : … locaux P3, rénovation : de 3 à 10 mm », « Sac papier de 25 kg » — à l'épaisseur retenue de 3 mm (le plancher de la plage rénovation) : 4,5 kg/m², soit 0,2222 m²/kg. Le 0,2 d'avant ce lot supposait 3,33 mm qu'aucune fiche ne nomme | corriger (0.2 → 0.2222) | https://pim.prb.fr/PRB/Fiches%20Techniques/fr/(1)ft_prb_planidur_pro_fr_4_04_2024.pdf | 2026-08-08 |
| Natte de découplage | tiling | 1 | surface d'ouvrage | Vendue et posée au m² : rendement définitionnel. Liée en alternative documentée (`is_optional`) : supports fissurés et planchers bois, jamais chiffrée automatiquement | conserver (définitionnel) | — | 2026-08-08 |
| Éponge de carreleur | tiling | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Peigne à colle 10mm | tiling | — | surface d'ouvrage | Outil : pas de rendement exprimable en m²/unité | retirer (outil) | — | 2026-08-03 |
| Stratifié 8mm AC4 | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Stratifié 12mm AC5 | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Parquet contrecollé chêne 14mm | flooring | 1 | surface d'ouvrage | Vendu et posé au m² : rendement définitionnel | conserver (définitionnel) | — | 2026-08-03 |
| Sous-couche mousse 3mm | flooring | 1 | surface d'ouvrage | Quick-Step (FT Basic Plus + FT NETAPE50) : pose bord à bord sans chevauchement (« les bandes … doivent être parfaitement adjacentes ») ; « 1 rouleau = 15 m² » = sa surface | conserver (définitionnel) | https://www.quick-step.fr/-/media/Imported%20Assets/Flooring/9/6/5/TDSAccNETAPE50SelfadhesiveTapeFRpdf49942.ashx?rev=867c7b1de3ff4881ace0453be4832f00&type=original&filename=Informations+techniques.pdf | 2026-08-03 |
| Sous-couche 2mm avec pare-vapeur intégré | flooring | 1 | surface d'ouvrage | Quick-Step Basic Plus (QSUDLBP15), mousse polyéthylène 2 mm, rouleau 1,00 × 15 m : « combinée à un pare-vapeur (avec rabat et bande adhésive pour une pose facile) », « 15 m²/colis ». Posée bord à bord comme la sous-couche mousse : rendement définitionnel. **Ajoutée par E1-8** pour que `vapour_barrier = 'integrated'` ait un référent réel (`is_optional: true` — alternative documentée) | conserver (définitionnel) | https://boutique-parquet.com/qsudlbp15-quick-step-15m-sous-couche-basic-plus-pare-vapeur-integre.html | 2026-08-07 |
| Film pare-vapeur PE | flooring | 0.8 | surface d'ouvrage | Wineo PE-Dampfbremse : lé 1,00 m, « > 20 cm Stoßüberlappung » ; Tarkett : « chevauchement d'au moins 200 mm » → (1,00 − 0,20)/1,00 = 0,80 | corriger (1 → 0.8) | https://www.wineo.de/content/Dokumente/Zubehoer/Technische%20Datenblaetter/DE/PE-Dampfbremse-02-2019.pdf | 2026-08-03 |
| Ruban adhésif pare-vapeur | flooring | — | surface d'ouvrage | Aucune règle de consommation chiffrée en fiche (Quick-Step NETAPE50, Ursa UNI TAPE) ; Wineo : adhésivage non requis en conditions normales | retirer (non sourçable) | https://www.quick-step.fr/-/media/Imported%20Assets/Flooring/9/6/5/TDSAccNETAPE50SelfadhesiveTapeFRpdf49942.ashx?rev=867c7b1de3ff4881ace0453be4832f00&type=original&filename=Informations+techniques.pdf | 2026-08-03 |
| Cale de dilatation (x40) | flooring | — | surface d'ouvrage | Réexaminée par E1-10 : l'assiette linéaire existe désormais (`floor_perimeter`), mais la notice de pose Quick-Step, qui impose le jeu (« de 8 à 10 mm »), **ne publie aucune règle d'espacement des cales** — aucun « une cale tous les X cm » dans les 10 pages, ni dans les TDS plinthes et Incizo. Sans espacement sourcé, pas de rendement au mètre : la cale reste hors chiffrage plutôt que d'inventer un pas | retirer (non sourçable — aucun espacement publié) | https://www.quick-step.fr/-/media/Imported%20Assets/Flooring/6/9/9/QSInstallationLMPImpressivePatternsFRpdf109781.ashx?rev=8c25c26e13e941c3bd2917b4cee71d84&type=original&filename=Instructions+de+pose+Quick-Step+Sol+stratifi%C3%A9+Impressive+Patterns.pdf | 2026-08-08 |
| Plinthe MDF 60mm 2.4m | flooring | 1 | périmètre au sol | Vendue et posée au mètre : définitionnel. Barre de 2,40 m confirmée par la TDS Quick-Step Plinthes : « QSSK(-) — Plinthe standard — 58mm x 12mm x 240cm — Quantité par emballage : 6 » (toutes les plinthes du fabricant sont en 240 cm) | ré-exprimer par m de périmètre (définitionnel) | https://www.quick-step.fr/-/media/imported%20assets/flooring/8/1/b/qstdsaccqsscotqsskqspskrqslpskrlaminateskirtingsfrpdf223337.ashx?rev=507cf6438b7b47b9b536106ce8c2ed7d&type=original&filename=Informations+techniques.pdf | 2026-08-08 |
| Plinthe MDF 80mm 2.4m | flooring | 1 | périmètre au sol | Idem — alternative documentée (`is_optional`), même barre de 2,40 m | ré-exprimer par m de périmètre (définitionnel) | — | 2026-08-08 |
| Plinthe chêne 70mm 2.4m | flooring | 1 | périmètre au sol | Idem — alternative documentée (`is_optional`), même barre de 2,40 m | ré-exprimer par m de périmètre (définitionnel) | — | 2026-08-08 |
| Barre de seuil alu 93cm | flooring | 1 | passages de porte | Une barre par passage de porte : définitionnel. La largeur standard française (83 cm, la porte de la chambre de référence) tient dans les 93 cm ; un passage plus large relève de la barre de 180 cm (alternative documentée). Sort du forfait `complementary_materials` (règle E1-6 : dès qu'une quantité dépend de la géométrie, le produit relève du catalogue) | ré-exprimer par passage de porte (définitionnel) | — | 2026-08-08 |
| Barre de seuil alu 180cm | flooring | 1 | passages de porte | Idem — alternative documentée (`is_optional`) pour les baies larges | ré-exprimer par passage de porte (définitionnel) | — | 2026-08-08 |
| Ragréage fibré sol | flooring | 0.2222 | surface d'ouvrage | PRB PLANIFIBRE : « CONSOMMATION — 1,5 kg/m²/mm d'épaisseur. », « ÉPAISSEUR D'EMPLOI : Locaux P2, P3, P4 et P4S : de 3 à 30 mm. », « Sac papier de 25 kg. » — fibré requis sur planchers bois : « Planchers bois : ils seront rigides (sans flexion) et stables, conformes au DTU 51.3 ». À 3 mm : 4,5 kg/m², soit 0,2222 m²/kg | corriger (0.2 → 0.2222) | https://pim.prb.fr/PRB/Fiches%20Techniques/fr/ft_prb_planifibre_fr_5_12_2023.pdf | 2026-08-08 |
| Primaire d'accrochage sol | flooring | 5 | surface d'ouvrage | PRB ACCROSOL PLUS — même fiche, même plage et même ré-expression que le primaire carrelage ci-dessus | ré-exprimer par kg (5 m²/L → 5 m²/kg) | https://pim.prb.fr/PRB/Fiches%20Techniques/fr/(1)ft_prb_accrosol_plus_fr_18_04_2024.pdf | 2026-08-08 |
| Plaque BA13 standard 2.5x1.2m | partition | 0.96 | parement | Placo® Fiche Solution Placostil® 72/48 BA13 (1 m² d'ouvrage) : « Placoplatre® BA 13 — M2 — 2,10 » (deux faces simple peau) → 1,05 m² par m² de parement | ré-exprimer par m² de parement (0.48 → 0.96) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Plaque BA13 hydro 2.5x1.2m | partition | 0.96 | parement | Ratio du système standard (2,10 m²/m², deux faces) ; variante hydro confirmée à géométrie identique (Knauf KM 72/48 KH13 : « une plaque … par côté ») | ré-exprimer par m² de parement (0.48 → 0.96) | https://tools.knauf.fr/file/71742/download?token=vZzSxXQF | 2026-08-03 |
| Rail R48 3m | partition | 1 | lisses | Placo® Fiche Solution 72/48 : « Rail Stil® R 48 — M — 0,90 » par m² de cloison — ratio valable à une hauteur donnée seulement ; depuis E1-3 la lisse est métrée sur le linéaire réel (2 × longueur), et un mètre de rail couvre un mètre de lisse | ré-exprimer par m de lisse (1.11 → 1) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Montant M48 2.7m | partition | 1 | montants | Placo® Fiche Solution 72/48 : « Montant Stil® ML 48-50 — M — 2,10 » (montants simples, entraxe 0,60) — les 2,10 m/m² étaient l'entraxe replié sur une surface ; depuis E1-3 les montants se comptent `ceil(longueur / entraxe) + 1` et se mesurent sur la hauteur | ré-exprimer par m de montant (0.48 → 1) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Vis placo 25mm (x500) | partition | 45.4 | parement | Placo® Fiche Solution 72/48 : « Vis TTPC 25 — UN — 22,00 » par m² (deux faces) → 11 vis par m² de parement, en boîtes de 500 → 500 ÷ 11 ≈ 45,4 | ré-exprimer par m² de parement (22.7 → 45.4) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Bande à joint papier 23m | partition | 0.72 | parement | Placo® Fiche Solution 72/48 : « Bande PP grand Rouleau — M — 2,80 » par m² (deux faces ; joints, cueillies et angles inclus) → 1,40 m par m² de parement | ré-exprimer par m² de parement (0.36 → 0.72) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Enduit à joint prêt 7kg | partition | 2 | parement | Placo® Placomix® : « Consommation minimum 470 g/m² » de parement ; corroboré Siniat PRÉGY S PE (0,40-0,45 kg/m²). La valeur retenue, 0,50 kg par m² de parement, est celle qui reconduit exactement le 1 kg/m² de cloison seedé par E1-7 | ré-exprimer par m² de parement (1 → 2) | https://www.placo.fr/Produits/enduits-joint/placomixr-5kg | 2026-08-03 |
| Enduit à joint poudre 5kg | partition | 3.04 | parement | Placo® Fiche Solution 72/48 : « Placojoint® PR4 25kg — KG — 0,66 » par m² de cloison (deux faces) → 0,33 kg par m² de parement | ré-exprimer par m² de parement (1.52 → 3.04) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-03 |
| Laine de verre 45mm | partition | 0.9524 | surface d'ouvrage | Placo® Fiche Solution Placostil® 72/48 39 dB : ligne isolant du quantitatif « M2 — 1,05 » par m² de cloison, l'isolant du système étant « Type d'isolant : Laine de verre », « Epaisseur d'isolant (mm) : 45 » (la ligne chiffrée porte le code GP00000163, son libellé est vide dans le PDF — la désignation vient de la description du système, même fiche). 1/1,05 = 0,9524. Une seule trame quel que soit le nombre de faces : la laine se pose **entre les montants**, d'où `work_surface` et non `clad_faces`. Passée d'alternative documentée à ligne obligatoire par E1-10 : le quantitatif du système l'inclut | corriger (1 → 0.9524) | https://www.placo.fr/sites/mac3.placo.fr/files/files/forum/Maison_Cloison_Placostil_Ep_72_BA13_39dB.pdf | 2026-08-08 |
| Bande résiliente 50mm | partition | 1 | lisses | Knauf, « Accessoires pour cloisons - Bande résiliente » : « La bande résiliente (grise) se colle sous les rails », « LARGEUR : 30, 50, 70 et 95 mm », « LONGUEUR : 30 ml », « ÉPAISSEUR : 3 mm » — largeur 50 mm pour le rail de 48, rouleau de 30 m. Aucun ratio de consommation publié (règle de pose seule) : posée en course continue sous les lisses, un mètre de bande couvre un mètre de lisse — définitionnel, comme le rail. **Matériau ajouté au catalogue par E1-10** (`…091`) | conserver (définitionnel — un mètre de bande par mètre de lisse) | https://www.knauf.fr/solutions/produit/accessoires-pour-cloisons-bande-resiliente | 2026-08-08 |
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
Point.P, ManoMano, Lapeyre, `placo.fr`, Knauf, Gerflor, `fr.weber`, et depuis
E1-10 `mapei.com` (pages **et** PDF — aucun chiffre Mapei n'est cité). Les
valeurs Placo et Knauf ont été lues via une copie Wayback Machine, la fiche
Weber via le miroir distributeur `media.adeo.com`. PRB (`pim.prb.fr`), Cermix,
Parexlanko, Sika (`fra.sika.com`) et Quick-Step répondent en direct — ce sont
les sources principales d'E1-10. **Aucun chiffre Leroy Merlin n'est cité** :
ses pages ne sont ni accessibles ni archivées, et les pourcentages de son
calculateur vivent dans du JavaScript non récupérable.

Deux valeurs vues en première lecture ont été **écartées après re-vérification
du HTML brut** : une ligne « chevrons 12 à 15 % » attribuée à Réflex Boutique,
absente de la page, et un « Coefficient de chute NF DTU 53.2 » dont
l'attribution normative est inventée. Les contenus de `macalculatriceenligne`,
`tropical-woods` (trois valeurs différentes sur trois pages du même site) et des
fermes de contenu généralistes ne sont cités nulle part ici.

## Déclenchement du pare-vapeur (E1-8)

Le film pare-vapeur du parquet flottant était lié en `is_optional: false` : il
était donc chiffré sur **tous** les chantiers. Le rendement était juste — 0,8,
soit 1,25 m² de film par m² de sol, qui porte le recouvrement de 20 cm entre
lés, cf. la ligne `Film pare-vapeur PE` du registre — mais le déclenchement était
faux.

### La règle, et sa source

> « Dans le cas de supports à base de liants hydrauliques ou de supports minéraux
> ou dans le cas de l'utilisation d'un plancher chauffant, un film pare-vapeur
> doit être mis en œuvre. »
>
> — NF DTU 51.11 (pose flottante des parquets), cité par
> [Batirama](https://www.batirama.com/article/2277-nf-dtu-51.11-parquets-flottants.html),
> consulté le 2026-08-07.

Le même texte énumère les supports admis : « les supports à base de liants
hydrauliques ou de sulfate de calcium », « les planchers en bois ou panneaux à
base de bois ». D'où les trois valeurs de la question `subfloor_type`
(`projects/work-types.data.ts`) : **béton ou chape**, **plancher bois**, **ancien
revêtement**. Seule la première exige le film.

### Deux conditions, deux endroits

| Information | Où elle vit | Pourquoi là |
|---|---|---|
| Nature du support | `work_types.contextual_questions` → `subfloor_type` | C'est une propriété du **chantier**, que seul l'artisan connaît |
| Pare-vapeur intégré | `materials_catalog.vapour_barrier = 'integrated'` | C'est une propriété du **produit** : une sous-couche qui en intègre un l'intègre partout |

Le film lui-même porte `vapour_barrier = 'dedicated'` : c'est la seule valeur du
catalogue qui rende un matériau **conditionnel**. La règle
(`estimations/vapour-barrier.ts`) tient en une phrase : *un film dédié est
chiffré si le support l'exige et qu'aucun matériau `integrated` ne le fournit
déjà.* Poser les deux enfermerait l'humidité entre deux films.

Sans réponse, le moteur retient **béton ou chape** — la première option de la
question, comme partout depuis E1-6, et ici le sens sûr : c'est celle qui exige
le film.

### Le référent de `integrated`

`Sous-couche 2mm avec pare-vapeur intégré` entre au catalogue avec ce lot, en
alternative documentée (`is_optional: true`). Sans elle, `integrated` serait une
valeur que rien ne déclare — exactement la donnée inatteignable qu'E1-7 a retirée
du carrelage en chevrons. Source au registre ci-dessus : Quick-Step Basic Plus,
même fabricant que la sous-couche mousse déjà sourcée.

**Portée réelle en V1, écrite noir sur blanc** : le tunnel ne laisse pas encore
l'artisan choisir sa sous-couche, et une liaison `is_optional` n'est jamais
chiffrée d'office. Dans l'application, c'est donc la **nature du support** qui
pilote seule la ligne ; la seconde condition est lue par le moteur, éprouvée par
`estimations/vapour-barrier.spec.ts`, et atteignable dès qu'un choix de
sous-couche existera.

### Réserve : le plancher chauffant

Le DTU en fait un **troisième** déclencheur, indépendant du support. Le produit
ne pose la question nulle part — ni au parquet, ni au carrelage — et l'ajouter
dépassait la demande de ce lot. Conséquence assumée et non couverte : sur un
plancher chauffant posé sur plancher bois, le moteur conclut « pas de film
nécessaire » là où le DTU en exige un. **Le sens de l'écart n'est pas le sens
sûr** ; c'est écrit ici pour ne pas être redécouvert.

## Découpe à longueur : aboutables et non aboutables (E1-8)

Le moteur métrait l'ossature en mètres linéaires puis divisait par la longueur de
barre. C'est le bon calcul pour un **rail**, posé en course continue au sol et au
plafond : deux bouts de barre s'aboutent et rien ne se perd. C'est le mauvais
pour un **montant**, coupé à la hauteur de la cloison, dont la chute ne va nulle
part.

`materials_catalog.offcuts_reusable` porte la distinction. `false` réserve le
matériau au comptage en pièces (`estimations/piece-cutting.ts`) :
`barres = ceil(pièces / floor(longueur de barre / longueur de pièce))`.

### Qui est concerné, et qui ne l'est pas

| Matériau | Aboutable ? | Traité | Pourquoi |
|---|---|---|---|
| `Montant M48/M70/M90 2.7m` | **non** | oui | Coupé à la hauteur ; l'ouvrage déclare cette hauteur (`frame_spec`), donc le moteur connaît la longueur de pièce |
| `Fourrure F530 3m` | **non** | oui | Montant de doublage : même découpe, même assiette `frame_stud` |
| `Rail R48/R70/R90 3m` | oui | — | Course continue, les bouts se raboutent |
| `Bande à joint`, `Bande armée`, `Calicot` | oui | — | Vendus au rouleau, débités en continu |
| `Plinthe MDF 60/80`, `Plinthe chêne`, `Plinthe carrelage` | oui | — | Un mur long se plinthe en plusieurs longueurs abouties ; la chute repart sur le mur suivant |
| `Profilé de finition`, `Profilé d'angle`, `Baguette PVC`, `Cornière`, `Listel`, `Profilé de jonction`, `Profil de départ lambris` | **non**, en principe | **non** | Coupés à la hauteur d'un angle ou à la largeur d'une baie, chute perdue. Mais **aucun ouvrage ne déclare leur géométrie de pièce** : le moteur ne saurait pas combien de pièces ni de quelle longueur. Les marquer non aboutables les ferait lever. Ils restent `true` — et ce tableau dit pourquoi |

La conclusion est donc précise : la règle vaut partout où le métier découpe à
longueur, et n'est **applicable** que là où l'ouvrage dit la longueur de la
pièce. Aujourd'hui c'est la trame, et elle seule. Le jour où un ouvrage déclarera
le nombre d'angles d'une pièce ou la largeur d'une baie, les profilés basculeront
sans que le moteur bouge.

### Le facteur de perte de ces matériaux passe à 0 %

Ce n'est pas un renoncement, c'est la conséquence. La chute d'un montant est
désormais **mesurée** — `barres × longueur de barre − pièces × longueur de
pièce`, soit 0,20 m par barre sous 2,50 m de plafond, 7,4 % — et lui ajouter les
12/8/4 % de `partitionWaste()` la compterait deux fois. C'est mot pour mot
l'arbitrage d'E1-7 sur les mortiers-colle, dont la consommation suivait la
surface *achetée* du carrelage au lieu de sa surface *nette* :
**une chute déjà calculée ne se réestime pas.**

La valeur vit dans le catalogue (`measuredOffcutWaste()`), visible et
discutable, plutôt que dans une condition du moteur qui sauterait la résolution.

**Ce que ce 0 % ne couvre pas** : la **casse** — la barre pliée au transport, le
montant recoupé trop court. Aucune fiche ni aucun guide consulté ne la chiffre.
**Le sens de l'écart n'est pas le sens sûr** : le jour où une source la chiffrera,
il n'y aura que trois lignes à remplacer.

### L'écart change de signe, et c'est ce qui le rendait invisible

L'ancien calcul valait `hauteur × (1 + perte)` contre la longueur de barre :

| Cloison | Avant | Après | Écart |
|---|---|---|---|
| 4,00 m sous 2,50 m, intermédiaire | 9 barres (22,400 m ÷ 2,70) | **8** | −1, sur-achat corrigé |
| 17,40 m sous 2,30 m, intermédiaire | 28 barres (74,520 m ÷ 2,70) | **30** | +2, sous-achat corrigé |

Sous 2,50 m au niveau intermédiaire, `2,50 × 1,08 = 2,70` tombe **exactement**
sur la barre : le compte était juste par coïncidence — et c'est la configuration
de référence du harnais, donc aucun instantané ne pouvait rien montrer. D'où
l'invariant **I7** (`seeded-catalog-harness.ts`), qui recalcule le compte attendu
depuis l'assiette de l'ouvrage et non depuis les champs de la ligne.

## Assiettes linéaires et comptées (E1-10)

E1-7 avait posé « pas de rendement surfacique, pas de ligne » et sorti du
chiffrage tout ce qui se compte au mètre ou à l'unité — plinthes, barres de
seuil, silicone, croisillons. La règle protégeait d'un catalogue non sourçable,
mais elle rendait la liste inachetable : un artisan ne part pas au dépôt sans
plinthes. E1-10 la remplace (`docs/MATERIAUX_OUVRAGES.md`, règle E1-10) : le
linéaire et le comptage deviennent des **assiettes** du moteur, au même titre
que la surface et la trame.

**`floor_perimeter` — le périmètre au sol, portes déduites.** Calculé par
`computeWorkBasis` : `unionPerimeterCm(segments)` (exact pour toute forme
rectilinéaire — le séjour en L rend 18 m, pas la somme des rectangles) moins la
largeur des ouvertures `type = 'door'`, clampé à ≥ 0, en mètres. Une plinthe ne
traverse pas un passage de porte ; une fenêtre ne la troue pas. Monotone en
chaque dimension de la pièce : les bornes CV-5 restent exactes.

**`door_count` — le nombre de passages de porte.** Somme des `count` des
ouvertures `type = 'door'`. Une barre de seuil par passage.

**Le type d'ouverture atteint enfin le moteur.** `openings.type`
(porte/fenêtre) existait en base et à l'écran mais n'était pas transmis ;
E1-10 le câble (`RoomData`, `PublicOpeningDto`, mappers du service). Sur le
chemin public, le champ est **optionnel** — aucun client existant ne casse — et
son absence vaut `door` : l'ouverture unique typique d'une pièce est sa porte,
et le sens de l'erreur résiduelle (une fenêtre comptée porte) coûte une barre
de seuil en trop et quelques décimètres de plinthe en moins, jamais l'inverse
silencieux.

**Assiette déclarée = erreur bruyante.** Une cloison créée n'a ni contour au
sol ni passages de porte : un matériau à driver linéaire lié à un ouvrage
déclaré fait échouer le chiffrage avec le nom du matériau et de l'ouvrage —
même règle que `frame_runner` sans `frame_spec`, jamais un zéro silencieux.

**Encadrements `driver_base`.** Les bornes I3 de ces matériaux
(`materials/consumption-bounds.data.ts`, champ `per: 'driver_base'`) sont
exprimées **par unité d'assiette du driver** — m de plinthe par m de périmètre,
barre par passage — et le harnais divise par l'assiette recalculée via
`resolveMeteringQuantity`. Un rapport au m² d'ouvrage varierait du simple au
triple avec la géométrie de la pièce : il serait soit tautologique sur la pièce
d'épreuve, soit faux sur une autre.

**Double achat assumé, écrit ici** : plinthes et barres de seuil sont liées à
`floor_tiling` **et** `parquet_flooring`. Un projet qui pose les deux ouvrages
dans la **même pièce** achèterait deux jeux — entrée dégénérée (deux sols dans
une pièce) ; dans deux pièces différentes, deux jeux est le compte juste,
chaque pièce ayant ses seuils et son périmètre.

## Déclenchement du SEL (E1-10)

Le NF DTU 52.2 impose une protection à l'eau sous carrelage dans les locaux
très exposés (zones de douche, locaux EB+ privatifs) ; dans un séjour ou une
cuisine, le SEL est un bidon acheté pour rien. La condition n'est ni une
propriété du produit ni de l'ouvrage : c'est l'**exposition à l'eau du local**,
et seul l'utilisateur la connaît. Le modèle de pièce n'a pas de type de local
(le nom est un texte libre) : la question est donc portée par l'ouvrage, comme
`subfloor_type` (E1-8).

Même architecture en trois pièces que le pare-vapeur :

| Quoi | Où | Valeurs |
| --- | --- | --- |
| La question | `work_types.contextual_questions`, clé `water_exposure`, sur `floor_tiling` et `wall_tiling`, requise | `dry` (défaut) · `wet_room` |
| Le rôle produit | `materials_catalog.wet_room_system` | `sel` · `sealing_band` · `NULL` |
| La règle | `estimations/wet-room.ts`, `resolveWetRoom` | exclusions et inclusions motivées, rendues à l'écran |

**Le défaut est `dry`, et c'est une inversion assumée de la doctrine E1-8
« défaut = sens sûr »** (arbitrage utilisateur du 2026-08-08). Pour le
pare-vapeur, le sens sûr coûtait un rouleau sur les seuls parquets ; ici,
« sûr = exposé » achèterait un kit de 32 kg et sa bande sur **tous** les
carrelages non répondus du chemin public — chaque séjour, chaque cuisine.
Le garde-fou est l'exclusion motivée : en local sec, la ligne SEL sort en
exclusion **visible** (« Local déclaré sec : aucun système d'étanchéité
liquide requis… ») — dans les deux sens, l'artisan voit que sa réponse a été
lue. L'invariant I6 tient : les deux réponses changent les lignes.

**Assiettes.** Le SEL suit la surface d'ouvrage **entière** (sol sur
`floor_tiling`, murs nets sur `wall_tiling`) ; la bande d'étanchéité suit le
périmètre au sol (jonction sol/mur), sur `floor_tiling` seulement — le linéaire
des angles verticaux d'une paroi n'est connu d'aucune donnée du modèle, la
bande murale reste donc hors chiffrage (écrit dans `MATERIAUX_OUVRAGES.md`).

**Simplification V1, sens sûr** : le DTU n'exige le SEL que sur la zone
exposée ; l'assiette retenue est la surface entière, réductible par les
exclusions de zone (ENG-3, « zone douche uniquement »). L'écart résiduel
achète trop, jamais trop peu. Une pièce carrelée sol et murs achète du SEL
pour les deux assiettes, mutualisé en un seul compte de kits par
`aggregatePurchases` — c'est le comportement correct d'une douche, pas un
double achat.

## Préparation du support (E1-10)

Les NF DTU 52.2 (carrelage) et 51.11 (parquet flottant) tolèrent un support
dont les défauts de planéité ne dépassent pas **5 mm sous la règle de 2 m** ;
au-delà, ragréage. La planéité est un diagnostic que l'artisan fait réellement,
à la règle, sur le chantier — donc une question, `floor_flatness`, sur
`floor_tiling` et `parquet_flooring` (requise, `flat` par défaut — même
arbitrage et même garde-fou d'exclusion motivée que `water_exposure`).

| Quoi | Où | Valeurs |
| --- | --- | --- |
| La question | clé `floor_flatness`, `floor_tiling` + `parquet_flooring` | `flat` (défaut) · `uneven` |
| Le rôle produit | `materials_catalog.substrate_prep` | `leveling_compound` · `leveling_primer` · `NULL` |
| La règle | `estimations/floor-prep.ts`, `resolveFloorPrep` | même squelette que `wet-room.ts` |

**Le primaire suit le ragréage — par la donnée produit, pas par le code.** Les
fiches de ragréage prescrivent le primaire avant application (PRB : ACCROSOL
prescrit selon support) ; les deux portent le même déclencheur et sortent
ensemble, dans les deux sens. Le « primaire seul sur support fermé » (ancien
carrelage sans ragréage) reste hors périmètre : ce diagnostic-là n'a pas de
question honnête en V1 — le C2 flexible est précisément retenu pour adhérer
aux supports existants.

**Épaisseur retenue : 3 mm** — le plancher de la plage « locaux P3,
rénovation : 3 à 10 mm » (PRB). C'est l'hypothèse qui donne 4,5 kg/m² aux deux
ragréages ; un chantier plus creusé consomme plus, et la fourchette I3
(4,2-5 kg/m²) n'encadre que l'hypothèse écrite, comme pour les colles E1-5.

## Croisillons : dérivation géométrique (E1-10)

Aucun fabricant ne publie de table de consommation de croisillons (Rubi,
Raimondi, Taliaplast vérifiés en E1-7) — c'est ce qui les avait fait retirer.
Ce qui les réintègre n'est pas une fiche, c'est une **dérivation géométrique du
même statut que la longueur de joint** de la formule Cermix : dans un
calepinage droit, chaque sommet intérieur du quadrillage joint quatre carreaux
et reçoit une croix, et le nombre de sommets par m² égale asymptotiquement le
nombre de carreaux par m², soit `10 000 / (L_cm × l_cm)`.

La loi vit dans `estimations/tile-consumption.ts` (`spacersPerM2`, modèle
`tile_spacers`), le rendement seedé est exprimé à la géométrie de référence
(45 × 45 : 4,94 croisillons/m², donc 40,5 m² par sachet de 200) et le moteur
dérive le rendement effectif du format posé — 25/m² en 20 × 20, 10/m² pour la
faïence 25 × 40. Insensible à la largeur de joint (le croisillon **fixe** la
largeur, il ne la remplit pas) et au sens de pose (la diagonale ne change pas
le nombre de carreaux sous un m²). Décision de registre :
`définitionnel — dérivation géométrique`, sans URL, et c'est écrit tel quel
plutôt que maquillé en source.

**Coupe V1 sur les tailles** : un seul SKU obligatoire par ouvrage — le 3 mm,
joint recommandé du 45 × 45 comme du 25 × 40 — les 2 mm et 5 mm en
alternatives documentées. Faire suivre le SKU à `joint_width_mm` serait un
mécanisme nouveau (sélection de matériau par paramètre) que le moteur n'a
pas ; la **quantité**, elle, est identique quel que soit le SKU.

## Temps de pose unitaires (E2-1)

Le registre des temps de main-d'œuvre par ouvrage, pose et niveau — la donnée
que `labor_times` (migration `…097`) seede depuis
`apps/api/src/projects/labor-times.data.ts`, et que
`labor-sources-catalogue.spec.ts` confronte à ce tableau, comme
`sources-catalogue.spec.ts` le fait pour les rendements matière.

**Doctrine.** Chaque ligne cite un document librement consultable :
organisation professionnelle, référentiel de formation, guide de mise en
œuvre, presse spécialisée, retour public de professionnel. Contrairement à un
rendement matière, un temps de pose n'est jamais définitionnel : les cinq
champs de source sont obligatoires. La fourchette basse-haute est l'étalement
des chiffres publiés sur l'hypothèse d'ouvrage écrite dans « Conditions »,
jamais la valeur retenue ± une tolérance (même doctrine que les encadrements
de consommation).

**Axes.** `Pose` est une pose de `POSES_BY_WORK_TYPE` (`standard` pour les
ouvrages sans variante de calepinage). `Niveau` vaut `—` quand la ligne vaut
pour tous les niveaux — le cas normal : les sources libres publient des temps
de professionnel confirmé. Une ligne par niveau n'existe que si une source la
différencie réellement. Contrat de résolution (E2-2) : `(pose, niveau)` exact,
sinon `(pose, —)`, sinon la ligne de base `(pose par défaut, —)` que le spec
garantit pour chaque ouvrage.

Les cadences journalières publiées sont converties à 7–8 h effectives par
jour selon ce que la source précise ; la conversion est écrite dans le
`source_basis_fr` de chaque ligne du fichier de données.

| Ouvrage | Pose | Niveau | Unité | Basse (h) | Haute (h) | Valeur retenue (h) | Conditions | Source | URL | Consulté le |
|---|---|---|---|---|---|---|---|---|---|---|
| `wall_painting` | `standard` | — | m² | 0.22 | 0.40 | 0.25 | 2 couches acryliques au rouleau, mur sain, rechampi courant compris, h ≤ 2,60 m ; hors impression, préparation, protection | Hougard — Bibliothèque de temps unitaires | https://hougard.fr/bibliotheque-de-temps-unitaires | 2026-08-08 |
| `wall_painting` | `standard` | `beginner` | m² | — | — | 0.60 | Idem base, poseur débutant — facteur ≈ 2,4 sourcé appliqué au temps de base | Omizi — Combien de temps faut-il pour peindre une pièce | https://omizi.com/guides/peintres/combien-de-temps-faut-il-pour-peindre-une-piece | 2026-08-08 |
| `ceiling_painting` | `standard` | — | m² | 0.24 | 0.44 | 0.28 | 2 couches au rouleau sur perche, plafond sain, accessible sans échafaudage ; hors impression, préparation, protection | Hougard — Bibliothèque de temps unitaires | https://hougard.fr/bibliotheque-de-temps-unitaires | 2026-08-08 |
| `ceiling_painting` | `standard` | `beginner` | m² | — | — | 0.70 | Idem base, poseur débutant — facteur ≈ 2,5 sourcé (1–3 h pro contre 5–8 h débutant pour 20 m²) | Cap-BTP — Combien de temps pour peindre un plafond de 20 m² | https://www.cap-btp.com/combien-de-temps-pour-peindre-un-plafond-de-20m2/ | 2026-08-08 |
| `floor_tiling` | `straight` | — | m² | 0.45 | 1.25 | 0.80 | Grès cérame 45 × 45, double encollage, support préparé plan, joints compris ; hors ragréage, primaire, plinthes, étanchéité | Meilleur-Artisan — Quel temps met un carreleur professionnel pour poser un m² | https://www.meilleur-artisan.com/discussion/quel-temps-met-un-carreleur-professionnel-pour-poser-un-m2-de-carrelage.41877.html | 2026-08-08 |
| `floor_tiling` | `straight` | `beginner` | m² | — | — | 1.60 | Idem base, poseur débutant — 5 à 8 m²/jour publiés en pose pure | Esprit Brico — Temps de pose du carrelage | https://espritbrico.fr/temps-pose-carrelage/ | 2026-08-08 |
| `floor_tiling` | `diagonal` | — | m² | 0.95 | 1.60 | 1.20 | Idem pose droite, traçage préalable et découpes d'angle sur toute la périphérie — +50 % retenu | Rénovation Habitat — Pose de carrelage en diagonale | https://www.renovation-habitat.info/pose-carrelage-en-diagonale | 2026-08-08 |
| `wall_tiling` | `straight` | — | m² | 0.80 | 1.60 | 1.20 | Faïence 25 × 40, local humide, découpes autour des points d'eau, joints compris ; hors étanchéité, préparation | BG Habitat Conseil — Combien de m² pose un carreleur par jour | https://www.bghabitatconseil.fr/combien-m2-pose-carreleur-jour/ | 2026-08-08 |
| `wall_tiling` | `straight` | `beginner` | m² | 1.60 | 2.70 | 2.20 | Idem base, poseur débutant — 3 à 5 m² par journée publiés | Ain Carrelages — Combien de temps pour poser du carrelage | https://www.ain-carrelages.com/blog/combien-de-temps-pour-poser-du-carrelage-n101 | 2026-08-08 |
| `parquet_flooring` | `straight` | — | m² | 0.15 | 0.45 | 0.30 | Stratifié/contrecollé clipsé flottant sur sous-couche, support plan ; hors préparation, plinthes, barres de seuil | Ynspir — Prix de pose du parquet au m² | https://ynspir.com/conseils-decoration/renovation/prix-renovation/prix-de-pose-du-parquet-au-m2/ | 2026-08-08 |
| `parquet_flooring` | `straight` | `beginner` | m² | 0.35 | 0.80 | 0.50 | Idem base, poseur débutant | Fait Pour Vous — Comment poser du parquet flottant | https://www.faitpourvous.fr/bricolage/poser-parquet-flottant | 2026-08-08 |
| `parquet_flooring` | `herringbone` | — | m² | 0.47 | 1.75 | 1.00 | Bâton rompu collé ou clipsé, produit dédié, support plan ; hors préparation, plinthes, seuils | Domindo — Parquet bâton rompu : pourquoi la pose est-elle plus chère | https://www.domindo.fr/parquet-baton-rupt-pose-coute | 2026-08-08 |
| `drywall` | `standard` | — | m² | 0.80 | 1.10 | 0.95 | Cloison 72/48, montants entraxe 60, laine 45 mm, 1 BA13 par face, bandes 2 faces comprises, par m² de cloison ; séchages non comptés | Matiso — Combien de temps pour monter une cloison | https://www.matiso.fr/combien-de-temps-pour-monter-une-cloison | 2026-08-08 |
| `drywall` | `standard` | `beginner` | m² | 1.20 | 1.70 | 1.50 | Idem base, poseur débutant | Matiso — Combien de temps pour monter une cloison | https://www.matiso.fr/combien-de-temps-pour-monter-une-cloison | 2026-08-08 |
| `wall_covering` | `standard` | — | m² | 0.15 | 0.35 | 0.25 | Intissé, colle appliquée au mur, raccord simple, mur préparé ; hors dépose, préparation, séchage | Mon Papier Peint — Guide de pose du papier peint intissé | https://www.monpapierpeint.com/blogs/journal/guide-pose-papier-peint-intisse | 2026-08-08 |
| `wall_covering` | `standard` | `beginner` | m² | 0.40 | 0.60 | 0.50 | Idem base, poseur débutant — barème expérimenté/débutant publié | Le Monde du Papier Peint — Combien de temps pour poser du papier peint | https://lemondedupapierpeint.fr/blogs/blog/combien-de-temps-pour-poser-du-papier-peint | 2026-08-08 |

**Poses et niveaux non chiffrés.** Aucune source libre ne chiffre la
diagonale en parquet, la diagonale en faïence murale, le raccord sauté en
papier peint, ni le niveau `expert` d'aucun ouvrage : pas de ligne plutôt
qu'une ligne inventée. Le contrat de résolution fait retomber ces cas sur la
ligne applicable — `(pose, —)` puis `(pose par défaut, —)`.

### Ce que ces temps n'incluent pas

Quatre postes restent hors des temps unitaires, et chacun a un traitement
proposé plutôt qu'un silence :

- **Préparation du support** (rebouchage, ponçage, ragréage, primaire, dépose
  de l'ancien revêtement) : déjà partiellement matérialisée côté matériaux
  (E1-10 : ragréage, primaire, SEL conditionnés au support déclaré). Le temps
  de préparation correspondant est un candidat à des lignes sourcées
  supplémentaires de ce registre — pas une majoration cachée des temps de
  pose.
- **Protection et bâchage** de la pièce : forfait par pièce, proposé comme
  ligne de MO distincte au devis (E2-2), pas un temps au m².
- **Nettoyage de fin de chantier** : forfait par chantier, même traitement.
- **Déplacement** : dépend de l'entreprise et non de l'ouvrage — sa place est
  au profil d'entreprise (frais de déplacement), jamais dans un temps
  unitaire.

### Note légale — bases commerciales

Batiprix et BatiChiffrage commercialisent précisément cette donnée. Aucune
valeur de ce registre n'en provient, directement ou via un site qui les
republie ; le spec refuse toute ligne qui les cite. Quand la seule source
trouvable pour une valeur est une base commerciale, la valeur est écartée et
le cas consigné ici plutôt que repris.

Cas écartés à ce jour :

- **Temps unitaires normatifs du carrelage** : aucune organisation
  professionnelle (CAPEB, FFB, OPPBTP) ne publie de cadence librement
  consultable — les temps « officiels » de ce corps d'état n'existent qu'en
  bordereaux commerciaux. Les valeurs du registre viennent donc de cadences
  publiées par des artisans en exercice et de guides éditoriaux
  indépendants, en fourchette large.
- **UPMF-FFB, « outils pratiques »** (peinture et revêtements muraux) :
  réservés aux adhérents — non consultés, non repris.
- **Blog technique d'un éditeur de bordereau** (chiffrage des cloisons sur
  ossature métallique) : écarté sans lecture des valeurs.
- **Support de cours « étude de prix » hébergé sur une plateforme de
  partage** créditant explicitement un extrait de bordereau commercial :
  écarté.
- **Pages marketing d'éditeurs de logiciels de devis** adossés à ces bases
  (calculateurs, blogs) : écartées d'office, sans en extraire de chiffre.

Recherche non aboutie côté institutions : CAPEB, FFB, SNIP et OPPBTP ne
publient pas de temps unitaires en libre accès (l'OPPBTP traite la
pénibilité, pas les cadences) ; les référentiels CAP/BP/AFPA décrivent des
compétences, pas des rendements. Deux exceptions librement consultables ont
été retenues : un sujet officiel de BTS Aménagement Finition (temps unitaire
d'étude de prix d'une cloison, borne haute du registre) et la fiche conseil
SNIP n° 18 (quantitatifs par m² de cloison, utilisée pour convertir les
cadences « m² de plaque » en « m² de cloison »,
https://www.lesindustriesduplatre.org/wp-content/uploads/2025/03/SNIP-FICHE-CONSEIL-18-VERSIONS-2025_V6-13fevrier.pdf).

### `labor_minutes_per_m2` : retirée du chiffrage (E2-2)

**Plus aucun code ne lit cette colonne.** Depuis E2-2, `GET
/quotes/labor-proposal` chiffre la main-d'œuvre sur le registre ci-dessus, via
`resolveLaborTime` (`projects/labor-time-resolution.ts`), avec les axes pose et
niveau que ces sept constantes ne pouvaient pas exprimer.

`work_types.labor_minutes_per_m2` (migration `…072`) reste **en base** jusqu'à
la version suivante : la règle expand-only de `docs/deploy/MIGRATIONS.md`
interdit de supprimer une colonne dans le lot qui cesse de la lire, puisque le
code N-1 doit tourner sur le schéma N. Son `DROP` est un item de backlog.

Les valeurs conservées ici pour mémoire — **non sourcées**, des ordres de
grandeur métier sans référence normative, ce qui est précisément la raison de
leur retrait :

| Ouvrage | min/m² | Hypothèse |
| --- | --- | --- |
| `wall_painting` | 8 | Peinture murale, 2 couches, protection et rechampi compris, artisan seul |
| `ceiling_painting` | 10 | Peinture plafond, 2 couches, travail en hauteur |
| `wall_covering` | 15 | Revêtement mural, intissé, lés pleins |
| `parquet_flooring` | 20 | Parquet/stratifié, pose flottante, sous-couche comprise |
| `drywall` | 35 | Cloison sèche Placostil® 72/48, simple peau 2 faces, bandes comprises |
| `floor_tiling` | 40 | Carrelage sol 45 × 45, double encollage (même hypothèse que le registre ci-dessus) |
| `wall_tiling` | 50 | Carrelage mural, faïence 25 × 40, plus de découpes qu'au sol |

La doctrine du trou de données, elle, est reprise telle quelle par la
résolution : un ouvrage sans aucune ligne au registre ne reçoit **aucune**
heure proposée — 0 h et pas de source — plutôt qu'un temps inventé. L'écran de
création affiche la base retenue sous chaque ligne (temps unitaire × assiette,
niveau, organisme et lien), et les heures restent modifiables ligne à ligne :
la source éclaire la proposition, elle ne suit pas le devis émis.

## Réintégrer un matériau retiré

Deux portes (mise à jour de `docs/BACKLOG_V1.md` requise) :

- **Rappel d'achat forfaitaire** : `complementary_materials` porte des
  quantités par défaut indépendantes de la géométrie — depuis E1-10, il ne
  reste que **bac à peinture** et **profil de finition** (la barre de seuil en
  est sortie, migration `…093` : sa quantité dépend du nombre de portes, donc
  du catalogue, règle E1-6).
- **Rendement sourcé ou définitionnel dans une assiette que le modèle
  connaît** : surface, parement, trame, périmètre au sol, passages de porte,
  géométrie du carreau (règle E1-10, `docs/MATERIAUX_OUVRAGES.md`). C'est la
  porte qu'ont prise silicone, plinthes, seuils et croisillons. Ce qui reste
  dehors y reste pour l'une de deux raisons, jamais par principe : grandeur
  inconnue du modèle (cornières d'angle d'une cloison), ou rendement non
  sourçable (espacement des cales de dilatation).
