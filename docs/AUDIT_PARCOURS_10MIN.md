# Audit du parcours artisan — « entrée dans le chantier → devis envoyé »

> E4-4 de [BACKLOG_V1.md](BACKLOG_V1.md). Mesuré le 5 août 2026 à 390 × 844 px
> sur le compte artisan seedé (palier `contractor_essentiel`, profil entreprise
> complet, taux horaire 45 €/h).
>
> Les chiffres viennent de `apps/web/e2e/parcours-chrono.spec.ts`, rejouable par
> `pnpm exec playwright test parcours-chrono`. Ce fichier n'en est pas la copie :
> il en est la lecture.

---

## 1. Méthode

### 1.1 Deux grandeurs, jamais mélangées

| | Origine | Ce que ça dit |
|---|---|---|
| **Temps machine** | Mesuré par le script : délai entre le geste qui quitte un écran et le moment où le suivant est utilisable | Réseau + rendu. Ce que le produit contrôle directement. |
| **Temps humain** | Modélisé, à partir des gestes **réellement comptés** par le script | Ce que l'artisan vit. Un robot tape en 0 ms : mesurer sa frappe ne dirait rien. |

Le temps machine relevé ici est celui du **serveur de développement Next**, qui
recompile chaque route à la première visite : 8,4 s cumulées sur le premier
scénario exécuté, 1,6 à 3,2 s sur les suivants une fois les routes chaudes. Ce
n'est pas un chiffre de production, et il est de toute façon marginal devant le
temps humain (moins de 6 % du total).

### 1.2 Barème de coût humain

Fixé **avant** la mesure, dans `parcours-chrono.spec.ts` :

| Geste | Coût | Justification |
|---|---|---|
| Tap | 1,2 s | Viser et toucher une cible de 44 px, une main sur le téléphone |
| Saisie d'un nombre | 4,0 s | Focus + frappe d'un nombre court au pavé décimal |
| Décision | 3,0 s | Lire une question et choisir (ouvrage, niveau, prix d'un matériau) |
| Scroll | 1,5 s | Faire défiler jusqu'à une cible hors champ, puis la retrouver |

**Les scrolls ne sont pas estimés, ils sont mesurés** : avant chaque geste, le
script lit la position de la cible dans le viewport de 844 px et compte un
scroll quand elle en sort.

### 1.3 Ce que le barème ne couvre pas

Le décamètre, le déplacement dans le logement, la recherche d'un prix dans
l'application d'un fournisseur, la conversation avec le client. Ces minutes-là
sont réelles ; elles ne sont pas du temps d'écran et le produit n'a pas de prise
dessus. **Tous les totaux ci-dessous sont du temps d'écran seul.**

### 1.4 Scénarios

| | Pièces | Ouvrages | Matériaux à chiffrer |
|---|---|---|---|
| **1** | 1 | Peinture murale | 3 |
| **2** | 3 | Peinture murale + plafond | 4 |
| **3** | 1 | Peinture murale + plafond + carrelage sol | 8 |

Le scénario 3 n'est pas un cas extrême : c'est une salle d'eau. Il existe parce
que le nombre de matériaux suit le nombre d'**ouvrages distincts**, pas le
nombre de pièces — le moteur mutualise les achats entre pièces (ENG-2). Le
scénario 2, lui, isole le coût de la répétition par pièce.

---

## 2. Le chiffre d'ensemble

| Scénario | Taps | Temps humain | Temps machine | **Total écran** |
|---|---|---|---|---|
| 1 — une pièce, un ouvrage | 13 | 63,6 s | 8,4 s | **1 min 12** |
| 3 — une pièce, trois ouvrages | 22 | 122,9 s | 1,6 s | **2 min 04** |
| 2 — trois pièces, deux ouvrages | 33 | 142,6 s | 3,2 s | **2 min 26** |

**La promesse des dix minutes est tenue, avec une marge de 4 à 8 fois.** Le
constat honnête est donc que le parcours n'est pas en danger sur sa durée : il
l'est sur ce qu'il fait répéter, et sur la justesse de ce qui en sort
(cf. § 6 — deux défauts trouvés en le parcourant).

Cette marge n'autorise pas à laisser les frottements en place : les minutes
qu'ils coûtent s'ajoutent au temps réel de chantier (mesure au décamètre,
recherche de prix chez le fournisseur), qui n'entre pas dans ce calcul.

---

## 3. Geste par geste

### 3.1 Scénario 1 — une pièce, un ouvrage (3 matériaux)

| Écran | Taps | Champs saisis | Décisions | Scrolls | Machine | Humain |
|---|---|---|---|---|---|---|
| Tableau de bord | 1 | 0 | 0 | 0 | 1,4 s | 1,2 s |
| Mesures | 2 | 3 | 0 | 0 | 1,4 s | 14,4 s |
| Ouvrages | 3 | 0 | 2 | 1 | 1,4 s | 11,1 s |
| Estimation | 1 | 0 | 1 | 0 | 1,4 s | 4,2 s |
| Prix | 4 | 3 | 3 | 1 | 1,4 s | **27,3 s** |
| Devis | 1 | 0 | 1 | 0 | 1,4 s | 4,2 s |
| Envoi | 1 | 0 | 0 | 0 | 0,0 s | 1,2 s |
| **Total** | **13** | **6** | **7** | **2** | **8,4 s** | **63,6 s** |

### 3.2 Scénario 3 — une pièce, trois ouvrages dont carrelage (8 matériaux)

| Écran | Taps | Champs saisis | Décisions | Scrolls | Machine | Humain |
|---|---|---|---|---|---|---|
| Tableau de bord | 1 | 0 | 0 | 0 | 0,3 s | 1,2 s |
| Mesures | 2 | 3 | 0 | 0 | 0,3 s | 14,4 s |
| Ouvrages | 7 | 0 | 6 | 1 | 0,3 s | **27,9 s** |
| Estimation | 1 | 0 | 1 | 0 | 0,3 s | 4,2 s |
| Prix | 9 | 8 | 8 | 2 | 0,3 s | **69,8 s** |
| Devis | 1 | 0 | 1 | 0 | 0,2 s | 4,2 s |
| Envoi | 1 | 0 | 0 | 0 | 0,0 s | 1,2 s |
| **Total** | **22** | **11** | **16** | **3** | **1,6 s** | **122,9 s** |

**L'étape « Prix » pèse 57 % du parcours.** Les sept taps de l'étape
« Ouvrages » se décomposent en trois tuiles d'ouvrage, deux questions
contextuelles du carrelage (format, type de pose), le niveau de compétence, et
« Calculer ».

### 3.3 Scénario 2 — trois pièces, deux ouvrages (4 matériaux)

| Écran | Taps | Champs saisis | Décisions | Scrolls | Machine | Humain |
|---|---|---|---|---|---|---|
| Tableau de bord | 1 | 0 | 0 | 0 | 0,3 s | 1,2 s |
| Mesures — pièce 1 | 2 | 3 | 0 | 0 | 0,3 s | 14,4 s |
| Ouvrages — pièce 1 | 4 | 0 | 3 | 1 | 0,2 s | 15,3 s |
| Estimation (traversée) | 1 | 0 | 0 | 0 | 0,1 s | 1,2 s |
| Retour Travaux — pièce 2 | 1 | 0 | 0 | 0 | 0,1 s | 1,2 s |
| Retour Mesures — pièce 2 | 1 | 0 | 0 | 0 | 0,0 s | 1,2 s |
| Mesures — pièce 2 | 2 | 3 | 0 | 0 | 0,3 s | 14,4 s |
| Ouvrages — pièce 2 | 4 | 0 | 3 | 1 | 0,2 s | 15,3 s |
| Estimation (traversée) | 1 | 0 | 0 | 0 | 0,1 s | 1,2 s |
| Retour Travaux — pièce 3 | 1 | 0 | 0 | 0 | 0,1 s | 1,2 s |
| Retour Mesures — pièce 3 | 1 | 0 | 0 | 0 | 0,0 s | 1,2 s |
| Mesures — pièce 3 | 2 | 3 | 0 | 0 | 0,3 s | 14,4 s |
| Ouvrages — pièce 3 | 4 | 0 | 3 | 1 | 0,2 s | 15,3 s |
| Estimation | 1 | 0 | 1 | 0 | 0,3 s | 4,2 s |
| Prix | 5 | 4 | 4 | 1 | 0,2 s | 35,5 s |
| Devis | 1 | 0 | 1 | 0 | 0,3 s | 4,2 s |
| Envoi | 1 | 0 | 0 | 0 | 0,0 s | 1,2 s |
| **Total** | **33** | **12** | **15** | **4** | **3,2 s** | **142,6 s** |

**Une pièce supplémentaire coûte 33,3 s**, dont 15,3 s à re-sélectionner les
mêmes ouvrages et le même niveau de compétence, et 3,6 s d'aller-retour pur
(traverser l'estimation puis remonter deux étapes).

> **Le parcours multi-pièces se trompe silencieusement si on l'aborde
> autrement.** Les ouvrages sont enregistrés **par pièce**
> (`POST /work-items?room=…`). Mesurer les trois pièces d'affilée puis choisir
> les ouvrages une seule fois produit un devis ne couvrant qu'**une** pièce,
> sans le moindre avertissement. La première version du script de chronométrage
> est tombée exactement dans ce piège. Rien à l'écran ne dit qu'une pièce mesurée
> n'a pas d'ouvrage.

---

## 4. Ce qui va bien, et qu'il ne faut pas casser

Mesuré, pas supposé :

- **`StickyActionBar` fait son travail.** Sur les 7 écrans et les 3 scénarios,
  **aucune** action principale n'a demandé de scroll : « Enregistrer les
  dimensions », « Calculer », « Chiffrer les matériaux », « Générer le devis »,
  « Créer le devis » et « Envoyer le devis » étaient toutes dans les 844 px au
  moment du geste. Les 2 à 4 scrolls comptés sont ailleurs (§ 5.2, § 5.3).
- **`FlowProgress` rend le retour arrière possible en un tap**, ce dont le
  scénario 2 dépend entièrement.
- **La virgule décimale passe partout** : `2,5` a été saisi tel quel dans les
  champs de hauteur des trois scénarios, sans conversion préalable.
- **La feuille de partage native** reste le chemin d'envoi ; en environnement de
  test (Chromium desktop, pas de `navigator.canShare({files})`), le repli
  téléchargement s'exécute comme prévu et le PDF sort non vide.

Ces quatre points sont des acquis de PRO-5. Toute correction ci-dessous les
préserve.

---

## 5. Frottements

### 5.1 Les quatre pré-remplissages demandés — état réel du code

| Pré-remplissage | État | Détail |
|---|---|---|
| **Taux horaire du profil d'entreprise** | ✅ **déjà fait** | `quotes.service.ts:305` lit `default_labor_hourly_rate` et le pose sur chaque ligne proposée. **Mais** la colonne est nullable et jamais seedée (migration `…072`, volontairement — leçon 18). Profil sans taux ⇒ toutes les lignes à 0 ⇒ `laborRateMissing` désactive « Créer le devis », et **aucun écran ne dit où régler le taux**. |
| **Dernier client** | ❌ absent | `GET /clients` trie par `created_at DESC` ; `ClientSelect` démarre sur « Sans client ». **Volontairement non corrigé**, cf. § 7. |
| **Dernier matériau utilisé** | ❌ sans objet | Les matériaux ne sont pas choisis par l'artisan : ils sont **dérivés** des ouvrages par le moteur (`work_type_materials`). Il n'y a pas de « dernier matériau » à pré-remplir. Ce qui se pré-remplit, c'est l'ouvrage — cf. ligne suivante. |
| **Ouvrages et niveau du dernier chantier** | ❌ absent | `WorkSelectionForm` démarre vide et le niveau de compétence est obligatoire sans défaut, à **chaque pièce de chaque chantier**. Coût mesuré : 15,3 s par pièce (2 ouvrages), 27,9 s avec le carrelage et ses questions contextuelles. |
| **Prix déjà saisis pour le même matériau** | ❌ absent | `real_unit_price` vit dans `shopping_lists.items_json`. Il est reporté d'une régénération à l'autre **au sein du même projet** (`shopping-lists.service.ts:63-87`), et perdu d'un chantier au suivant. Coût mesuré : 8,2 s par matériau, soit 69,8 s sur le scénario 3. |

### 5.2 Validations bloquantes

| Validation | Où | Coût mesuré | Verdict |
|---|---|---|---|
| Niveau de compétence obligatoire, sans défaut | `WorkSelectionForm` | 1 tap + 1 décision + **1 scroll** = 5,7 s par pièce (le bloc « Niveau de compétence » tombe sous les 7 tuiles d'ouvrage, donc hors des 844 px) | À corriger (§ 6, C) |
| Interstitiel « aucune ouverture » | `DimensionsForm` | 1 tap + 1 décision = 4,2 s, seulement si aucune porte ni fenêtre | **Conservé**, § 7 |
| `laborRateMissing` désactive la création du devis | `quote/new` | 5,2 s par ligne de MO, **à chaque devis** tant que le profil n'a pas de taux | À corriger (§ 6, B) |
| `pricedCount === 0` désactive « Générer le devis » | `shopping-list` | 0 s — le garde-fou est juste et son prérequis est annoncé dans la barre collante | **Conservé** |
| Questions contextuelles du carrelage obligatoires | `ContextualQuestions` | 8,4 s | **Conservé** : format et pose changent le métré, ils ne sont pas devinables |

### 5.3 Les deux scrolls restants

- **Étape « Ouvrages »** : 1 scroll par pièce, pour atteindre le niveau de
  compétence sous les 7 tuiles. Disparaît si le niveau est pré-rempli.
- **Étape « Prix »** : 1 scroll (3–4 matériaux), 2 scrolls (8 matériaux), pour
  parcourir la liste. Disparaît largement si les prix connus sont repris d'un
  geste.

---

## 6. Corrections retenues, par gain décroissant

Le seuil est de **30 s**, appliqué au gain mesuré sur le scénario où la
correction pèse le plus.

### A — Se souvenir des prix déjà saisis · **jusqu'à 62,9 s**

| Scénario | Avant | Après (estimé) | Gain |
|---|---|---|---|
| 3 — 8 matériaux | 69,8 s | 6,9 s | **62,9 s** |
| 2 — 4 matériaux | 35,5 s | 6,9 s | **28,6 s** |
| 1 — 3 matériaux | 27,3 s | 6,9 s | **20,4 s** |

Chaque matériau coûte aujourd'hui 8,2 s (ouvrir la saisie, taper, retrouver le
prix). Le gain franchit les 30 s **à partir de 5 matériaux**, c'est-à-dire dès
qu'un chantier mêle deux corps d'état.

Nouveau `GET /projects/:id/shopping-list/known-prices` : dernier prix relevé par
matériau sur les chantiers du compte, hors chantier courant. Côté web,
un bouton « Reprendre mes derniers prix (N articles) » et, sur chaque ligne non
chiffrée, l'indice « Dernier prix : 45,90 € — Leroy Merlin, 12 juin ».

**Jamais appliqué automatiquement** (leçon 18) : `real_unit_price` alimente le
budget et le benchmark DATA-4. Un prix posé sans que personne ne le regarde
deviendrait indiscernable d'un relevé. Il entre après un geste explicite, et
l'indice par ligne montre d'abord ce qui va être appliqué.

### B — Reprendre les ouvrages et le niveau du dernier chantier · **jusqu'à 42,3 s**

| Scénario | Avant | Après (estimé) | Gain |
|---|---|---|---|
| 2 — 3 pièces × 2 ouvrages | 45,9 s (3 × 15,3) | 3,6 s (3 × 1,2) | **42,3 s** |
| 3 — 3 ouvrages + questions | 27,9 s | 1,2 s | **26,7 s** |
| 1 — 1 ouvrage | 11,1 s | 1,2 s | **9,9 s** |

L'artisan de finition refait les mêmes ouvrages, et son niveau de compétence ne
change pas d'un chantier à l'autre. Pour les pièces 2 et 3 d'un même chantier,
la source est plus évidente encore : la pièce précédente.

Les tuiles pré-cochées sont annoncées (« Repris de votre dernier chantier —
modifiable ») : un pré-remplissage invisible serait un choix mis dans la bouche
de l'artisan. Le niveau reste corrigeable à l'étape suivante, qui recalcule.

### C — Le taux horaire quand le profil n'en porte pas · **jusqu'à 31,2 s, et récurrent**

| Cas | Avant | Après | Gain |
|---|---|---|---|
| 6 lignes de MO (scénario 2) | 31,2 s | 5,2 s | **26,0 s**, à chaque devis |
| 3 lignes de MO (scénario 3) | 15,6 s | 5,2 s | 10,4 s, à chaque devis |
| + le voyage vers `/settings/company` pour comprendre | ~35 s | 0 s | **35 s, une fois** |

Gain **nul** pour un artisan dont le profil porte déjà un taux — c'est le cas du
compte mesuré, d'où l'absence de ce coût dans les tableaux du § 3. Le frottement
est réel pour tout artisan qui n'est jamais allé dans ses réglages, et il se
répète à chaque devis jusqu'à ce qu'il y aille.

Un champ « Taux horaire » unique dans la section Main d'œuvre, appliqué à toutes
les lignes d'un tap, avec l'option de l'enregistrer au profil — ce qui ferme le
frottement définitivement.

### D — Le devis n'est jamais marqué « envoyé » · 6 s, mais c'est un état faux

« Envoyer le devis » pousse le PDF dans la feuille de partage native et laisse le
devis en `draft`. Le parcours « jusqu'au devis envoyé » **n'atteint donc jamais
l'état envoyé**, et `sent_at` — qui arme les relances J+7 et J+14 vers le client
(`quote-reminders.service.ts:65`) — reste nul.

Sous le seuil des 30 s, retenu quand même : ce n'est pas un frottement, c'est une
donnée fausse à l'étape terminale du parcours audité. Bascule automatique sur
`'shared'` uniquement — `apiShareOrDownload` distingue déjà `'shared'`,
`'downloaded'` et `'cancelled'`, et un téléchargement n'est pas un envoi.

---

## 7. Frottements non corrigés, et pourquoi

| Frottement | Coût mesuré | Raison de ne pas corriger |
|---|---|---|
| **Pré-sélection du dernier client** | ~4 s | Un devis adressé à la mauvaise personne coûte sans commune mesure plus cher que 4 s. Le champ reste « Sans client » : l'absence de choix doit rester visible. |
| **Interstitiel « aucune ouverture »** | 4,2 s, et seulement sans porte ni fenêtre | Il attrape une vraie erreur de chiffrage : oublier une porte gonfle la peinture de plusieurs m². Un garde-fou qui coûte 4 s et évite un devis faux se garde. |
| **Niveau de compétence répété à l'étape Estimation** | 0 s (aucun geste obligatoire) | Ce n'est pas un doublon de saisie : c'est le point de correction du calcul, là où l'on voit l'effet du facteur de perte sur les quantités. |
| **Aller-retour entre pièces (Estimation traversée + 2 retours)** | 3,6 s par pièce supplémentaire, soit 7,2 s sur 3 pièces | Sous le seuil. Une sortie « mesurer la pièce suivante » économiserait 2 taps par pièce ; elle demande de repenser la sortie de deux étapes du tunnel pour 4,8 s sur un chantier de trois pièces. |
| **Champs de prix repliés derrière l'icône €** | 1,2 s par matériau (9,6 s sur le scénario 3) | Largement neutralisé par la correction A : avec les prix repris d'un geste, la saisie ne s'ouvre plus que sur les lignes réellement à corriger. Les déplier tous rallongerait l'écran pour tout le monde. |
| **CTA « Devis-minute » sous les boutons secondaires du tableau de bord** | 0 s mesuré (le bouton reste dans les 844 px) | Le coût supposé n'existe pas à la mesure. Rien à corriger. |
| **Sélecteur d'unités Mètres / Pieds-Pouces** | 0 s (défaut métrique) | Aucun geste obligatoire. |

---

## 8. Défauts trouvés en parcourant le parcours

Ce ne sont pas des frottements : ce sont des sorties fausses. Ils n'ont pas été
trouvés par la lecture du code mais par le chronométrage réel (leçon 21).

### 8.1 Le dernier prix saisi peut ne jamais partir — silencieusement

`shopping-list/page.tsx` enregistre les prix par un **debounce de 300 ms réarmé
à chaque saisie** (`scheduleSave`). Sur mobile, le tap sur « Générer le devis »
est aussi ce qui fait perdre le focus au champ de prix : le `PATCH` est
programmé et la navigation part dans le même geste. `QuotesService.create` ne
retient que les lignes portant un prix réel — **le matériau disparaît du devis
sans un mot**.

Reproduit deux fois de suite par le script de chronométrage, qui échouait sur
« Créer le devis » resté désactivé, `pricedItems` étant vide côté serveur.

Correctif : vider les mises à jour en attente **avant** de quitter l'étape.

### 8.2 Le tableau de bord promet une étape qui n'existe plus

Le bouton « Devis-minute » annonce « Photo de la pièce → devis PDF envoyé au
client ». L'analyse photo est débranchée de la production (ADR 0001 D2) et
l'étape a quitté le tunnel. La première promesse faite à l'artisan sur son
écran d'accueil décrit un parcours qui n'existe pas.

*(Le même retrait avait laissé `apps/web/e2e/artisan-devis-minute-pdf.spec.ts`
cliquer sur un bouton « Passer cette étape » disparu — corrigé à part.)*

---

## 9. Après correction

Mêmes scénarios, même script, même compte, même viewport.

| Scénario | Taps avant → après | Humain avant → après | Gain |
|---|---|---|---|
| 1 — une pièce, un ouvrage (3 art.) | 13 → **10** | 63,6 s → **36,0 s** | **− 27,6 s (− 43 %)** |
| 3 — une pièce, trois ouvrages (8 art.) | 22 → **13** | 122,9 s → **48,6 s** | **− 74,3 s (− 60 %)** |
| 2 — trois pièces, deux ouvrages (4 art.) | 33 → **22** | 142,6 s → **74,4 s** | **− 68,2 s (− 48 %)** |

Écran par écran, là où les corrections portent :

| Écran | Sc. 1 | Sc. 3 | Sc. 2 |
|---|---|---|---|
| **Prix** | 27,3 → 5,4 s (**− 21,9**) | 69,8 → 5,4 s (**− 64,4**) | 35,5 → 5,4 s (**− 30,1**) |
| **Ouvrages** (cumul toutes pièces) | 11,1 → 5,4 s (− 5,7) | 27,9 → 18,0 s (− 9,9) | 45,9 → 7,8 s (**− 38,1**) |
| **Scrolls du parcours** | 2 → **0** | 3 → **0** | 4 → **0** |

Ce que les chiffres disent, et ce qu'ils ne disent pas :

- **Le rappel des prix (A) tient exactement ce qu'il annonçait** : 64,4 s sur le
  chantier à trois corps d'état, contre 62,9 s prévus. L'étape « Prix » ne
  dépend plus du nombre d'articles — un tap, quelle qu'en soit la longueur.
- **La reprise des ouvrages (B) dépasse les 30 s là où elle avait été
  arbitrée** : 38,1 s sur le chantier de trois pièces, où l'écran est traversé
  une fois par pièce. Ailleurs elle rapporte moins (9,9 s au scénario 3, 5,7 s
  au scénario 1) — **parce qu'elle ne rapporte que dans la mesure où le
  chantier suivant ressemble au précédent**. Quand il en diffère, l'artisan
  décoche : c'est un geste, et il est compté dans les chiffres ci-dessus. Le
  script fait foi ici, pas l'intention : il amène l'écran à la sélection
  demandée et compte les décochages comme les cochages.
- **Les scrolls ont disparu.** Les deux qui restaient (le niveau de compétence
  sous les sept tuiles, la traversée de la liste de prix) tombent avec les
  saisies qui les provoquaient. Sur les trois scénarios, aucun geste du
  parcours ne demande plus de faire défiler l'écran à 390 px.
- **Le taux horaire (C) ne se voit dans aucun de ces chiffres**, et c'est
  normal : le compte mesuré porte un taux dans son profil entreprise. Le gain
  (26,0 s par devis à six lignes, plus les ~35 s du voyage vers les réglages)
  ne concerne que l'artisan qui n'y est jamais allé.
- **Ces mesures dépendent de l'historique du compte**, par construction : le
  rappel ne peut rendre que des prix déjà relevés, la reprise que des ouvrages
  déjà choisis. Sur un compte neuf, le premier chantier coûte le prix d'avant ;
  c'est le deuxième qui encaisse le gain.

Le parcours passait déjà sous les dix minutes ; il y passe désormais en
**moins d'une minute et demie de temps d'écran**, y compris sur le chantier de
trois pièces. Ce qui a été retiré n'est pas de l'attente, c'est de la
ressaisie : **23 taps et 11 champs en moins** sur les trois scénarios.

### Les deux défauts du § 8

- **8.1 — prix perdu à la sortie de l'étape** : corrigé. Les saisies en attente
  sont vidées avant de quitter vers le devis, la clôture ou le PDF. Le
  chronométrage, qui échouait deux fois sur trois sur « Créer le devis » resté
  désactivé, passe désormais sans attente artificielle.
- **8.2 — la promesse « Photo de la pièce »** : corrigée sur le tableau de
  bord, qui décrit maintenant le parcours réel.

### Ce que le lot a aussi corrigé, trouvé en chemin

- **Une pièce déjà chiffrée revenait vide.** `WorkSelectionForm` fige son état
  dans ses initialiseurs et ne se remonte qu'au changement de pièce ; la
  sélection enregistrée lui était fournie par un effet, donc *après* son premier
  rendu. Revenir sur une pièce pour corriger un ouvrage montrait un écran vierge.
  La sélection est désormais dérivée des pièces chargées, pas posée après coup.
- **Le champ de prix des accessoires refusait la virgule** (`type="number"`),
  seul champ de prix du parcours à ne pas être passé en `DecimalInput` lors de
  PRO-5. « 3,5 » y devenait une chaîne vide sans un signal.
