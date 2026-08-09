# Chiffréo — Backlog V2

> Suite de `CHIFFREO_REFONTE.md`. Périmètre : le chiffrage juste des ouvrages de finition, gratuit ; la conformité, payante à l'année.
> **65 tâches, 65 commandes.** Chaque tâche porte : résultat attendu, zones du dépôt, critère de fin vérifiable, charge humaine, **modèle Claude**, **niveau d'effort**, **commande exacte**.
> Modèles, alias, prix et niveaux d'effort **revérifiés sur la documentation officielle le 6 août 2026** (sources en Partie D).

---

# Partie A — Comment lire les recommandations de modèle

## A.1 Le catalogue réel, vérifié le 6 août 2026

| Modèle | Alias Claude Code | ID API | Contexte / sortie | Prix $/MTok (in–out) | Coupure de connaissances | Effort |
|---|---|---|---|---|---|---|
| **Fable 5** | `fable` | `claude-fable-5` | 1M / 128k | 10 – 50 | Janvier 2026 | supporté, défaut `high` |
| **Opus 5** | `opus` | `claude-opus-5` | 1M / 128k | 5 – 25 | **Mai 2026** | supporté, défaut `high` |
| **Sonnet 5** | `sonnet` | `claude-sonnet-5` | 1M / 128k | **2 – 10 jusqu'au 31 août 2026**, puis 3 – 15 | Janvier 2026 | supporté, défaut `high` |
| **Haiku 4.5** | `haiku` | `claude-haiku-4-5-20251001` | **200k / 64k** | 1 – 5 | **Février 2025** | **non supporté** |

**Mythos 5** (`claude-mythos-5`, 10 – 50) partage les capacités de Fable 5 sans ses classificateurs de sécurité, mais n'est disponible qu'en **accès restreint via Project Glasswing**. Il n'est utilisable ni ici ni dans Claude Code : **aucune tâche de ce backlog ne le référence.**

Alias composites employés :

- **`opusplan`** — Opus 5 pendant le plan mode, puis bascule automatique sur Sonnet 5 pour l'exécution. Le bon outil quand la difficulté est dans la conception et le volume dans la frappe : vous payez le raisonnement à 5 $/MTok et l'écriture à 2 $/MTok.
- **`opus[1m]` / `sonnet[1m]`** — sans effet ici : Opus 5 et Sonnet 5 ont nativement la fenêtre 1M.

## A.2 Les niveaux d'effort, et ce que dit la documentation

| Niveau | Définition officielle | Emploi dans ce backlog |
|---|---|---|
| `low` | Tâches simples privilégiant vitesse et coût minimal | **0 tâche.** Trop risqué sur un dépôt dont 1 500 tests n'ont pas vu un défaut d'ordre de grandeur. |
| `medium` | Équilibre vitesse/coût/performance | 8 tâches — édition mécanique sur périmètre déjà décidé. |
| `high` | **Défaut sur tous les modèles qui supportent l'effort.** Raisonnement complexe, codage difficile, agentique | 34 tâches — le régime normal. |
| `xhigh` | *« Capacité étendue pour le travail long-horizon »* : 30 min et plus, budgets en millions de tokens, appels d'outils répétés | 20 tâches — moteur, migrations, sécurité, argent, recherche longue. |
| `max` | Capacité maximale sans contrainte de tokens | **0 tâche.** La doc avertit : *« ajoute un coût significatif pour des gains de qualité relativement faibles, et peut conduire à sur-réfléchir »*. Rien ici ne le justifie. |
| `ultracode` | Réglage Claude Code : envoie `xhigh` **et** fait orchestrer des workflows multi-agents. Session uniquement, Claude Code ≥ v2.1.203 | Proposé **en option** sur 2 tâches seulement, là où la parallélisation est réelle. |

Quatre points vérifiés qui changent l'usage :

1. **L'échelle d'effort est calibrée par modèle** : `high` sur Opus 5 et `high` sur Sonnet 5 ne représentent pas la même valeur sous-jacente. Un même niveau ne se compare pas d'un modèle à l'autre.
2. **`ultrathink` ne change pas l'effort envoyé à l'API.** Le mot-clé fait ajouter par Claude Code une instruction de raisonnement plus profond dans le contexte, **pour ce tour seulement**. Utile ponctuellement ; il ne remplace jamais `/effort`.
3. **Si vous demandez un niveau que le modèle ne supporte pas**, Claude Code retombe silencieusement sur le plus haut niveau supporté en dessous. D'où l'omission de la ligne `/effort` sur les tâches Haiku : elle ne ferait rien.
4. **Sur Opus 5 en `xhigh` ou `max`, le thinking ne peut plus être désactivé** (erreur 400). Prévoir un `max_tokens` large sur ces tâches.

Et le diagnostic officiel quand un résultat déçoit : *« Did it not try hard enough, or did it not know enough ? »* — s'il a sauté un fichier ou n'a pas lancé les tests, **montez l'effort** ; s'il a réellement essayé et s'est trompé, **montez le modèle**.

## A.3 La règle de sélection appliquée ici

Quatre questions, dans cet ordre :

1. **Une erreur coûte-t-elle de l'argent, du droit ou de la confiance ?** — calcul de quantités, migration de schéma, Stripe, RGPD, suppression de code, rédaction juridique → **Opus 5**. Coupure de connaissances mai 2026, la plus récente du lineup : c'est le seul modèle qui connaît nativement les versions de framework de ce dépôt. Ne jamais descendre pour économiser.
2. **La tâche est-elle spécifiable précisément à l'avance ?** — frontend, contenu, SEO, tests, intégrations → **Sonnet 5**. Et jusqu'au **31 août 2026** son prix d'introduction le place à 40 % du prix d'Opus 5 : il y a une raison de calendrier à concentrer ces tâches ce mois-ci.
3. **La tâche est-elle plus grande qu'une session, ambiguë, à forte composante de recherche autonome ?** — curation de catalogue, veille concurrentielle, sourcing → **Fable 5**. C'est sa définition officielle. Sur une tâche bien spécifiée, c'est payer 10/50 $ pour rien.
4. **La tâche est-elle purement mécanique, sans idiome de framework récent ?** → **Haiku 4.5**. Attention : sa coupure de connaissances fiable est **février 2025**, or ce dépôt tourne sur Next.js 16, React 19, Tailwind 4 et NestJS 11 — tous postérieurs. Haiku n'est employé ici que sur du YAML, du markdown et de la normalisation de fichiers.

## A.4 Format des commandes

```text
/model <alias>
/effort <niveau>
<prompt>
```

`/model` sur une conversation déjà entamée demande confirmation (l'historique est relu sans cache) : **ouvrez une session par tâche**. En mode non interactif (`-p`), `/effort` ne vaut que pour la session — passez `--effort` au lancement. Pour Haiku, **la ligne `/effort` est omise**.

**Prérequis : Claude Code ≥ v2.1.219.** Sur une version antérieure, `/model opus` sélectionne silencieusement Opus 4.8 et toutes les recommandations d'effort de ce document deviennent inadaptées — Opus 4.7/4.8 ont une posture d'effort différente. Vérifiez avec `claude --version`, faites `claude update` sinon.

Toutes les commandes supposent le workflow de `CLAUDE.md` : plan mode pour le non-trivial, commit à chaque fin de tour, rien de « fait » sans preuve.

---

# Partie B — Le backlog

Charge = charge humaine de pilotage et de relecture, pas temps machine. **S** ≤ ½ j · **M** 1–2 j · **L** 3–5 j.

---

## E0 — Les deux semaines qui décident

*Avant toute ligne de code produit. C'est l'épic que le plan précédent n'avait pas, et son absence est le mécanisme qui a produit trois backlogs successifs.*

---

### E0-1 · Renormaliser les fins de ligne

**Résultat** — l'arbre de travail est propre. Les 272 fichiers modifiés (80 387 insertions = 80 387 suppressions) sont du bruit CRLF↔LF, pas du travail.
**Zones** — `.gitattributes`, tout l'arbre.
**Fin quand** — `git status --short` ne rend rien, et un `git diff` après une session ne montre plus de différence de fin de ligne. **Charge S.**

**`/model haiku`** — normalisation mécanique de fins de ligne et vérification d'un fichier de configuration git. Aucun idiome de framework n'intervient, donc la coupure de connaissances de février 2025 est sans conséquence. Le contexte de 200k suffit largement : on ne lit pas les fichiers, on les renormalise. À 1/5 $ par MTok, c'est cinq fois moins cher que Sonnet pour un résultat identique. **Pas de ligne `/effort` : Haiku 4.5 ne supporte pas le paramètre.**

```text
/model haiku
L'arbre de travail montre 272 fichiers modifiés avec exactement autant d'insertions que de suppressions : c'est du bruit de fin de ligne CRLF contre LF, pas du travail en cours. Le fichier .gitattributes a été modifié récemment (ajout de *.snap text eol=lf et *.sh text eol=lf) mais la copie de travail est restée en CRLF. Vérifie d'abord que .gitattributes couvre bien tous les types de fichiers du dépôt (ts, tsx, js, mjs, json, md, yml, yaml, sh, snap, sql, py, txt) avec une politique de fin de ligne explicite, et complète-le si besoin. Puis exécute git add --renormalize . et commite en une seule fois avec le message : chore(git): renormalize line endings. Avant de commiter, confirme-moi que git diff --cached --stat ne contient QUE des changements de fin de ligne et aucune modification de contenu réel. Si un fichier .git/index.lock traîne, signale-le sans le supprimer toi-même.
```

---

### E0-2 · Corriger `docs/MODELES_CLAUDE.md`

**Résultat** — la fiche modèles du dépôt cesse de recommander Opus 4.8 et `xhigh` par défaut. Elle reflète le catalogue du 6 août 2026 et la posture d'effort d'Opus 5.
**Zones** — `docs/MODELES_CLAUDE.md`.
**Fin quand** — plus aucune occurrence d'« Opus 4.8 » comme recommandation active, et chaque affirmation porte sa source et sa date de vérification. **Charge S.**

**`/model sonnet` · `/effort medium`** — réécriture documentaire sur un périmètre entièrement décidé : la Partie A du présent document fournit la matière, il n'y a aucun arbitrage à faire. Sonnet 5 est le bon rapport qualité/prix pour de la prose technique structurée, et à son prix d'introduction (2/10 $ jusqu'au 31 août) c'est le choix évident. `medium` parce que la tâche est un remplacement guidé, pas un raisonnement.

```text
/model sonnet
/effort medium
Réécris docs/MODELES_CLAUDE.md. Le fichier est périmé : ses recommandations par tâche citent encore "Opus 4.8" alors que l'alias opus résout vers Opus 5 depuis Claude Code v2.1.219, et il recommande xhigh par défaut, ce qui était la posture d'Opus 4.7/4.8 et non celle d'Opus 5. Le catalogue vérifié le 6 août 2026 est : Fable 5 (alias fable, 1M/128k, 10-50 $/MTok, coupure janvier 2026), Opus 5 (alias opus, 1M/128k, 5-25 $, coupure mai 2026), Sonnet 5 (alias sonnet, 1M/128k, 2-10 $ jusqu'au 31 août 2026 puis 3-15 $, coupure janvier 2026), Haiku 4.5 (alias haiku, 200k/64k, 1-5 $, coupure février 2025, ne supporte pas le paramètre effort). Mythos 5 existe mais n'est accessible qu'en accès restreint via Project Glasswing : mentionne-le pour mémoire et précise qu'il est hors de portée. Les niveaux d'effort sont low, medium, high (défaut), xhigh, max, plus le réglage Claude Code ultracode. Rappelle que l'échelle d'effort est calibrée par modèle, que ultrathink ne change pas l'effort envoyé à l'API, et que la doc déconseille max. Retire toute la section 4 "Recommandations par tâche" : elle référence un backlog qui n'existe plus, et les recommandations vivent désormais dans le backlog courant. Ajoute sous chaque tableau une ligne "vérifié le 2026-08-06" avec l'URL de la source. Vérifie : aucune occurrence restante d'Opus 4.8 en tant que recommandation active.
```

---

### E0-3 · Réparer les accents du tunnel et du devis

**Résultat** — l'application ne montre plus « Selection des travaux », « Niveau de competence », « Main d'oeuvre », « Validite (jours) », « Actif jusqu'àu ». Et surtout : les conditions de règlement imprimées sur le devis envoyé au client final cessent de sortir en « Acompte de 30 % a la commande, solde a la reception des travaux ».
**Zones** — `apps/web/src/lib/work-types.ts:58-70`, `apps/web/src/app/(app)/projects/[id]/{work-selection,estimate,quote/new}/page.tsx`, `apps/web/src/components/{dimensions/DimensionsForm,dimensions/OpeningsSection,project/ProjectCard}.tsx`, les conditions de règlement par défaut côté API.
**Fin quand** — un test interdit la régression, et un devis PDF généré est en français correct. **Charge S.**

**`/model sonnet` · `/effort high`** — la tâche est spécifiable, mais elle n'est pas un simple rechercher-remplacer : il faut distinguer les chaînes affichées à l'utilisateur des identifiants techniques (`skill_level`, codes d'ouvrage, clés de traduction) qu'il ne faut surtout pas accentuer, et couvrir les chaînes générées côté API qui atterrissent dans le PDF. `high` — le défaut — parce que le risque est de casser une clé en croyant corriger un libellé.

```text
/model sonnet
/effort high
Une partie des libellés affichés à l'utilisateur sont désaccentués ou fautifs, y compris dans le devis PDF envoyé au client final de l'artisan. Exemples relevés : "Selection des travaux", "Niveau de competence", "facteurs de perte adaptes", "Debutant", "Intermediaire", "Main d'oeuvre", "Validite (jours)", "Recapitulatif", "Creation...", "prix renseigne(s)", "Vous n'avez pas ajoute de portes ou fenêtres", "Les dimensions semblent incoherentes", "Actif jusqu'àu {date}", et les conditions de règlement par défaut "Acompte de 30 % a la commande, solde a la reception des travaux". Fais un relevé exhaustif de toutes les chaînes affichées à l'utilisateur dans apps/web/src et de toutes les chaînes de texte français générées côté apps/api/src qui finissent dans un PDF ou un e-mail. Corrige l'orthographe et les accents, y compris les apostrophes typographiques. RÈGLE ABSOLUE : ne touche à aucun identifiant technique, clé d'objet, code d'ouvrage, valeur d'énumération, nom de variable ou chaîne comparée en test — uniquement ce qui est rendu à l'écran ou imprimé. Ajoute ensuite un test qui échoue si une chaîne affichée contient une séquence désaccentuée connue (liste : "competence", "Validite", "renseigne", "ajoute ", "incoherentes", "Recapitulatif", "adaptes", "a la commande", "a la reception"). Vérifie : pnpm test:web, pnpm test:api, pnpm lint, et montre-moi le rendu texte des conditions de règlement par défaut après correction.
```

---

### E0-4 · Écrire le test rouge de l'assiette

**Résultat** — un test qui échoue et qui prouve le défaut le plus grave du dépôt : une cloison sèche est chiffrée sur le périmètre entier de la pièce. Pour une chambre de 12 m², le moteur facture 25 plaques de BA13 quand une cloison de 4 ml en demande environ 7.
**Zones** — `apps/api/src/estimations/__tests__/`, `apps/api/src/projects/work-types.data.ts:110`.
**Fin quand** — le test échoue avec un message qui nomme l'assiette utilisée et l'assiette attendue. Un test rouge qui échoue pour la bonne raison **est** le livrable. **Charge S.**

**`/model opus` · `/effort high`** — écrire un test qui échoue pour la bonne raison suppose de comprendre d'abord pourquoi le code produit ce qu'il produit ; c'est du raisonnement sur du code existant, pas de la génération. Opus 5 parce que ce test devient le contrat de toute l'épic E1 : mal posé, on « répare » l'assiette sans la réparer. Sa coupure de mai 2026 lui donne aussi les idiomes Jest/NestJS courants du dépôt. `high` suffit : périmètre d'un fichier, cible connue.

```text
/model opus
/effort high
Écris un test unitaire qui prouve le défaut d'assiette de la cloison sèche, sans rien corriger. Contexte : work-types.data.ts:110 déclare drywall.surface_target = 'wall', donc le moteur calcule la surface de cloison comme le périmètre de la pièce multiplié par la hauteur. Pour une chambre de 400x300x250 cm, cela donne 14 ml x 2,50 m = 35 m² bruts, et le snapshot existant montre 25 plaques de BA13, 28 montants, 11 rails, 5 rouleaux de bande et 2 seaux d'enduit. Le cas d'usage réel est de CRÉER une cloison de 4 ml de long sur 2,50 m de haut, parementée sur deux faces, soit 10 m² d'ouvrage : environ 7 plaques. Utilise le harnais existant apps/api/src/estimations/__tests__/seeded-catalog-harness.ts. Le test doit exprimer l'intention métier "je crée une cloison de 4 ml dans cette pièce" et assérer : nombre de plaques BA13 entre 6 et 9 ; longueur de montants entre 15 et 25 ml ; longueur de rails entre 8 et 12 ml. Il DOIT échouer aujourd'hui. Ne modifie ni le moteur, ni les données, ni work-types.data.ts. Termine en m'expliquant précisément quelle ligne de code produit chaque valeur observée, et en listant les champs de saisie qui manquent au modèle de données pour que cette intention soit exprimable. Vérifie : le test échoue, et pnpm test:api ne régresse pas ailleurs.
```

---

### E0-5 · Instruire ArtisanSmart et Tactidevis

**Résultat** — une note de veille qui dit si le créneau est occupé, et sur quel axe exactement Chiffréo reste différenciant. ArtisanSmart vend 29 € HT/mois un « SmartChiffrage » qui calcule les quantités **et les heures de main-d'œuvre** sur 15 métiers, et il est référencé Activateur France Num.
**Zones** — `docs/VEILLE_CONCURRENTIELLE.md` (à créer).
**Fin quand** — vous savez, chiffres à l'appui, ce que produisent leurs moteurs sur une chambre de 12 m² en peinture et sur une cloison de 4 ml — et la note conclut par une phrase de positionnement tenable. **Charge M.**

**`/model fable` · `/effort xhigh`** — c'est exactement la définition officielle de Fable 5 : problème ambigu, plus grand qu'une session, forte composante de recherche autonome, vérification de son propre travail. Il faut croiser des pages de vente, des avis indépendants, des annuaires, des registres d'entreprise et des captures produit, sans qu'aucune source ne fasse autorité seule. Sa fenêtre de 1M absorbe le corpus sans compaction. `xhigh` parce que c'est la définition du niveau : recherche web répétée, appels d'outils en chaîne, horizon de plus de 30 minutes. **Le coût (10/50 $) est justifié une fois** : cette note conditionne les neuf semaines de l'épic E1.

```text
/model fable
/effort xhigh
Produis docs/VEILLE_CONCURRENTIELLE.md, une note de veille factuelle sur les concurrents qui revendiquent un CALCUL AUTOMATIQUE DE QUANTITÉS DE MATÉRIAUX sur le marché français, en août 2026. Cibles prioritaires : ArtisanSmart (artisansmart.fr, 29 € HT/mois, fonction "SmartChiffrage", 15 métiers, référencé Activateur France Num) et Tactidevis (tactidevis.fr, environ 36 €/mois, partenaire CAPEB). Cibles secondaires : Nexartis, ChantierFlow, Vox Bati, Costructor, Obat, Mediabat ScanPlan, JLogiciels Pack Métré Artisan. Pour chacun, établis : identité juridique (SIREN, date de création, effectif si trouvable), prix exact HT et TTC, périmètre de métiers, ce que le calcul de quantités produit réellement (liste de matériaux ? conditionnements commerciaux ? heures de main-d'œuvre ?), la méthode apparente (constante au m² ou vrai métré géométrique), et si des sources techniques sont citées derrière les ratios. Cherche des avis indépendants, des captures d'écran, des vidéos de démonstration, des mentions sur les annuaires (appvizer, tool-advisor, lebonlogiciel, Capterra) et sur francenum.gouv.fr. Distingue rigoureusement ce que tu as vérifié de ce que tu déduis, et dis explicitement ce que tu n'as pas pu vérifier. Conclus par deux sections : (1) un tableau comparatif face à Chiffréo sur huit axes — surface nette, pièces non rectangulaires, déduction des ouvertures, facteur de perte par pose et par niveau, conditionnement commercial, sources citées, heures de main-d'œuvre, nombre de métiers ; (2) une phrase de positionnement défendable pour Chiffréo, et la liste des affirmations commerciales qu'il ne peut PLUS faire sans mentir, à commencer par "le seul outil qui calcule les quantités". Ne modifie aucun autre fichier.
```

---

### E0-6 · Rédiger les cinq e-mails de prospection négoce et fabricant

**Résultat** — cinq e-mails prêts à envoyer, proposant le moteur de métré en marque blanche ou en API. C'est le seul geste du plan dont le rendement est asymétrique : un contrat couvre l'objectif de revenu entier.
**Zones** — `docs/PROSPECTION_B2B2C.md` (à créer).
**Fin quand** — les cinq e-mails sont envoyés. Pas rédigés : envoyés. **Charge S.**

**`/model opus` · `/effort high`** — de la rédaction commerciale française à fort enjeu, adressée à des directions d'enseigne. Chaque e-mail doit être court, crédible, et proposer une chose vérifiable en cinq minutes sans engager. C'est le registre où Opus 5 est nettement au-dessus de Sonnet : prose dense, argumentation adaptée à un interlocuteur qui n'est pas technique, et jugement sur ce qu'il ne faut **pas** dire. `high` — c'est de l'écriture, pas du long-horizon.

```text
/model opus
/effort high
Rédige docs/PROSPECTION_B2B2C.md contenant cinq e-mails de prospection prêts à envoyer, plus la liste des destinataires à identifier. Contexte : Chiffréo est un moteur de métré des ouvrages de finition — il transforme les dimensions d'une pièce relevées au télémètre en liste d'achat en conditionnements commerciaux réels (pots, sacs, boîtes, plaques), avec la géométrie exacte (pièces en L, décrochés, ouvertures déduites) et des ratios adossés à des fiches fabricants datées. Le modèle économique visé est un contrat de marque blanche ou d'API. L'argument central pour un négoce : ce moteur se termine par un bon de commande dans SON catalogue, avec SES références et SES prix — c'est un actif de panier moyen et de fidélisation, pas un coût. Précédent à citer sans le nommer comme menace : Tolteck est distribué par Point.P, Cedeo, Asturienne et La Plateforme du Bâtiment, mais Tolteck ne calcule aucune quantité — il fait saisir les m² à la main. Destinataires : (1) Gedimat, (2) Tout Faire Matériaux, (3) Chausson Matériaux ou Doras, (4) un fabricant de plaques de plâtre (Siniat ou Knauf), (5) un fabricant de colles et mortiers (Cermix ou Parexlanko). Chaque e-mail fait au maximum 150 mots, ouvre sur leur problème et non sur le produit, propose UNE chose concrète et sans engagement (une démonstration de 15 minutes en visio sur un de leurs chantiers types), et ne demande jamais d'argent. Adapte l'angle : un négoce achète de la fidélisation, un fabricant achète de la prescription de ses propres rendements. Ajoute pour chacun l'objet de l'e-mail, la fonction du destinataire à viser, et une relance à J+10 en trois lignes. Ne promets aucune fonctionnalité qui n'existe pas dans le dépôt : le périmètre chiffrable est peinture murale et plafond, carrelage sol et mural, parquet/stratifié, cloison sèche, revêtement mural. Ne modifie aucun autre fichier.
```

---

### E0-7 · Instruire le coût de la Plateforme Agréée et de la RC Pro

**Résultat** — deux chiffres qui manquent au modèle économique : ce que coûte le raccordement à une Plateforme Agréée par client et par mois, et ce que coûte une RC Pro éditeur de logiciel avec extension erreur de calcul. Sans eux, la marge annoncée est fausse et la décision D5 ne peut pas être prise.
**Zones** — `docs/CONFORMITE_FACTURATION.md` (section à ajouter), `docs/ASSURANCE_ET_RISQUE.md` (à créer).
**Fin quand** — trois PA ont été comparées sur leurs conditions de sous-traitance, et deux courtiers ont été identifiés avec une fourchette de prime. **Charge M.**

**`/model fable` · `/effort xhigh`** — recherche ouverte sur un marché de 137 à 156 plateformes agréées dont les conditions de revente ne sont presque jamais publiques, croisée avec un marché de l'assurance professionnelle où rien n'est tarifé en ligne. C'est un problème à réponse non garantie : il faut savoir s'arrêter, dire ce qui n'est pas trouvable, et proposer la démarche pour l'obtenir. Fable 5 est le modèle documenté pour ce profil. `xhigh` pour la même raison qu'en E0-5 : chaîne longue d'appels d'outils.

```text
/model fable
/effort xhigh
Deux chiffres manquent au modèle économique de Chiffréo, et je ne peux pas décider sans eux. Recherche-les et produis-les.

PREMIER CHIFFRE — le coût d'une Plateforme Agréée. À partir du 1er septembre 2027, une TPE française doit émettre ses factures et faire son e-reporting via une Plateforme Agréée par la DGFiP ; le PPF gratuit d'émission a été supprimé. Chiffréo émet des factures pour ses clients artisans : il devra donc se raccorder à une PA en sous-traitance, ou retirer la facturation de son offre. Identifie 3 à 5 PA immatriculées qui proposent un partenariat technique à un éditeur de logiciel tiers (pistes : Iopole, Pennylane, Tiime, Sage, Cegid, Esker, Generix, Yooz, Libeo, Qonto). Pour chacune : conditions d'un partenariat éditeur, modèle tarifaire s'il est public (par facture ? par client ? forfait ?), format technique attendu (Factur-X, UBL 2.1, CII), délai d'intégration annoncé, et existence d'un programme partenaire documenté. Quand le tarif n'est pas public — ce sera le cas le plus fréquent — dis-le explicitement et indique la démarche exacte pour l'obtenir (page de contact partenaire, formulaire, interlocuteur). Termine par une fourchette raisonnée en euros par client et par mois, en distinguant ce qui est sourcé de ce qui est estimé.

SECOND CHIFFRE — la RC Pro. Chiffréo est un éditeur de logiciel qui produit des quantitatifs de matériaux du bâtiment. Si un quantitatif faux provoque une rupture de chantier, le préjudice est une perte purement économique : la directive (UE) 2024/2853 sur les produits défectueux, qui inclut désormais les logiciels, exclut ce type de dommage — le risque est donc contractuel, pas délictuel. Recherche : quels assureurs ou courtiers français couvrent la RC Professionnelle d'un éditeur de logiciel indépendant avec une extension pour erreur de calcul ou de données (pistes : Hiscox, AXA, Allianz, MMA, Simplis, Coover, Orus, Assurup), quelles fourchettes de prime annuelle pour un chiffre d'affaires inférieur à 50 000 €, quelles exclusions typiques, et quels plafonds de garantie usuels. Précise si le fait de citer des fiches fabricants change quoi que ce soit à la couverture — ma présomption est que non.

Livre deux fichiers : une section "Coût d'une Plateforme Agréée" ajoutée à docs/CONFORMITE_FACTURATION.md, et un nouveau docs/ASSURANCE_ET_RISQUE.md. Dans les deux, sépare rigoureusement le sourcé (avec URL) de l'estimé, et termine chacun par les trois actions concrètes à faire pour obtenir le chiffre ferme.
```

---

### E0-8 · Réviser l'ADR 0001

**Résultat** — l'ADR porte les trois décisions nouvelles ou révisées : D4 révisée (chiffrage gratuit, conformité payante annuelle à 279 €), D5 (Plateforme Agréée), D6 (test B2B2C en parallèle). Et il consigne la correction factuelle qui a tout déclenché : le créneau du calcul de quantités est occupé.
**Zones** — `docs/adr/0001-cible-et-perimetre-v1.md`, ou un ADR 0002 qui amende le 0001.
**Fin quand** — l'ADR est opposable : chaque décision porte son contexte, ses alternatives écartées, ses conséquences et ses critères de réouverture. **Charge M.**

**`/model opus` · `/effort high`** — c'est le document qui arbitre tous les suivants ; une décision mal écrite se paie en semaines. Il faut articuler des faits de marché, une contrainte réglementaire datée, un raisonnement de rétention et un aveu d'erreur factuelle, sans perdre la forme ADR ni contredire les décisions D1 à D3 qui restent valables. Opus 5, sans hésitation. `high` : le raisonnement est fourni par le document de refonte, le travail est de le rendre opposable.

```text
/model opus
/effort high
Amende l'ADR docs/adr/0001-cible-et-perimetre-v1.md. Décide toi-même, en le justifiant, s'il vaut mieux modifier le 0001 en place ou créer un ADR 0002 qui l'amende — puis applique ta décision.

Contenu à intégrer.

CORRECTION FACTUELLE du contexte du 0001. Le 0001 suppose que le calcul de quantités n'est servi par personne. C'est faux : ArtisanSmart vend 29 € HT/mois un "SmartChiffrage" qui calcule quantités ET heures de main-d'œuvre sur 15 métiers, et est référencé Activateur France Num. Ce qui reste vrai et différenciant : il calcule avec des constantes au m² (par exemple 12 tuiles/m²), ne cite aucune source technique, et ne fait ni surface nette, ni pièce non rectangulaire, ni déduction d'ouvertures, ni facteur de perte par pose et par niveau, ni conditionnement commercial. Corrige aussi le prix de référence de Tolteck : 25 € HT sans engagement, 19 € en annuel, et -35 % pour les entreprises de moins de cinq ans, soit 12,35 €/mois — pour tous corps d'état.

D1, D2, D3 sont CONFIRMÉES. D3 est étendue : les organisations et le multi-utilisateurs rejoignent le widget, l'API publique et le SSO dans les suppressions.

D4 est RÉVISÉE. L'ancienne décision était un palier unique payant à 19 €/mois. La nouvelle : le chiffrage devient GRATUIT et sans limite de chantiers ; la conformité devient payante — devis PDF conforme, fichier clients, historique de prix, facturation — à 279 € par an, en annuel uniquement, avec 30 jours satisfait ou remboursé. Le palier DIY à 9,99 € est supprimé, ainsi que la landing particulier. Motifs à écrire : on ne peut pas vendre 29 € un calcul face à un concurrent qui vend le même prix quatre fois plus de métiers et face à Tolteck à 12,35 € tous corps d'état ; le calcul est ce qui est dur à copier et coûte zéro à servir, la conformité est ce qu'on ne peut pas quitter ; l'annuel attaque le churn, qui est le facteur limitant — il fait passer la durée de vie moyenne d'environ 20 mois à environ 40 ; et un palier gratuit limité à un chantier interdit la seule démonstration qui compte, à savoir constater sur deux ou trois chantiers qu'on n'a eu ni reste ni manque.

D5 est NOUVELLE — facturation électronique. Émission et e-reporting obligatoires pour les TPE au 1er septembre 2027, PPF gratuit d'émission supprimé, raccordement obligatoire à une Plateforme Agréée. Deux options : (a) partenariat avec une PA en sous-traitance, seule option qui préserve la facturation comme verrou de rétention, coût à instruire de l'ordre de 3 à 6 € par client et par mois ; (b) retirer la facturation de l'offre. Recommandation (a), à trancher en octobre 2026. Écris explicitement la conséquence de l'inaction : une facturation vendue et non conforme au 1er septembre 2027, c'est la totalité de la base client perdue en un mois.

D6 est NOUVELLE — le B2B2C est testé en parallèle, dès maintenant. Question posée : à quelles conditions Chiffréo devient-il un moteur vendu à un négoce ou à un fabricant plutôt qu'un abonnement vendu à 200 artisans ? Fait à consigner : Tolteck a construit sa base de 30 000 clients par la distribution en négoce (Point.P, Cedeo, Asturienne, La Plateforme du Bâtiment), pas par le self-service. Ce canal se négocie par écrit. Écris la règle d'arbitrage : si un négoce ou un fabricant donne une suite sérieuse, cette voie prime sur le SaaS self-service.

Ajoute une section "Critères de réouverture" pour D4, D5 et D6, sur le modèle de la section 5 existante, avec des seuils chiffrés écrits AVANT observation. Mets à jour toute référence au tarif de 19 € ailleurs dans docs/. Ne touche pas au code.
```

---

## E1 — Le moteur métier-juste

*L'épic non négociable. Tant qu'elle n'est pas finie, tout le reste chiffre du vide. Sept à neuf semaines.*

---

### E1-1 · Étendre le harnais aux invariants métier

**Résultat** — le harnais de snapshots ne fige plus seulement la sortie : il asserte des invariants métier. Aucune quantité inférieure au besoin net, aucun accessoire multiplié par les couches, aucun matériau non lié, et un encadrement plausible par unité de surface pour chaque famille.
**Zones** — `apps/api/src/estimations/__tests__/seeded-catalog-harness.ts`, `harness-coverage.spec.ts`.
**Fin quand** — le harnais couvre les 39 cas existants **plus** les configurations introduites en E1-2 à E1-9, et un invariant faux fait rougir la suite. **Charge M.**

**`/model opus` · `/effort xhigh`** — c'est le filet qui protège tout le reste de l'épic : les défauts d'août ont survécu précisément parce qu'aucun test n'exécutait le moteur sur le catalogue réel. Définir des invariants qui attrapent les erreurs sans figer les bugs actuels demande de juger ce qui est une propriété du métier et ce qui est un accident d'implémentation — un raisonnement, pas une transcription. `xhigh` parce que c'est du multi-fichiers avec exécution répétée de la suite sur 39 cas puis davantage : le cas long-horizon revendiqué par ce niveau.

```text
/model opus
/effort xhigh
Étends le harnais apps/api/src/estimations/__tests__/seeded-catalog-harness.ts pour qu'il asserte des INVARIANTS MÉTIER, en plus de figer des snapshots. Aujourd'hui invariantViolations ne vérifie que deux propriétés : ne chiffrer que les matériaux liés, et jamais moins que le besoin. C'est insuffisant : les défauts corrigés en août avaient survécu à 1 500 tests. Ajoute les invariants suivants, chacun avec un message d'échec qui nomme l'ouvrage, le matériau et les deux valeurs comparées.
1. Aucune quantité achetée inférieure à la quantité théorique ajustée.
2. Aucun matériau dont applies_coats est faux ne voit sa quantité varier avec le nombre de couches.
3. Pour chaque famille de matériau, la quantité par unité de surface d'ouvrage reste dans un encadrement déclaré en données, et non en dur dans le test : ajoute au registre un intervalle plausible par matériau (minimum et maximum par unité de surface) et fais échouer le test hors de cet intervalle. C'est ce mécanisme qui aurait attrapé le joint de carrelage à 0,25 kg/m² quelle que soit la largeur de joint.
4. Le nombre de contenants achetés est minimal à surplus égal : aucun panachage ne doit exister qui donne strictement moins de contenants pour un surplus inférieur ou égal.
5. Monter le niveau de compétence de beginner à expert ne doit jamais AUGMENTER la quantité d'un matériau, à pose identique.
6. Toute question déclarée required sur un type d'ouvrage doit, si on change sa valeur, changer au moins une quantité produite. Cet invariant échouera aujourd'hui sur le format de carreau : c'est voulu, il sera vert après E1-5.
Rends le harnais paramétrable pour accepter les nouvelles configurations qui arriveront (assiette de cloison, hauteur sous plafond, raccord de papier peint) sans réécriture. Documente en tête de fichier ce que chaque invariant protège et de quel défaut réel il vient. Vérifie : pnpm test:api. Dis-moi explicitement lesquels des six invariants échouent aujourd'hui et pourquoi — je m'attends à ce que 3 et 6 échouent, confirme ou corrige-moi.
```

---

### E1-2 · Concevoir l'assiette par ouvrage

**Résultat** — un modèle de données où chaque ouvrage déclare **ce sur quoi il s'applique**, et où l'utilisateur renseigne cette assiette. La cloison sèche cesse d'être « les murs de la pièce » pour devenir « N mètres linéaires à créer, parementés sur une ou deux faces ».
**Zones** — `apps/api/src/projects/work-types.data.ts`, `entities/project-work-item.entity.ts`, nouvelle migration.
**Fin quand** — le schéma est posé, migré, réversible, et le test d'E0-4 peut exprimer son intention. **Charge L.**

**`/model opusplan` · `/effort xhigh`** — la difficulté est entièrement dans la conception : faut-il une assiette générique portée par l'ouvrage, ou un type d'assiette par famille ? Comment migrer les données existantes sans inventer une longueur de cloison qui n'a jamais été saisie ? Une fois tranché, l'implémentation est du volume mécanique sur des patterns TypeORM connus. `opusplan` fait exactement ce partage : Opus 5 raisonne en plan mode, Sonnet 5 exécute — vous payez la conception à 5 $/MTok et la frappe à 2 $. `xhigh` parce que c'est du multi-fichiers avec migration et retour arrière.

```text
/model opusplan
/effort xhigh
Entre en plan mode. Problème : le moteur applique tout ouvrage à une surface dérivée de la pièce, ce qui est faux pour les ouvrages qu'on CRÉE plutôt qu'on ne recouvre. Aujourd'hui work-types.data.ts:110 déclare drywall.surface_target = 'wall', donc une cloison sèche est chiffrée sur le périmètre entier de la pièce multiplié par la hauteur : 25 plaques de BA13 pour une chambre de 12 m², soit 300 à 500 % de sur-achat. Le même défaut affectera tout doublage.

Conçois d'abord, code ensuite. Questions à trancher et à argumenter AVANT toute ligne de code : faut-il une notion générique d'assiette portée par le type d'ouvrage, avec un mode parmi "surface dérivée de la pièce" et "quantité saisie par l'utilisateur", ou faut-il un type d'assiette distinct par famille d'ouvrage ? Comment exprimer le nombre de faces à parementer, sachant qu'une cloison en a deux et un doublage une seule, et que ce nombre multiplie les plaques mais PAS l'ossature ? Quelle hauteur retenir pour une cloison créée : celle de la pièce, ou une hauteur propre saisissable ? Comment migrer les project_work_items existants qui ont un ouvrage drywall sans qu'aucun linéaire n'ait jamais été saisi — valeur nulle et ouvrage marqué incomplet, ou reprise de l'assiette actuelle en la figeant ? Comment rester réversible ?

Puis implémente le SCHÉMA seulement, pas encore le moteur : extension de work-types.data.ts, extension de l'entité project-work-item, migration réversible avec sa stratégie de reprise, et validation côté DTO. Les ouvrages de recouvrement — peinture murale et plafond, carrelage sol et mural, parquet, revêtement mural — doivent continuer à fonctionner exactement comme aujourd'hui : leur assiette reste dérivée de la pièce, et aucun de leurs snapshots ne doit bouger.

Vérifie : migration up et down sur une base réelle, pnpm test:api, pnpm test:api:integration, pnpm lint, et aucun changement dans les snapshots des six ouvrages de recouvrement.
```

---

### E1-3 · Câbler l'assiette dans le moteur

**Résultat** — le moteur lit l'assiette au lieu de dériver systématiquement de la pièce. Une cloison de 4 ml sur 2,50 m parementée deux faces produit environ 7 plaques, avec une ossature calculée sur une seule trame et non deux.
**Zones** — `apps/api/src/estimations/estimation-engine.ts`, `estimations.service.ts`.
**Fin quand** — le test d'E0-4 passe, et l'ossature n'est pas doublée alors que le parement l'est. **Charge M.**

**`/model opus` · `/effort xhigh`** — c'est le cœur du produit et le piège classique du métré plâtrerie : les plaques se doublent avec le nombre de faces, les rails et montants non, les vis suivent le parement, la bande à joint suit les jonctions. Une erreur ici est invisible en test et fatale devant un plaquiste. Opus 5 parce qu'une erreur coûte la confiance, règle numéro 1 de la sélection. `xhigh` : moteur, plusieurs familles de matériaux, vérification longue sur tous les cas du harnais.

```text
/model opus
/effort xhigh
Câble l'assiette conçue en E1-2 dans le moteur d'estimation. Le moteur doit cesser de dériver systématiquement la surface d'ouvrage de la géométrie de la pièce et lire l'assiette déclarée par le type d'ouvrage.

ATTENTION, c'est le piège du métré plâtrerie et c'est la raison d'être de cette tâche : dans une cloison, le nombre de faces à parementer multiplie les PLAQUES, les VIS et la BANDE À JOINT ainsi que l'ENDUIT, mais PAS l'ossature. Une cloison de 4 ml parementée deux faces a une seule trame de rails et de montants et deux peaux de plaques. Le ratio de référence Placo pour une cloison 72/48 à entraxe 0,60 m est de 2,10 m² de plaque par m² d'ouvrage (deux faces) et 2,10 ml de montant par m² d'ouvrage : ces deux nombres sont égaux par coïncidence, ne les confonds pas dans le code. Introduis explicitement dans le registre une propriété par matériau disant si sa quantité suit le nombre de faces ou la trame, et fais-la porter par les données, pas par une condition en dur sur un code d'ouvrage.

Le calcul de l'ossature doit se faire sur le linéaire et la hauteur réels de la cloison, pas sur une surface. Vérifie que pour une cloison de 4,00 m de long et 2,50 m de haut à entraxe 0,60 m, tu obtiens un nombre de montants cohérent avec la règle de métier (un montant tous les 0,60 m, plus un, plus les montants de rive et d'huisserie si l'ouvrage en déclare) et un linéaire de rail égal à deux fois la longueur, haut et bas.

Les six ouvrages de recouvrement doivent produire des sorties strictement identiques à aujourd'hui. Le test créé en E0-4 doit passer. Vérifie : pnpm test:api, pnpm test:api:integration, pnpm lint, le harnais complet, et montre-moi le rendu du cas cloison 4 ml deux faces ligne par ligne pour que je le relise.
```

---

### E1-4 · Saisir l'assiette dans l'interface

**Résultat** — quand l'utilisateur choisit « cloison sèche », l'interface lui demande le linéaire à créer, la hauteur et le nombre de faces. Quand il choisit « peinture murale », elle ne demande rien de plus qu'aujourd'hui.
**Zones** — `apps/web/src/components/work-selection/WorkSelectionForm.tsx`, `apps/web/src/lib/work-types.ts`, `apps/web/src/app/(app)/projects/[id]/work-selection/page.tsx`.
**Fin quand** — le parcours complet fonctionne de bout en bout pour une cloison, et le chronomètre du parcours ne se dégrade pas sur les ouvrages de recouvrement. **Charge M.**

**`/model sonnet` · `/effort high`** — frontend entièrement spécifiable une fois le schéma d'E1-2 posé : formulaire conditionnel, validation, propagation d'état. C'est le profil exact de Sonnet 5, et à son prix d'introduction c'est 40 % du coût d'Opus pour un résultat équivalent sur ce type de travail. `high`, le défaut, parce qu'il faut quand même ne pas casser le formulaire existant ni la mesure de parcours.

```text
/model sonnet
/effort high
Ajoute la saisie de l'assiette d'ouvrage dans le tunnel, en t'appuyant sur le schéma posé en E1-2 et le moteur câblé en E1-3. Quand l'utilisateur sélectionne un ouvrage dont l'assiette est saisie et non dérivée de la pièce — aujourd'hui la cloison sèche — le formulaire de sélection des travaux doit demander : le linéaire à créer en mètres, la hauteur en mètres préremplie avec la hauteur de la pièce et modifiable, et le nombre de faces à parementer sous forme de choix explicite entre "cloison, deux faces" et "doublage, une face". Ces champs sont obligatoires pour cet ouvrage et ne doivent apparaître pour aucun autre.

Contraintes. Les six ouvrages de recouvrement ne gagnent AUCUN champ : leur parcours doit rester identique au tap près. Réutilise les composants de saisie existants du formulaire plutôt que d'en créer de nouveaux. La validation doit empêcher de continuer avec un linéaire vide ou nul, avec le même style de message que les autres champs obligatoires. Ajoute une aide contextuelle d'une phrase expliquant la différence entre cloison et doublage, parce que c'est la question sur laquelle l'utilisateur hésitera.

Le test navigateur apps/web/e2e/parcours-chrono.spec.ts mesure le nombre de taps et de saisies : il ne doit pas régresser sur ses trois scénarios existants. Ajoute-lui un quatrième scénario "cloison 4 ml" et rapporte son coût mesuré.

Vérifie : pnpm test:web, pnpm build:web, pnpm lint, et le scénario navigateur complet de la page d'accueil jusqu'à la liste d'achat pour une cloison.
```

---

### E1-5 · Faire agir le format du carreau

**Résultat** — le format du carreau, aujourd'hui demandé, obligatoire et jamais lu, pilote la consommation de colle et de joint. Le simple ou double encollage suit le format. Le catalogue cesse d'annoncer un mortier grand format qui consomme moins que le standard.
**Zones** — `apps/api/src/estimations/estimation-engine.ts`, `apps/api/src/materials/seed-catalog.data.ts`, `apps/api/src/projects/work-types.data.ts:33-46`, migration de correction des rendements.
**Fin quand** — l'invariant 6 d'E1-1 passe, et un 20×20 à joint de 5 mm ne consomme plus le même joint qu'un 60×60 à joint de 2 mm. **Charge L.**

**`/model opus` · `/effort xhigh`** — il faut établir une formule physique de consommation de joint, la confronter aux fiches fabricants, décider des seuils de double encollage selon la réglementation de mise en œuvre, et corriger des données de catalogue qui sont actuellement à l'envers. Une valeur fausse ici est directement un sac de colle en trop ou en moins sur un chantier : règle numéro 1, Opus 5. `xhigh` pour la recherche des fiches techniques combinée à la modification du moteur, du catalogue et d'une migration.

```text
/model opus
/effort xhigh
Le format du carreau est déclaré required dans work-types.data.ts:33-46 avec cinq options, il transite jusqu'à custom_params, et le moteur ne le lit jamais. Choisir du 60x60 laisse le carreau 45x45, la colle à 7,14 kg/m² et le joint à une constante de 0,25 kg/m². C'est le défaut qui détruit la confiance le plus vite : l'outil pose une question dont il n'a que faire. Corrige-le.

Trois volets.

COLLE. La consommation de mortier-colle dépend du format du carreau et du mode d'encollage. Recherche les fiches techniques des fabricants français — Cermix, Parexlanko, Weber, Mapei, PRB — pour établir la consommation en kg/m² par tranche de format, et la surconsommation du double encollage. Vérifie notamment le seuil réglementaire au-delà duquel le double encollage est obligatoire en sol et en mur, et applique-le automatiquement au lieu de le laisser à la charge de l'utilisateur. Signale-moi le seuil retenu et sa source.

JOINT. La consommation de joint est aujourd'hui une constante de 0,25 kg/m², ce qui donne une erreur de l'ordre de +46 % en 45x45 et -60 % en 20x20 à joint de 5 mm. Remplace-la par la formule fabricant standard fondée sur les dimensions du carreau, la largeur du joint, l'épaisseur du carreau et la densité du mortier de jointoiement. Ajoute la largeur de joint comme paramètre d'ouvrage, avec une valeur par défaut cohérente avec le format choisi, et documente cette correspondance.

CATALOGUE. Le mortier-colle grand format C2S1 est seedé avec un rendement qui le fait consommer MOINS que le C2 standard, ce qui est l'inverse de la réalité. Vérifie tous les rendements de la famille colle et joint contre les fiches fabricants, corrige par migration réversible, et consigne chaque correction dans docs/SOURCES_CATALOGUE.md avec l'URL de la fiche et la date de consultation, dans le format déjà utilisé par ce fichier.

L'invariant 6 du harnais — toute question required doit changer au moins une quantité — doit passer sur le carrelage après cette tâche. Vérifie : pnpm test:api, le harnais complet, pnpm lint, la migration up et down, et le test sources-catalogue.spec.ts.
```

---

### E1-6 · Compter le papier peint en lés

**Résultat** — le revêtement mural est calculé en lés et non au mètre carré. La hauteur sous plafond et le raccord de motif pilotent le nombre de rouleaux. À 2,60 m de hauteur, le moteur cesse d'annoncer 8 rouleaux là où il en faut 10.
**Zones** — `apps/api/src/estimations/estimation-engine.ts`, `seed-catalog.data.ts`, `work-types.data.ts`.
**Fin quand** — un test couvre 2,40 m, 2,50 m et 2,60 m de hauteur, avec et sans raccord, et chaque cas est cohérent avec le calcul en lés. **Charge M.**

**`/model opus` · `/effort high`** — le défaut est subtil : le calcul actuel est juste par coïncidence à 2,50 m, ce qui est exactement le type d'erreur qu'un test naïf valide. Il faut modéliser une découpe (combien de lés entiers dans un rouleau de 10,05 m, sachant qu'un lé ne tourne pas un angle) et non une division. C'est un raisonnement de découpe, pas une règle de trois. Opus 5. `high` suffit : périmètre resserré, une seule famille de matériau.

```text
/model opus
/effort high
Le revêtement mural est calculé au mètre carré, ce qui est faux. Un rouleau de papier peint standard fait 10,05 m de long sur 0,53 m de large et n'en donne jamais 5,3 m² d'utiles : il donne un nombre ENTIER de lés dont la longueur est la hauteur sous plafond, augmentée du raccord de motif, plus une marge de coupe. À 2,50 m de hauteur le moteur tombe juste par coïncidence — 10,05 / 2,50 donne exactement 4 lés. À 2,60 m il faut 10 rouleaux et le moteur en annonce 8, soit 20 % de sous-achat, invisible à l'écran et visible sur le dernier mur.

Remplace le calcul surfacique par un calcul en lés : nombre de lés nécessaires déduit du linéaire de mur à couvrir divisé par la largeur utile du rouleau, puis nombre de lés obtenus par rouleau déduit de la longueur du rouleau divisée par la longueur d'un lé, arrondi à l'entier inférieur. Ajoute comme paramètres d'ouvrage la hauteur de raccord de motif en centimètres, valeur par défaut zéro pour un uni, et la marge de coupe par lé. Rends la largeur et la longueur du rouleau des propriétés du matériau et non des constantes du moteur : le catalogue contient plusieurs références qui n'ont pas le même conditionnement.

Point de métier à respecter : un lé ne tourne pas un angle. Le nombre de lés doit se calculer mur par mur si la géométrie de la pièce le permet, et non sur le périmètre total — sinon on sous-compte systématiquement dans les pièces à plusieurs pans. Regarde ce que la géométrie de room-geometry.ts expose déjà et utilise-le ; si l'information n'est pas disponible, dis-le-moi et applique une majoration explicite et documentée plutôt qu'un calcul silencieusement faux.

Ajoute des tests couvrant les hauteurs 2,40 m, 2,50 m et 2,60 m, avec raccord nul et raccord de 64 cm. Documente les valeurs de référence dans docs/SOURCES_CATALOGUE.md avec leurs sources. Vérifie : pnpm test:api, le harnais complet, pnpm lint.
```

---

### E1-7 · Boucher les trous des facteurs de perte

**Résultat** — le curseur « niveau de compétence », argument affiché sur la page de vente, cesse d'être inerte. Il n'existe plus de combinaison ouvrage × pose × niveau qui retombe silencieusement sur les 10 % par défaut.
**Zones** — `apps/api/src/materials/seed-catalog.data.ts:58-113`, `estimation-engine.ts` (`resolveWasteFactor`, `DEFAULT_WASTE_PERCENT`), migration.
**Fin quand** — l'invariant 5 d'E1-1 passe, et aucune résolution de facteur de perte n'atteint la valeur par défaut sur les 39 cas du harnais. **Charge M.**

**`/model opus` · `/effort high`** — le défaut est une absence, pas une erreur : `tileWaste()` et `wallCoveringWaste()` ne définissent que les poses `straight` et `diagonal`, jamais `standard`, et le repli est silencieux. Il faut décider si `standard` est un alias de `straight` ou une pose distincte, et corriger la pose diagonale du parquet dotée de 7 % en expert là où la règle est 15 %. Ce sont des décisions métier à faible réversibilité. `high` : le périmètre est un fichier de données et une fonction de résolution.

```text
/model opus
/effort high
Le facteur de perte retombe silencieusement sur DEFAULT_WASTE_PERCENT = 10 dans des cas nominaux, ce qui rend inerte le curseur de niveau de compétence affiché comme argument produit.

Diagnostic à confirmer avant de corriger : tileWaste() et wallCoveringWaste() dans seed-catalog.data.ts:58-113 ne définissent que les poses straight et diagonal, jamais standard. Or standard est la valeur transmise quand l'utilisateur ne précise pas la pose. Les snapshots montrent floor_tiling beginner standard à 10 % et floor_tiling expert standard à 10 % : le niveau ne fait rien. Pire, en revêtement mural, préciser "uni" fait BAISSER la perte de 10 % à 3 % — préciser améliore le résultat, ce qui est incohérent.

Corrige en trois temps.
1. Décide et argumente : standard doit-il être un alias de la pose droite, ou une pose distincte avec ses propres valeurs ? Applique ta décision de façon homogène sur les sept ouvrages.
2. Complète le registre pour qu'il n'existe AUCUNE combinaison ouvrage x pose x niveau sans valeur explicite. Fais échouer la résolution de façon bruyante — exception ou test — plutôt que de retomber sur une valeur par défaut : un repli silencieux est ce qui a permis à ce défaut de survivre.
3. Corrige les valeurs manifestement fausses. La pose diagonale du parquet est dotée de 7 % au niveau expert alors que la règle de la profession est de 15 % pour une diagonale et 15 à 25 % pour des chevrons ; c'est un sous-achat qui se découvre à la dernière rangée. Vérifie l'ensemble des valeurs de perte contre les usages de la profession, cite tes sources, et consigne-les dans docs/SOURCES_CATALOGUE.md.

Question à trancher au passage et à me signaler : le facteur de perte est aujourd'hui appliqué à TOUS les matériaux d'un ouvrage, y compris la colle et le joint. Or une chute de carreau est reposée ailleurs — la colle est proportionnelle à la surface nette, pas à la surface achetée. En pose diagonale débutante à 20 %, cela fait un sac de colle de 25 kg injustifié. Dis-moi si tu recommandes de restreindre l'application de la perte aux seuls matériaux principaux, et implémente-le si tu le recommandes.

L'invariant 5 du harnais — monter le niveau ne doit jamais augmenter une quantité — doit passer. Vérifie : pnpm test:api, le harnais complet, la migration up et down, pnpm lint.
```

---

### E1-8 · Conditionner le pare-vapeur et corriger la découpe des montants

**Résultat** — le film pare-vapeur cesse d'être acheté systématiquement sous un parquet flottant, alors qu'il n'est nécessaire que sur support béton et si la sous-couche n'en intègre pas. Et les montants cessent d'être comptés au mètre linéaire puis découpés, ce qui sous-achète l'ossature d'environ 9 %.
**Zones** — `apps/api/src/estimations/estimation-engine.ts`, `seed-catalog.data.ts`, `work-types.data.ts`.
**Fin quand** — un support bois ne fait plus acheter de pare-vapeur, et une hauteur de 2,50 m fait acheter un montant par emplacement et non un montant divisé en barres. **Charge M.**

**Livré** (migrations `…084` et `…085`). Deux propriétés de registre : `materials_catalog.vapour_barrier` (`dedicated` / `integrated`) et `materials_catalog.offcuts_reusable`. Deux règles portées par la donnée : `estimations/vapour-barrier.ts` et `estimations/piece-cutting.ts`. Une exclusion motivée voyage jusqu'à l'écran (`estimation_results.exclusions_json`), et l'invariant **I7** du harnais interdit le retour de la division. Registre : `docs/SOURCES_CATALOGUE.md`, sections « Déclenchement du pare-vapeur » et « Découpe à longueur ».

Deux écarts avec l'énoncé, assumés et écrits au registre : le forfait de coupe des montants passe à **0 %** (la chute est désormais mesurée, l'ajouter la compterait deux fois — la casse n'est donc plus couverte) ; et le **plancher chauffant**, troisième déclencheur du NF DTU 51.11, n'est pas traité faute d'une question qui l'exprime.

**`/model opus` · `/effort high`** — deux défauts de nature différente réunis parce qu'ils partagent la même racine : le moteur raisonne en quantité continue là où le métier raisonne en pièces découpées. Un montant de 2,70 m coupé pour un plafond de 2,50 m ne laisse pas 0,20 m réutilisables. Modéliser cela demande de comprendre la différence entre un matériau aboutable et un matériau non aboutable. Opus 5 pour le jugement, `high` pour le périmètre.

```text
/model opus
/effort high
Deux corrections qui partagent la même racine : le moteur raisonne en quantité continue là où le métier raisonne en pièces découpées et en conditions de mise en œuvre.

PREMIÈRE CORRECTION — le pare-vapeur. Sous un parquet flottant, le film pare-vapeur est aujourd'hui acheté systématiquement, à raison de 1,25 m² par m² de sol pour tenir compte du recouvrement de 20 cm. Le ratio est juste, le déclenchement est faux : le pare-vapeur n'est nécessaire que sur support béton ou chape, ET seulement si la sous-couche choisie n'en intègre pas déjà un. Ajoute la nature du support comme paramètre d'ouvrage pour le parquet, avec au minimum les valeurs béton ou chape, plancher bois, et ancien revêtement. Ajoute au registre une propriété disant si une sous-couche intègre un pare-vapeur. Fais dépendre la présence de la ligne pare-vapeur de ces deux informations, et affiche à l'utilisateur la raison pour laquelle la ligne apparaît ou disparaît.

SECONDE CORRECTION — la découpe des montants. Les montants sont comptés en mètres linéaires puis divisés par la longueur de la barre : 74,940 m divisés par 2,70 m donnent 28 barres. Mais sous un plafond de 2,50 m, un montant fait environ 2,45 m et la chute de 0,25 m n'est pas réutilisable : une barre égale un montant, et le compte juste est le nombre d'emplacements, soit 30 barres. Le moteur sous-achète l'ossature d'environ 9 %. Introduis dans le registre une propriété distinguant les matériaux ABOUTABLES, dont les chutes se réutilisent bout à bout — c'est le cas des rails, posés en continu au sol et au plafond — des matériaux NON ABOUTABLES découpés à longueur, comme les montants. Pour les non aboutables, calcule le nombre de pièces et non un linéaire. Applique la même logique partout où elle vaut dans le catalogue et dis-moi quels autres matériaux sont concernés.

Vérifie : pnpm test:api, le harnais complet, pnpm lint, et montre-moi le rendu du cas cloison après correction, comparé à celui d'E1-3.
```

---

### E1-9 · Optimiser le conditionnement sur le coût — **livré**

**Résultat** — l'optimiseur cesse de produire des achats que personne ne fait. Une sous-couche de 3,497 L n'est plus achetée en « 1 pot de 2,5 L + 2 pots de 0,5 L » mais en un pot de 5 L. Et la mutualisation multi-pièces ne peut plus ajouter un contenant : ce n'est plus un affichage clampé, c'est une propriété du critère.
**Zones** — `apps/api/src/estimations/estimation-engine.ts` (`solvePackagingMix`, `selectBestPackaging`, `aggregatePurchases`), `apps/api/src/estimations/packaging-objective.spec.ts` (neuf), `apps/api/src/estimations/__tests__/seeded-catalog-harness.ts`, `apps/api/src/estimations/__tests__/two-room-project.spec.ts`.
**Fin quand** — l'invariant 4 d'E1-1 passe, et aucun cas du harnais ne produit un panachage à trois contenants là où deux suffisent. **Charge M.**

**Ce que le lot a arbitré, et qui n'était pas dans l'énoncé.**

1. **La propriété de mutualisation n'était pas celle qu'on croyait.** Ce qui était prouvé portait sur le **coût approché** `S = q_min × contenants + volume`, pas sur le nombre de contenants : `ceil(Σ) ≤ Σ ceil` avait cessé d'être vrai en contenants dès E1-5, et le « -1 » du harnais en était la trace, pas un défaut d'affichage. En prenant le nombre de contenants comme critère principal, la propriété redevient un théorème — et sur le compte, cette fois.
2. **Un plafond de surplus relatif est indispensable.** « Moins de contenants » seul est le défaut symétrique : il achetait 1 rouleau de 30 m² de natte de découplage pour 12,6 m² (~450 €) au lieu de 3 rouleaux de 5 m² (~270 €). Plafond retenu : **+100 %**, on n'achète jamais plus du double du besoin tant qu'un autre achat tient dans la borne. La borne est **relative**, et c'est ce qui la rend compatible avec la mutualisation : `V ≤ 2q` par pièce entraîne `Σ V ≤ 2 Σ q`, donc la réunion des achats reste admissible pour le problème mutualisé. Une borne absolue n'aurait pas cette propriété.
3. **Le seuil du panachage marginal vaut 5 % du besoin** — sous ce seuil, le volume gagné par un second format est plus petit que l'écart entre deux niveaux de compétence sur le même ouvrage (2 à 5 points de perte). Il s'applique **à égalité de contenants**, jamais en autorisant un contenant de plus : c'est cette restriction qui préserve le théorème.
4. **Le prix entre par `PackagingInput.unit_price`, et n'est alimenté par rien.** Ni `materials_catalog` ni `material_packaging` ne portent de colonne de prix ; les prix marchands vivent dans le cache fournisseur, **en aval** de l'estimation. Le mode coût est donc éprouvé et documenté comme non alimenté, plutôt que promis. Il ne garantit pas la monotonie des contenants — le coût, lui, reste additif — d'où le `max(0, …)` conservé dans `budget-summary.ts`.
5. **`purchaseCost` est retiré du harnais.** Il mesurait `S`, que le moteur ne minimise plus. Ce qui le remplace : `extraContainers`, qui éprouve le théorème et doit rester vide, et `extraVolume`, qui énumère ce que le théorème coûte.

**`/model opus` · `/effort high`** — c'est un problème d'optimisation combinatoire dont le critère actuel est mal choisi : minimiser le surplus en volume produit des panachages absurdes parce que le nombre de contenants n'entre pas dans la fonction objectif. Il faut redéfinir le critère — nombre de contenants d'abord, surplus relatif ensuite, avec une pénalité sur les petits conditionnements — sans casser la propriété prouvée `ceil(Σ) ≤ Σceil` de la mutualisation multi-pièces, qui est le meilleur actif algorithmique du dépôt. Opus 5. `high` : algorithmique dense mais localisée.

```text
/model opus
/effort high
L'optimiseur de conditionnement du moteur produit des achats que personne ne fait en magasin. Cas observable dans les snapshots : wall_painting au niveau expert, sous-couche 3,497 L, achetée en "1 x Pot 2,5 L + 2 x Pot 0,5 L" — trois contenants, plus cher en euros, et des pots de 0,5 L de sous-couche universelle qui n'existent quasiment pas au rayon professionnel. Un pot de 5 L est la réponse évidente. Même motif sur ceiling_painting. Et dans le projet à deux pièces, le harnais affiche "-1 aucun contenant évité" : la mutualisation ajoute un contenant tout en s'annonçant comme une économie.

Cause : la fonction objectif minimise le surplus en volume et ignore le nombre de contenants et le prix. Redéfinis-la. Critère principal : le nombre de contenants. Critère secondaire, à égalité de contenants : le surplus relatif. Ajoute une pénalité sur les conditionnements marginaux — un panachage n'est retenu que s'il fait gagner au moins un contenant ou une fraction significative du besoin. Si un prix est disponible pour le matériau, préfère le coût total au nombre de contenants ; sinon, replie sur le nombre de contenants. Rends ce comportement explicite et testé, pas implicite.

CONTRAINTE ABSOLUE : ne casse pas la mutualisation multi-pièces. La propriété prouvée ceil(somme) inférieur ou égal à somme des ceil doit rester vraie, et c'est le meilleur actif algorithmique du dépôt. Si ta nouvelle fonction objectif la met en péril, dis-le-moi avant de coder.

Corrige aussi l'affichage de la mutualisation : quand elle ne fait rien gagner, elle doit le dire, pas afficher un gain négatif.

L'invariant 4 du harnais — nombre de contenants minimal à surplus égal — doit passer. Vérifie : pnpm test:api, le harnais complet sur les trois géométries, pnpm lint, et montre-moi la liste des cas dont l'achat change après correction.
```

---

### E1-10 · Étendre le registre sourcé à soixante matériaux — **livré**

**Résultat** — la liste devient achetable. Les consommables qui bloquent un chantier entrent au catalogue : croisillons, primaire d'accrochage, ragréage, plinthes, barre de seuil, laine dans la cloison, cornières, bande résiliente, système d'étanchéité en pièce humide. Chacun avec sa source.
**Zones** — `apps/api/src/materials/seed-catalog.data.ts`, migrations de liaison, `docs/SOURCES_CATALOGUE.md`, `docs/MATERIAUX_OUVRAGES.md`.
**Fin quand** — pour chacun des sept ouvrages, un professionnel peut partir au dépôt avec la liste. Et chaque rendement ajouté porte une URL de fiche fabricant et une date. **Charge L.**

**Livré (migrations `…086` → `…093`)** — 54 matériaux liés (59 liaisons, 37 obligatoires dont 6 conditionnelles), contre 36 (38) avant. Deux assiettes moteur nouvelles (`floor_perimeter` portes déduites, `door_count`), la règle E1-10 écrite dans `MATERIAUX_OUVRAGES.md`, le SEL déclenché par la question `water_exposure` (défaut `dry` — inversion **arbitrée** de la doctrine E1-8, garde-fou = exclusion motivée à l'écran), ragréage + primaire par `floor_flatness` (5 mm/2 m), croisillons par dérivation géométrique (`tile_spacers`). Trois écarts avec l'énoncé, assumés et écrits au registre : les **cornières d'angle** sont écartées (le modèle ne connaît pas les angles sortants d'une cloison — arbitrage utilisateur, justification dans `MATERIAUX_OUVRAGES.md` §6) ; la **cale de dilatation** est écartée (Quick-Step ne publie aucun espacement — N'INVENTE PAS) ; **Mapei** n'a pu être cité (403 sur pages et PDF). Le compte est 54 vérifiés plutôt que 60 affirmés.

**`/model fable` · `/effort high`** — c'est la tâche qui correspond le mieux à la définition officielle de Fable 5 : plus grande qu'une session, ambiguë (aucune règle mécanique ne dit si un fixateur de fond appartient à la peinture murale), volume de recherche important sur des fiches fabricants dispersées, et vérification autonome de son propre travail. C'est aussi la tâche dont l'erreur est la plus coûteuse et la plus difficile à détecter. Sa fenêtre de 1M absorbe le catalogue entier plus les fiches. `high` est le défaut de Fable 5 et suffit : la difficulté est le jugement et le volume, pas la longueur de chaîne d'outils.

*Option* — `/effort ultracode` sur cette tâche : le travail se parallélise naturellement par ouvrage, sept branches indépendantes puis une synthèse, ce qui est précisément ce que l'orchestration de workflows sait faire. À réserver si vous acceptez le surcoût.

```text
/model fable
/effort high
Étends le registre matériaux de Chiffréo de 35 à environ 60 matériaux liés, pour que la liste d'achat devienne réellement achetable. Aujourd'hui un artisan ne peut pas partir au dépôt avec : il manque les croisillons, le primaire d'accrochage, le ragréage, les plinthes, la barre de seuil, la laine dans la cloison, les cornières d'angle, la bande résiliente, et le système d'étanchéité liquide en pièce humide.

Règle en vigueur dans le dépôt, à faire évoluer explicitement : docs/MATERIAUX_OUVRAGES.md pose "pas de rendement surfacique, pas de ligne", ce qui a écarté ces consommables. Cette règle protégeait d'un catalogue non sourçable, mais elle rend la liste inutilisable. Propose et applique une règle de remplacement qui permette d'intégrer des matériaux dont la quantité dépend d'un linéaire, d'un nombre de pièces ou d'un nombre d'angles plutôt que d'une surface — et écris-la dans le document.

Pour chaque matériau ajouté, établis : sa catégorie, son unité, son rendement, son ou ses conditionnements commerciaux réels, les ouvrages auxquels il se lie, son rôle (principal, sous-couche, consommable, accessoire), son caractère obligatoire ou optionnel, et s'il suit le nombre de faces ou la trame quand l'ouvrage en a une. Le rendement doit venir d'une fiche technique de fabricant français consultable en ligne : Placo, Siniat, Knauf, Weber, Parexlanko, Cermix, Mapei, PRB, Sika, Zolpan, Tollens, Quick-Step. Consigne pour chacun l'URL et la date de consultation dans docs/SOURCES_CATALOGUE.md, dans le format déjà utilisé par ce fichier, que le test sources-catalogue.spec.ts vérifie.

Cas particuliers à trancher et à documenter. Le SEL en pièce humide dépend du classement du local, pas seulement du choix de l'utilisateur : décide comment le déclencher. Les plinthes et la barre de seuil dépendent d'un linéaire que le modèle de pièce connaît peut-être déjà — vérifie room-geometry.ts avant d'ajouter un champ. Les croisillons dépendent du format du carreau introduit en E1-5.

Si un rendement n'est pas sourçable, N'INVENTE PAS : écarte le matériau et écris pourquoi. Un catalogue de 50 matériaux vérifiés vaut mieux qu'un catalogue de 60 dont on ne peut rien affirmer.

Livre : les migrations de seed et de liaison réversibles, la mise à jour de docs/SOURCES_CATALOGUE.md et docs/MATERIAUX_OUVRAGES.md, et un tableau récapitulatif par ouvrage listant les matériaux retenus, leur rôle, et une ligne de justification pour chaque matériau écarté qu'on pourrait croire nécessaire. Vérifie : pnpm test:api, sources-catalogue.spec.ts, le harnais complet, les migrations up et down.
```

---

### E1-11 · Afficher la source derrière chaque ratio

**Résultat** — la différenciation devient visible. Chaque ligne de la liste et du devis peut afficher d'où vient son chiffre : « 7 kg/m² en U9 selon la fiche Cermix CERMIFLEX, consultée le 12/09/2026, plus 1,5 kg/m² pour le double encollage obligatoire au-delà de 1 200 cm² ». Et l'affichage des marques est désactivable.
**Zones** — `apps/api/src/estimations/`, `apps/api/src/materials/`, `apps/web/src/components/shopping-list/`, génération du PDF de devis.
**Fin quand** — une source manquante fait rougir un test, et l'artisan peut couper l'affichage des marques en un réglage. **Charge L.**

**`/model opusplan` · `/effort xhigh`** — la conception est délicate : où porter la source, comment la propager du registre jusqu'au PDF sans polluer chaque couche, et comment rendre l'affichage des marques optionnel sans dupliquer le rendu. Une fois tranché, c'est du câblage multi-couches volumineux et répétitif. `opusplan` paie la conception au prix d'Opus et l'exécution au prix de Sonnet. `xhigh` : API, web et PDF, avec migration.

```text
/model opusplan
/effort xhigh
Entre en plan mode. Objectif : rendre visible dans le produit la traçabilité des ratios, qui est la seule différenciation défendable de Chiffréo face à des concurrents qui calculent avec des constantes sans citer de source.

Résultat attendu à l'écran, sur chaque ligne de la liste d'achat et sur demande dans le devis : la quantité, puis une justification d'une à deux phrases nommant le ratio, sa source, sa date de consultation, et la règle appliquée. Exemple de rendu visé : "4 sacs de mortier-colle 25 kg — 94,3 kg. 7 kg/m² en U9 selon la fiche technique Cermix CERMIFLEX consultée le 12/09/2026, plus 1,5 kg/m² pour le double encollage, obligatoire au-delà de 1 200 cm² : votre carreau fait 2 025 cm²." Avec un lien vers la fiche.

Conçois d'abord. Où porter la source : sur le matériau, sur le rendement, ou sur la ligne d'estimation calculée ? Comment la propager du registre jusqu'au PDF sans faire traverser un objet à chaque couche ? Comment exprimer une justification qui dépend de règles appliquées à l'exécution — double encollage déclenché, pare-vapeur écarté, perte majorée par la pose — et pas seulement d'une valeur statique ? Argumente avant de coder.

DEUX CONTRAINTES PRODUIT, non négociables.
1. L'affichage des marques de fabricant doit être DÉSACTIVABLE par un réglage de l'utilisateur, avec un repli qui garde la justification technique en retirant le nom commercial. Raison : montrer "Cermix" à un artisan qui pose du Weber rend le chiffre inutilisable et fait passer l'outil pour le prescripteur d'une marque qu'il n'achète pas.
2. Sur le DEVIS destiné au client final, l'affichage détaillé des fournitures est OPTIONNEL et désactivé par défaut. Raison : détailler les fournitures ligne par ligne expose la marge de l'artisan sur les matériaux, ce que la plupart évitent délibérément. C'est un choix qui lui appartient, pas un réglage que nous prenons pour lui.

Ajoute un test qui échoue si un matériau lié à un ouvrage n'a pas de source renseignée : la traçabilité n'est un argument que si elle est complète.

Vérifie : pnpm test:api, pnpm test:web, pnpm build:web, pnpm lint, et montre-moi le rendu d'une ligne avec marques, sans marques, et le devis avec et sans détail des fournitures.
```

---

### E1-12 · Faire relire les sept listes

**Résultat** — un document de relecture qui présente, pour chacun des sept ouvrages, la liste produite sur un cas type, avec la justification de chaque ligne, dans un format qu'un artisan peut annoter sans rien connaître au logiciel.
**Zones** — `docs/RELECTURE_METIER.md` (à créer), export PDF du document.
**Fin quand** — le document est envoyé à au moins trois personnes du métier — par écrit, dans un groupe professionnel ou en commentaire d'une vidéo — et les retours sont consignés. **Charge M.**

**`/model sonnet` · `/effort high`** — production documentaire à partir de données que le moteur produit déjà : c'est spécifiable, structuré, et sans arbitrage. Le seul enjeu est la clarté pour un lecteur non technique, registre que Sonnet 5 tient très bien. `high` plutôt que `medium` parce qu'il faut exécuter le moteur, extraire les cas et vérifier que le rendu correspond à la réalité.

```text
/model sonnet
/effort high
Produis docs/RELECTURE_METIER.md, un document destiné à être relu et annoté par des artisans qui ne connaissent pas le logiciel. C'est le substitut écrit à la validation terrain que je ne ferai pas.

Pour chacun des sept ouvrages — peinture murale, peinture plafond, carrelage sol, carrelage mural, parquet ou stratifié, cloison sèche, revêtement mural — présente un cas type réaliste et complet : une description de chantier en français courant que n'importe quel artisan reconnaît, les hypothèses retenues (format, pose, niveau, hauteur, support), la liste d'achat produite par le moteur en conditionnements commerciaux, et pour chaque ligne la justification du chiffre avec sa source. Exécute réellement le moteur pour produire ces listes : n'invente aucun chiffre, extrais-les du harnais ou d'un script dédié.

Format. Une page par ouvrage. Pas de jargon logiciel : ni "ouvrage", ni "assiette", ni "facteur de perte" sans l'expliquer en une parenthèse. Chaque page se termine par trois questions fermées auxquelles un artisan peut répondre en une ligne : "Achèteriez-vous cette liste telle quelle ?", "Qu'est-ce qui manque ?", "Quelle quantité vous paraît fausse, et quelle valeur mettriez-vous ?". Prévois de la place pour annoter.

Ajoute en tête une page d'introduction de dix lignes maximum expliquant ce qu'on demande et pourquoi, sans vendre le produit. Et en fin de document, un tableau vide de synthèse des retours, une ligne par relecteur.

Génère aussi une version PDF imprimable du document. Vérifie : le PDF est lisible, les chiffres du document correspondent exactement à ce que produit le moteur à ce commit, et indique le hash du commit dans le pied de page.
```

---

---

## E2 — Le devis qui se tient

*Le chiffrage juste ne sert à rien si le devis qui en sort est moins utile que celui du concurrent.*

---

### E2-1 · Poser les temps de pose par ouvrage

**Résultat** — un registre de temps unitaires de main-d'œuvre par ouvrage, par pose et par niveau, sourcé. C'est ce qu'ArtisanSmart sort et que Chiffréo ne sort pas : pour un peintre, la main-d'œuvre **est** le prix.
**Zones** — nouveau registre à côté de `seed-catalog.data.ts`, migration, `docs/SOURCES_CATALOGUE.md`.
**Fin quand** — chaque ouvrage porte un temps unitaire avec sa source, et un test l'impose comme il impose déjà les rendements. **Charge L.**

**`/model fable` · `/effort high`** — même profil qu'E1-10 : recherche ouverte sur des sources dispersées et hétérogènes — bordereaux, fiches de mise en œuvre, conventions collectives, retours de profession — sans qu'aucune ne fasse autorité seule, et jugement sur ce qui est publiable. Les temps de pose sont d'ailleurs la donnée que Batiprix et BatiChiffrage vendent : il faut savoir ce qu'on peut établir librement et ce qu'on ne peut pas recopier. `high`, le défaut de Fable 5.

```text
/model fable
/effort high
Établis un registre de temps de pose unitaires pour les sept ouvrages de finition de Chiffréo — peinture murale, peinture plafond, carrelage sol, carrelage mural, parquet ou stratifié, cloison sèche, revêtement mural — exprimés en heures par unité d'ouvrage, et différenciés par type de pose et par niveau de compétence quand c'est pertinent.

Pourquoi c'est nécessaire : pour un peintre, la main-d'œuvre représente l'essentiel du prix, et le devis de Chiffréo ne porte aujourd'hui qu'un bloc unique de main-d'œuvre pour tout le chantier. Un concurrent direct sort déjà les heures par ouvrage. Sans ce registre, notre devis reste moins utile que le sien quelle que soit la qualité de nos quantités.

Sources à explorer, en distinguant rigoureusement ce qui est librement établissable de ce qui est une base de données commerciale protégée : fiches de mise en œuvre de fabricants, documents techniques unifiés, publications d'organisations professionnelles (CAPEB, FFB, UPMF, SNIP), documentation de formation et de CFA, retours publics de professionnels. ATTENTION JURIDIQUE : Batiprix et BatiChiffrage commercialisent précisément cette donnée. Tu ne dois RIEN recopier de leurs bordereaux. Établis des valeurs à partir de sources librement consultables, et signale-moi explicitement tout cas où la seule source disponible est une base commerciale — dans ce cas, écarte la valeur plutôt que de la reprendre.

Pour chaque temps : la valeur, l'unité de rattachement (m² d'ouvrage, mètre linéaire, pièce), les conditions supposées (hauteur accessible sans échafaudage, support sain, pièce vide), la variation par niveau de compétence, la source avec URL et date, et une fourchette basse-haute plutôt qu'une valeur unique quand les sources divergent. Signale ce qui n'est PAS inclus dans le temps : préparation, protection, nettoyage, déplacement — et propose un traitement pour ces postes.

Livre : le registre en données, une migration de seed réversible, la mise à jour de docs/SOURCES_CATALOGUE.md, et un test qui échoue si un ouvrage n'a pas de temps de pose sourcé, sur le modèle de sources-catalogue.spec.ts. Vérifie : pnpm test:api, migration up et down.
```

---

### E2-2 · Mettre la main-d'œuvre par ouvrage dans le devis

**Résultat** — le devis porte une ligne de main-d'œuvre par ouvrage, calculée à partir des temps d'E2-1 et du taux horaire de l'artisan, modifiable ligne par ligne. Le bloc unique disparaît.
**Zones** — `apps/api/src/quotes/entities/quote.entity.ts:75-102`, migration, `apps/web/src/app/(app)/projects/[id]/quote/new/page.tsx`, génération du PDF.
**Fin quand** — un devis multi-ouvrages sort avec une ligne de MO par ouvrage, la numérotation reste sans trou et les mentions obligatoires sont intactes. **Charge L.**

**`/model opus` · `/effort xhigh`** — on touche l'entité devis, qui porte la conformité légale et la numérotation continue. Une migration ratée ici ne corrompt pas des données de test : elle corrompt des factures. Le PDF conforme et la séquence de numérotation sont deux choses qui marchent aujourd'hui et qu'il ne faut pas casser. Règle numéro 1 : Opus 5. `xhigh` parce que c'est entité, migration, API, formulaire et PDF, avec vérification longue.

```text
/model opus
/effort xhigh
Remplace le bloc unique de main-d'œuvre du devis par une ligne de main-d'œuvre PAR OUVRAGE. Aujourd'hui quote.entity.ts:75-102 porte un seul labor_type (horaire ou forfait), un taux et un volume : un devis à plusieurs ouvrages et une seule ligne "main-d'œuvre : 1 200 €" n'est pas un devis qu'on envoie.

Attendu. Chaque ouvrage du projet produit une ligne de main-d'œuvre dont la quantité d'heures est calculée à partir du registre de temps de pose créé en E2-1, de l'assiette de l'ouvrage et du niveau de compétence. Le taux horaire vient du profil d'entreprise. Chaque ligne est modifiable individuellement — heures et taux — et l'artisan peut basculer une ligne en forfait. Le total se recalcule. Conserve la possibilité d'ajouter une ligne de main-d'œuvre libre pour ce que le moteur ne chiffre pas.

TROIS CHOSES À NE PAS CASSER, et je veux que tu me le confirmes explicitement après vérification.
1. La numérotation des devis et des factures est continue et sans trou, garantie par les tables quote_sequences et invoice_sequences en clé primaire composite. La migration ne doit ni la réinitialiser ni créer de trou.
2. Le PDF de devis porte les mentions obligatoires françaises, y compris les quatre nouvelles de 2026, et le modèle est aligné EN 16931. La nouvelle structure de lignes doit rester conforme et rester sérialisable vers Factur-X plus tard, comme le prévoit docs/CONFORMITE_FACTURATION.md.
3. Les devis et factures déjà émis doivent rester lisibles à l'identique. Un devis émis avec l'ancien bloc unique ne doit pas être réinterprété : prévois la coexistence des deux formes, pas une conversion.

Applique la même logique à la facture, qui dérive du devis.

Vérifie : migration up et down sur une base réelle, pnpm test:api, pnpm test:api:integration, pnpm test:web, pnpm lint, et génère-moi un PDF de devis à trois ouvrages pour que je le relise.
```

---

### E2-3 · Reformuler la promesse en estimation à valider

**Résultat** — nulle part le produit ne promet « la quantité exacte ». Partout il propose « une base de commande, calculée et sourcée, que vous validez ». Ce n'est pas de la prudence rhétorique : l'article 1170 du Code civil répute non écrite toute clause limitative qui prive de sa substance l'obligation essentielle du contrat.
**Zones** — toutes les surfaces marketing, les CGU et CGV, les libellés du tunnel, le PDF de devis.
**Fin quand** — un test interdit la réapparition du vocabulaire d'exactitude, et les CGV portent une clause de limitation cohérente avec la promesse reformulée. **Charge M.**

**`/model opus` · `/effort high`** — c'est du droit appliqué à de la copie commerciale. Il faut comprendre pourquoi la jurisprudence Chronopost puis Faurecia rend une clause limitative fragile quand le marketing promet l'exactitude, puis réécrire des dizaines de phrases sans vider la promesse de sa force commerciale. Registre juridique français plus arbitrage de ton : Opus 5, dont la coupure de mai 2026 couvre par ailleurs le cadre réglementaire récent. `high`.

```text
/model opus
/effort high
Reformule la promesse de Chiffréo, partout, de l'exactitude vers l'estimation validée. Ce n'est pas cosmétique, c'est une question d'exposition contractuelle.

Le raisonnement juridique à respecter. En droit français, la seule remise de documentation n'exonère pas le fournisseur de son devoir de conseil, y compris envers un client professionnel. Et l'article 1170 du Code civil, qui codifie les jurisprudences Chronopost puis Faurecia, répute non écrite toute clause limitative de responsabilité qui prive de sa substance l'obligation essentielle du contrat. Conséquence : plus notre marketing promet l'exactitude du calcul, plus le calcul juste devient l'obligation essentielle, et plus notre clause de limitation devient fragile. Citer une fiche fabricant ne renverse rien : c'est nous qui avons choisi la source, choisi le ratio et fait le calcul.

Travail à faire.
1. Relève toutes les formulations d'exactitude dans apps/web/src, dans les libellés générés côté API, dans le PDF de devis, dans les métadonnées et le JSON-LD, et dans docs/. Cherche notamment : "la quantité exacte", "quantités exactes", "précis", "précision", "le seul outil qui calcule", "n'achetez plus en trop", et toute promesse chiffrée d'économie.
2. Réécris-les vers une formulation qui reste vendeuse sans promettre l'exactitude : le produit calcule une base de commande à partir de la géométrie réelle et de ratios sourcés, et l'artisan la valide. Garde la force commerciale — la traçabilité et la géométrie restent des arguments forts et vrais — mais ne promets jamais un résultat.
3. Retire l'affirmation "le seul outil qui calcule les quantités" partout : elle est factuellement fausse depuis qu'ArtisanSmart existe, et une affirmation fausse est un risque en soi.
4. Réécris la clause de limitation de responsabilité des CGV en cohérence, en tenant compte de l'article 1170. Ajoute un avertissement visible signalant qu'elle doit être relue par un juriste avant mise en ligne.
5. Ajoute un test qui échoue si une chaîne affichée à l'utilisateur contient un terme de la liste d'exactitude interdite. Documente la liste et sa raison d'être.

Vérifie : pnpm test:web, pnpm test:api, pnpm build:web, pnpm lint, et donne-moi la liste avant/après de chaque formulation modifiée pour que je la relise.
```

---

### E2-4 · Faire valider les quantités avant émission

**Résultat** — avant d'émettre un devis, l'artisan valide explicitement les quantités, ligne par ligne ou en bloc. La validation est horodatée et conservée. C'est la troisième ligne de défense juridique, et c'est aussi ce qui rend l'outil sérieux.
**Zones** — `apps/web/src/app/(app)/projects/[id]/{shopping-list,quote/new}/page.tsx`, `apps/api/src/quotes/`, migration.
**Fin quand** — aucun devis ne peut être émis sans validation enregistrée, et la trace est exportable. **Charge M.**

**`/model opus` · `/effort high`** — la mécanique est simple, mais elle a une valeur probatoire : ce qu'on enregistre, comment on l'horodate, et ce qu'on peut en produire plus tard décident de son utilité en cas de litige. Il faut aussi ne pas transformer une protection en friction qui casse la promesse des dix minutes. Arbitrage produit et juridique combinés : Opus 5. `high`.

```text
/model opus
/effort high
Ajoute une validation explicite des quantités avant émission d'un devis. Objectif double : rendre l'outil sérieux aux yeux d'un professionnel, et constituer la troisième ligne de défense juridique après la reformulation de la promesse et l'assurance.

Mécanique attendue. À l'étape qui précède la création du devis, l'artisan voit les quantités calculées et doit les valider — soit en bloc par une action unique, soit ligne par ligne s'il en corrige une. Toute correction manuelle d'une quantité est conservée avec l'ancienne valeur, la nouvelle, et l'horodatage. La validation elle-même est enregistrée avec la date, l'identité de l'utilisateur, et une empreinte des quantités validées permettant de prouver plus tard ce qui a été validé exactement.

CONTRAINTE PRODUIT, aussi importante que la contrainte juridique : cela ne doit pas casser la promesse des dix minutes. Le test apps/web/e2e/parcours-chrono.spec.ts mesure les taps et les saisies ; la validation en bloc doit coûter UN tap, pas un par ligne. Mesure l'impact et rapporte-le. Si le coût dépasse deux taps sur le scénario à un ouvrage, reviens me voir avant de continuer.

Les corrections manuelles enregistrées ont une seconde valeur, à ne pas manquer : ce sont des données pour la boucle de correction de l'épic E8. Structure-les pour qu'elles soient exploitables — matériau, ouvrage, quantité calculée, quantité retenue, écart relatif — et non pas seulement stockées.

Ajoute la trace de validation à l'export de données personnelles existant.

Vérifie : migration up et down, pnpm test:api, pnpm test:web, le scénario navigateur complet, pnpm lint, et rapporte-moi le nouveau chronométrage des trois scénarios existants.
```

---

### E2-5 · Ne plus se tromper silencieusement en multi-pièces

**Résultat** — un projet dont une pièce a été mesurée mais n'a reçu aucun ouvrage ne produit plus silencieusement un devis qui ne couvre qu'une pièce. Le défaut est documenté depuis l'audit des dix minutes et n'a jamais été corrigé.
**Zones** — `apps/web/src/app/(app)/projects/[id]/{work-selection,estimate,quote/new}/page.tsx`, `apps/api/src/projects/`.
**Fin quand** — mesurer trois pièces puis choisir les ouvrages une seule fois produit un avertissement explicite, et un test navigateur couvre ce chemin. **Charge M.**

**`/model sonnet` · `/effort high`** — le diagnostic est déjà écrit dans `docs/AUDIT_PARCOURS_10MIN.md` §3.3 : les ouvrages sont enregistrés par pièce, et rien à l'écran ne dit qu'une pièce mesurée n'a pas d'ouvrage. La correction est spécifiable — détection d'un état incohérent, avertissement, chemin de reprise. C'est du frontend et de l'état d'application, terrain de Sonnet 5. `high` parce qu'il faut couvrir les trois écrans du tunnel sans faux positifs.

```text
/model sonnet
/effort high
Corrige le défaut décrit dans docs/AUDIT_PARCOURS_10MIN.md paragraphe 3.3 : "le parcours multi-pièces se trompe silencieusement si on l'aborde autrement". Les ouvrages sont enregistrés par pièce via POST /work-items avec un paramètre de pièce. Un utilisateur qui mesure trois pièces d'affilée puis choisit les ouvrages une seule fois obtient un devis qui ne couvre qu'UNE pièce, sans le moindre avertissement. Rien à l'écran ne dit qu'une pièce mesurée n'a pas d'ouvrage.

Attendu. Sur l'écran de sélection des travaux, l'utilisateur voit clairement pour QUELLE pièce il choisit, et combien de pièces du projet n'ont pas encore d'ouvrage. Sur l'écran d'estimation et sur celui de création du devis, un bandeau explicite signale toute pièce mesurée sans ouvrage, avec un lien direct pour y remédier, et indique ce que le devis couvre réellement. Le récapitulatif du devis nomme les pièces couvertes.

Traite aussi le cas inverse : une pièce à laquelle on a attribué un ouvrage mais dont les dimensions sont incomplètes.

Ne transforme pas cet avertissement en blocage : un artisan peut légitimement vouloir un devis sur une seule pièce d'un projet qui en compte trois. L'avertissement doit être dismissable, et le fait de l'avoir écarté doit être conservé pour ne pas le réafficher à chaque écran.

Ajoute un test navigateur dans apps/web/e2e/ qui couvre le chemin fautif : créer un projet, mesurer trois pièces, choisir les ouvrages pour une seule, aller au devis, et vérifier que l'avertissement apparaît et nomme les deux pièces manquantes.

Vérifie : pnpm test:web, le nouveau test navigateur, pnpm build:web, pnpm lint.
```

---

## E3 — Le retournement du modèle

*Le chiffrage devient gratuit et illimité ; la conformité devient payante, à l'année. Une audience, une offre, un nom.*

---

### E3-1 · Supprimer le palier DIY et la landing particulier

**Résultat** — le palier Pro à 9,99 € disparaît, ainsi que la page d'accueil qui parle au bricoleur. `/` devient la surface artisan, `/artisans` y fusionne. Le produit cesse de tenir deux discours.
**Zones** — `apps/web/src/lib/pricing.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/app/artisans/page.tsx`, `apps/web/src/components/marketing/MarketingHeader.tsx`, migration de gates, `src/__tests__/offer-catalogue.spec.ts`.
**Fin quand** — il n'existe plus qu'une audience dans `AUDIENCE_DEFINITIONS`, et aucune redirection ne casse. **Charge M.**

**`/model opus` · `/effort xhigh`** — c'est de la suppression, et la suppression est l'opération la plus dangereuse d'un dépôt : il faut identifier tout ce qui dépend du palier retiré, y compris les abonnements Stripe existants, les gates qui le référencent en `min_tier`, les tests qui l'assertent et les redirections. Le dépôt a un test structurel, `offer-catalogue.spec.ts`, qui interdit de vendre une ligne sans gate réelle : c'est le meilleur garde-fou du dépôt et il faut le mettre à jour, jamais le désactiver. Règle numéro 1 : Opus 5. `xhigh` : multi-fichiers, migration, cascade de dépendances.

```text
/model opus
/effort xhigh
Supprime le palier DIY et la landing particulier. Décision D4 révisée de l'ADR : une seule audience, l'artisan des métiers de finition.

Périmètre.
1. Supprime le palier "Pro" à 9,99 € de apps/web/src/lib/pricing.ts et de toute la chaîne : constantes de plans côté API, produits et prix Stripe référencés, gates dont le min_tier vaut pro, tests qui l'assertent.
2. Supprime l'audience "diy" de AUDIENCE_DEFINITIONS et tout ce qui la sert : la landing apps/web/src/app/page.tsx dans sa forme actuelle, le lien de bascule d'audience dans MarketingHeader, la strate DIY de /pricing.
3. Fais de / la surface artisan. Le contenu de apps/web/src/app/artisans/page.tsx devient celui de la page d'accueil. Mets en place une redirection permanente de /artisans vers /, mets à jour le sitemap, les canonicals et les liens internes.

TRAITE LE CAS DES ABONNÉS EXISTANTS AVANT DE SUPPRIMER. Vérifie s'il existe des abonnements actifs sur le palier pro en base et dans Stripe. S'il y en a, ne les casse pas : conçois une stratégie — bascule vers le nouveau palier, ou maintien en lecture jusqu'à échéance — et propose-la-moi avant d'exécuter. S'il n'y en a aucun, dis-le-moi et poursuis.

NE DÉSACTIVE PAS src/__tests__/offer-catalogue.spec.ts. Ce test interdit structurellement de vendre une ligne d'offre sans gate réelle derrière : c'est le meilleur garde-fou du dépôt. Mets-le à jour pour refléter la nouvelle offre, et si tu es tenté de le contourner, arrête-toi et explique-moi pourquoi.

Les gates qui portaient min_tier pro doivent recevoir un nouveau palier cohérent avec E3-2 : le chiffrage devient gratuit, la conformité devient payante. Applique-le par migration réversible.

Vérifie : migration up et down, pnpm test:api, pnpm test:web, pnpm build:web, pnpm lint, offer-catalogue.spec.ts au vert, et donne-moi la liste des routes dont l'accès change.
```

**Livré** (migration `…099`). Aucun abonné à protéger : `subscriptions` vide, aucun compte au palier `pro`, aucun prix Stripe configuré. Le palier `pro` disparaît de l'offre (`pricing.ts`, `plans.constants.ts`), de la configuration (`STRIPE_PRO_PRICE_ID` n'est plus exigée au démarrage) et de la liste blanche d'administration des gates ; il **reste** un rang de `SubscriptionTier` et de `TIER_ORDER`, parce que `users.subscription_tier` peut encore le porter. Les huit gates qui l'exigeaient passent à `free` — aucune ne produit de document opposable — si bien qu'un compte `pro` résiduel ne perd aucun accès. `/artisans` devient `/` (308 permanent, sitemap et canonicals recalés), le CTA invité est conservé sur la nouvelle page d'accueil. `offer-catalogue.spec.ts` est renforcé de deux garde-fous : aucune gate ne peut pointer un palier qu'aucun plan ne porte, et le plafond de prix se mesure sur le palier **payant** le moins cher (il portait sur le premier plan de la liste, devenu le gratuit — assertion vacuue). Effet de bord assumé, en avance sur E3-2 : `unlimited_projects` étant `free`, la limite de deux projets ne s'applique plus à un compte inscrit (le plafond invité, indépendant de la gate, tient).

---

### E3-2 · Rendre le chiffrage gratuit et illimité

**Résultat** — un compte gratuit chiffre autant de chantiers qu'il veut, avec la géométrie complète, les quantités, les conditionnements et les sources. Il n'a pas le devis PDF, ni le fichier clients, ni la facturation. Le budget cesse d'être derrière un paywall alors que la page d'accueil le promet.
**Zones** — `apps/api/src/feature-gates/`, migration de gates, `apps/web/src/lib/feature-gates-catalogue.ts`, `apps/web/src/components/shopping-list/ShoppingListMaterials.tsx:123-129`.
**Fin quand** — un compte gratuit va de la mesure à la liste d'achat chiffrée sans rencontrer un seul paywall, et le premier paywall qu'il rencontre est l'export du devis. **Charge M.**

**`/model opus` · `/effort xhigh`** — c'est le retournement du modèle économique matérialisé dans les gates. Une gate mal placée fait soit fuir l'utilisateur, soit donner gratuitement ce qui doit être payé. Le mécanisme est fail-closed en base, donc une migration incomplète ferme silencieusement l'accès. Argent : règle numéro 1, Opus 5. `xhigh` : migration, API, web, et vérification du parcours complet dans les deux états.

```text
/model opus
/effort xhigh
Applique le retournement du modèle économique décidé en D4 : le CHIFFRAGE devient gratuit et illimité, la CONFORMITÉ devient payante.

Ce qui passe au palier gratuit, sans limite de chantiers : création de projets, saisie des dimensions y compris géométries non rectangulaires, sélection des ouvrages, estimation complète, liste d'achat avec conditionnements, affichage des sources, saisie des prix et budget, export de la liste d'achat, clôture de chantier.

Ce qui reste payant : export du devis PDF, fichier clients et historique, facturation, et tout ce qui suivra sur la conformité électronique.

Trois corrections spécifiques à faire au passage.
1. La limite de projets actifs disparaît pour les comptes inscrits. Garde une limite pour les invités non inscrits — elle vaut 1 aujourd'hui côté serveur — et vérifie que les quotas anti-abus tiennent sans elle : débit, taille de projet, nombre de pièces.
2. budget_tracking passe au palier gratuit. Aujourd'hui la page d'accueil promet un "budget estimé" et le hub des calculateurs promet un "budget suivi en temps réel", alors que cliquer sur l'icône euro d'une ligne ouvre le paywall pour un compte gratuit — voir ShoppingListMaterials.tsx:123-129. La promesse doit être tenue, pas retirée.
3. advanced_loss_factors passe au palier gratuit : les facteurs de perte par pose et par niveau sont le cœur du chiffrage, donc du produit gratuit.

Le mécanisme de gates est fail-closed en base : une migration incomplète ferme silencieusement un accès au lieu de l'ouvrir. Vérifie après migration, pour CHAQUE gate, l'état réel résolu pour un compte invité, un compte gratuit inscrit et un compte payant, et donne-moi ce tableau à trois colonnes.

Ajoute un test navigateur qui parcourt, avec un compte gratuit, de la page d'accueil jusqu'à la liste d'achat chiffrée avec prix saisis, et qui échoue si un paywall apparaît avant l'export du devis.

Vérifie : migration up et down, pnpm test:api, pnpm test:api:integration, pnpm test:web, le nouveau test navigateur, offer-catalogue.spec.ts, pnpm lint.
```

---

### E3-3 · Poser l'offre annuelle à 279 €

**Résultat** — une seule offre payante, à 279 € par an, en annuel uniquement, avec trente jours satisfait ou remboursé. Le mensuel disparaît. C'est le levier qui attaque le churn, facteur limitant du modèle.
**Zones** — `apps/api/src/subscriptions/`, constantes de plans, `apps/web/src/lib/pricing.ts`, webhooks Stripe, migration.
**Fin quand** — un cycle complet passe en environnement de test Stripe : souscription annuelle, remboursement dans les trente jours, renouvellement, échec de paiement, annulation. **Charge L.**

**`/model opus` · `/effort xhigh`** — c'est de l'argent, et le passage du mensuel à l'annuel touche la proration, le remboursement, la période de grâce sur impayé et l'idempotence des webhooks. Le dépôt a déjà réglé `past_due` et l'idempotence : il ne faut rien casser. Règle numéro 1, sans discussion. `xhigh` : intégration externe, migration, vérification longue sur un cycle complet.

```text
/model opus
/effort xhigh
Remplace l'offre payante mensuelle par une offre ANNUELLE UNIQUE à 279 € HT par an, avec trente jours satisfait ou remboursé. Décision D4 de l'ADR. Motif à garder en tête pendant l'implémentation : le churn est le facteur limitant du modèle, et l'annuel fait passer la durée de vie moyenne d'un client d'environ vingt mois à environ quarante.

Périmètre.
1. Un seul produit Stripe, un seul prix, en récurrence annuelle. Supprime les prix mensuels et les paliers multiples de la configuration et des constantes.
2. Politique de remboursement à trente jours : implémente-la explicitement — condition, déclenchement, effet sur l'accès, trace — plutôt que de la laisser à un geste manuel dans le tableau de bord Stripe.
3. Adapte la période d'essai : décide et argumente si un essai gratuit garde du sens quand le chiffrage est déjà gratuit et illimité. Ma présomption est que non — l'essai devient le palier gratuit lui-même — mais tranche et écris ta raison.
4. Vérifie le comportement sur un cycle annuel de tout ce qui a été écrit pour du mensuel : la période de grâce sur past_due, l'expiration d'accès, les e-mails de fin de période, l'affichage de la date de fin d'abonnement.

NE CASSE PAS ce qui fonctionne : l'idempotence des webhooks Stripe est réelle et testée contre un vrai PostgreSQL, et les événements obsolètes sont écartés au lieu d'être appliqués. Vérifie que ces deux propriétés tiennent avec le nouveau cycle.

Documente dans docs/ la procédure exacte de création des produits et prix Stripe en mode live, les variables d'environnement à renseigner, l'URL du webhook et les événements à activer. Ne stocke aucun secret en clair dans le dépôt.

Vérifie : migration up et down, pnpm test:api, pnpm test:api:integration, pnpm lint, et déroule en environnement de test Stripe le cycle complet — souscription, remboursement à J+10, renouvellement, échec de paiement, annulation — en me montrant l'état d'accès résolu à chaque étape.
```

**Livré** (migrations `…101` à `…103`), **sauf le déroulé du cycle Stripe** : le `.env` de la racine ne porte aucune variable `STRIPE_*`, et `pnpm verify:stripe` refuse de démarrer sans clé `sk_test_`. Le harnais est écrit, étendu au cycle annuel avec une horloge de test Stripe, et compilé ; il reste à exécuter.

`PLANS` ne porte plus qu'une offre : 279 € HT, `interval: 'year'`, `trial_days: 0`. Les deux paliers mensuels à 29 et 49 € quittent la configuration (`configuration.ts`, `.env.example`, `docker-compose.prod.yml`) et une migration normalise les comptes qui les porteraient — **zéro sur la base réelle**. **Pas d'essai, décidé et argumenté** : l'essai *est* le palier gratuit et illimité, et un essai ne prélève rien donc ne rembourse rien — l'annoncer à côté d'un « 30 jours satisfait ou remboursé » rendrait la garantie inapplicable pendant la semaine où elle rassure. Le mécanisme d'essai reste en place, seule la demande disparaît.

**La garantie est implémentée, pas déléguée au dashboard** : `POST /subscriptions/refund` (condition : dernière facture payée de moins de 30 jours, reconduction comprise ; effet : remboursement intégral, palier fermé immédiatement, résiliation ; trace : `subscription_refunds`, unique sur `stripe_refund_id`). `charge.refunded` entre dans le `switch` pour que le geste manuel produise la même trace et la même fermeture — et un remboursement **partiel** est tracé sans rien fermer.

**Le vrai risque du lot n'était pas le prix mais son unité.** `plan.price` était lu comme un montant mensuel par deux consommateurs : le crédit de parrainage (« 1 mois offert » aurait rendu 279 €, l'année entière) et le MRR d'administration (surévalué d'un facteur douze). Aucun test ne pouvait le voir — ils dérivaient tous leur valeur attendue de `PLANS`. Les deux lisent désormais `monthlyEquivalentEuros`.

Ajouté par arbitrage explicite : un **préavis de reconduction à J-30**, dédoublonné sur la période annoncée (`subscriptions.renewal_notice_sent_for`) et non sur le compte — l'index unique partiel de `lifecycle_email_sends` n'aurait laissé partir le préavis que la première année.

Les deux propriétés à ne pas casser tiennent, rejouées sur un cycle annuel : idempotence par `event.id` et rejet des événements périmés par `last_stripe_event_at` (24 tests d'intégration contre PostgreSQL réel, dont la nouvelle unicité de trace sous concurrence).

---

### E3-4 · Donner un seul nom à l'offre

**Résultat** — le palier payant cesse de s'appeler « Essentiel » sur la carte, « Artisan » dans la métadonnée, « Contractor » dans la FAQ, le JSON-LD et le tableau de bord. Un nom, partout.
**Zones** — `apps/web/src/lib/pricing.ts`, `apps/web/src/app/pricing/page.tsx`, `apps/web/src/lib/feature-gates-catalogue.ts`, tableau de bord, JSON-LD, métadonnées, côté API.
**Fin quand** — une recherche des trois anciens noms ne rend plus rien d'affiché à l'utilisateur, et un test l'impose. **Charge S.**

**`/model sonnet` · `/effort medium`** — renommage sur périmètre entièrement décidé, sans arbitrage : il suffit de ne pas confondre les libellés affichés avec les identifiants techniques de palier, que la base et Stripe référencent. Sonnet 5 tient parfaitement ce travail, à 40 % du prix d'Opus. `medium` parce que la tâche est un remplacement guidé.

```text
/model sonnet
/effort medium
Le palier payant porte trois noms différents selon l'écran, et un artisan qui compare doit deviner que ce sont le même produit. Relevé : la carte tarifaire affiche "ESSENTIEL", la métadonnée de /pricing dit "Artisan à 19 €/mois", la FAQ dit "Pro ou Contractor ?" et "Contractor couvre-t-il tous les corps d'état ?", la page d'accueil renvoie vers "Voir les offres Contractor", le JSON-LD publie name "Contractor Essentiel", et le tableau de bord affiche "Plan Contractor".

Unifie sur un seul nom commercial : "Chiffréo Pro".

RÈGLE ABSOLUE : ne renomme QUE ce qui est affiché à l'utilisateur. Les identifiants techniques de palier — la valeur contractor_essentiel utilisée en base, dans les feature gates, dans les migrations et dans les métadonnées Stripe — ne changent PAS. Les renommer casserait la résolution des gates et le rattachement des abonnements. Si tu penses qu'un identifiant doit changer, arrête-toi et demande-moi.

Couvre : cartes tarifaires, métadonnées et OpenGraph, JSON-LD, FAQ, tableau de bord, e-mails transactionnels, PDF, textes des paywalls, CGV. Mets aussi à jour les mentions dans docs/.

Ajoute un test qui échoue si une chaîne affichée à l'utilisateur contient "Contractor", "Essentiel" ou "Artisan" employé comme nom de palier. Attention aux faux positifs : le mot artisan employé comme nom commun reste légitime partout.

Vérifie : pnpm test:web, pnpm test:api, pnpm build:web, pnpm lint, offer-catalogue.spec.ts.
```

---

### E3-5 · Réécrire la page tarifaire

**Résultat** — `/pricing` présente deux colonnes et une seule décision : gratuit pour chiffrer, 279 € par an pour éditer des devis et facturer. Le périmètre chiffrable est annoncé avant le prix, comme aujourd'hui — c'est un actif rare, à conserver.
**Zones** — `apps/web/src/app/pricing/page.tsx`, `apps/web/src/lib/pricing.ts`.
**Fin quand** — chaque ligne vendue est atteignable depuis la navigation par un compte du palier concerné, et `offer-catalogue.spec.ts` est vert. **Charge M.**

**`/model sonnet` · `/effort high`** — page marketing entièrement spécifiée par les décisions d'E3-1 à E3-4 : structure, données depuis un module partagé, JSON-LD, rendu statique. C'est le profil de Sonnet 5. `high` parce qu'il faut préserver deux dispositifs de qualité existants — l'annonce du périmètre avant le prix, et le test qui interdit de vendre une ligne sans gate.

```text
/model sonnet
/effort high
Réécris apps/web/src/app/pricing/page.tsx pour la nouvelle offre : deux colonnes, une seule décision.

Colonne gratuite : chantiers illimités, chiffrage complet avec géométries en L, T et U, déduction des ouvertures, facteurs de perte par pose et par niveau, liste d'achat en conditionnements commerciaux, sources fabricants affichées, saisie des prix et budget, export de la liste. Appel à l'action : créer un compte gratuit, sans carte bancaire.

Colonne payante, "Chiffréo Pro", 279 € HT par an, annuel uniquement, trente jours satisfait ou remboursé : tout le gratuit, plus devis PDF conforme avec mentions obligatoires, fichier clients et historique de chantiers, facturation numérotée, historique des prix et du taux horaire.

À CONSERVER — deux dispositifs de qualité déjà en place. Premièrement, le périmètre chiffrable est annoncé AVANT le prix : peintre, carreleur, plaquiste, solier, poseur de parquet, poseur de revêtement mural ; et explicitement pas de plomberie, électricité, isolation, maçonnerie, menuiserie, avec la phrase qui recommande un logiciel tous corps d'état si l'activité repose sur ces lots. C'est rare et honnête, garde-le. Deuxièmement, chaque ligne d'offre reste adossée à une feature gate réelle, ou porte une raison explicite de ne pas l'être — le test src/__tests__/offer-catalogue.spec.ts l'impose, mets-le à jour sans jamais le désactiver.

Ne vends AUCUNE ligne qui ne soit pas atteignable depuis la navigation par un compte du palier concerné. Retire notamment le comparateur de prix entre enseignes tant que les adaptateurs sont désactivés.

Refais la FAQ en cohérence : elle doit répondre à "pourquoi le chiffrage est-il gratuit", "pourquoi seulement de l'annuel", "que se passe-t-il en 2027 pour la facture électronique", "quels métiers sont couverts". Mets à jour le JSON-LD SoftwareApplication et AggregateOffer, la métadonnée, le canonical.

Vérifie : pnpm test:web, pnpm build:web, rendu statique effectif, pnpm lint, offer-catalogue.spec.ts.
```

---

### E3-6 · Réécrire la page d'accueil

**Résultat** — `/` porte la promesse reformulée, s'adresse à l'artisan, annonce que le chiffrage est gratuit, et cesse d'être un composant client sans métadonnée. C'est la surface la plus liée du site et la moins travaillée aujourd'hui.
**Zones** — `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`.
**Fin quand** — la page est rendue côté serveur avec title, description, canonical, OpenGraph et données structurées propres, et le contenu principal est dans le HTML. **Charge M.**

**`/model sonnet` · `/effort high`** — copie marketing plus conversion d'un composant client vers un composant serveur, avec métadonnées et données structurées. Entièrement spécifiable une fois la promesse reformulée en E2-3. Sonnet 5. `high` parce que la bascule client vers serveur peut casser des interactions existantes (session invité, appel à l'action conditionnel).

```text
/model sonnet
/effort high
Réécris apps/web/src/app/page.tsx. Deux problèmes à régler en même temps.

PROBLÈME TECHNIQUE. La page est un composant client sans métadonnée : ni title propre, ni description, ni canonical, ni OpenGraph spécifique — seulement le défaut générique du layout. C'est la surface la plus liée du site et la moins travaillée. Convertis-la en composant serveur avec generateMetadata, en isolant dans des composants clients uniquement les parties réellement interactives. Le titre, l'accroche, les sections de preuve et la FAQ doivent être dans le HTML rendu.

PROBLÈME DE CONTENU. La page parle au bricoleur ("votre niveau de bricolage", "arrêtez d'acheter 15 à 25 % en trop") alors que la cible est l'artisan de finition, et elle promet un budget que le palier gratuit ne donnait pas. Reprends le contenu de apps/web/src/app/artisans/page.tsx comme base et adapte-le à la nouvelle offre.

Le récit à porter : le chiffrage est GRATUIT et illimité ; ce qui est payant, c'est le devis conforme et la facturation, à 279 € par an. L'argument central est la profondeur du calcul — géométrie réelle de la pièce y compris décrochés et pièces en L, ouvertures déduites, pertes selon la pose et le niveau, conditionnements commerciaux — et la traçabilité : la fiche fabricant est derrière chaque ratio. Utilise le chiffre mesuré du parcours, issu de parcours-chrono.spec.ts, plutôt qu'une promesse ronde.

INTERDITS. Ne promets nulle part "la quantité exacte" ni "le seul outil qui calcule" : voir E2-3. Ne mentionne aucune fonctionnalité gelée ni aucun corps d'état hors périmètre. Conserve l'annonce du périmètre chiffrable avant tout appel à l'action commercial.

Ajoute les données structurées pertinentes et une FAQ dans le HTML. Mets à jour le sitemap et les liens internes après la fusion de /artisans dans /.

Vérifie : pnpm test:web, pnpm build:web, pnpm lint, et confirme que le contenu principal est présent dans le HTML servi et non injecté côté client.
```

---

### E3-7 · Réparer le cul-de-sac des calculateurs

**Résultat** — l'appel à l'action « Sauvegarder mon projet » cesse d'aboutir à un écran de chargement infini. C'est la sortie du seul canal d'acquisition construit, et elle est cassée.
**Zones** — `apps/web/src/components/calculators/PublicCalculator.tsx:191-224`, `apps/web/src/contexts/AuthContext.tsx`, `apps/web/src/app/(app)/projects/[id]/dimensions/page.tsx:285`, `apps/web/src/app/(app)/dashboard/page.tsx`.
**Fin quand** — un visiteur sans session part d'un calculateur public et arrive sur son projet, et un test navigateur couvre ce chemin. **Charge M.**

**`/model opus` · `/effort high`** — le défaut est subtil et l'analyse compte plus que le code : un invité a `appUser` non nul parce que `syncWithBackend` s'exécute pour tout utilisateur y compris anonyme, donc toutes les branches `if (appUser)` prennent le chemin API ; le brouillon local n'est jamais migré parce que `startGuestSession` ne rejoue pas `migrateLocalProjects` ; et la page reste bloquée parce que le `return` du squelette précède l'affichage de l'erreur. Trois causes composées dans un état d'authentification : c'est du raisonnement, pas du correctif. Opus 5. `high`.

```text
/model opus
/effort high
Répare le cul-de-sac du parcours d'acquisition. C'est la sortie du seul canal construit, et elle est cassée.

Chemin fautif reproductible : un visiteur SANS session ouvre un calculateur public, calcule, clique "Sauvegarder mon projet". Le brouillon est écrit en localStorage, une session invité s'ouvre, et il atterrit sur le tableau de bord. Là, deux sections s'affichent simultanément — la liste API vide et la carte du brouillon local. Cliquer "Définir les dimensions" l'envoie sur /projects/<uuid-local>/dimensions, où la page reste bloquée sur son squelette de chargement, sans même afficher l'erreur.

Trois causes composées, à vérifier avant de corriger.
1. Un invité a appUser NON NUL : onIdTokenChanged déclenche syncWithBackend pour tout utilisateur, y compris anonyme. Donc toutes les branches if (appUser) prennent le chemin API, y compris pour un identifiant de projet purement local.
2. startGuestSession ne rejoue pas migrateLocalProjects — seuls register et les trois voies de conversion le font. Le brouillon local n'est donc jamais migré vers l'API.
3. Dans dimensions/page.tsx, l'appel API rend 404, rooms reste vide, activeRoomId reste nul, formReady reste faux, et le return du squelette précède l'affichage de l'alerte : l'erreur est invisible.

Corrige les trois, et pas seulement la troisième. Décide et argumente la bonne stratégie : migrer le brouillon local dès l'ouverture de la session invité, ou ne pas ouvrir de session invité tant que le brouillon n'est pas migré. Traite le cas où la migration échoue — l'utilisateur doit voir une erreur actionnable, jamais un squelette.

Traite aussi la double section du tableau de bord : après correction, un invité ne doit pas voir en même temps une liste API vide et une carte de brouillon local.

Le test PublicCalculator.spec.tsx s'arrête à "écrit le brouillon et redirige" et ne suit pas le brouillon. Étends-le, et ajoute dans apps/web/e2e/ un test navigateur qui part d'un calculateur public sans session et va jusqu'à la page de dimensions du projet créé, avec ses valeurs préremplies.

Vérifie : pnpm test:web, le nouveau test navigateur, pnpm build:web, pnpm lint.
```

---

## E4 — Réduire à la V1

*Supprimer ce qui a été construit pour personne. Git garde tout.*

---

### E4-1 · Supprimer les organisations et le multi-utilisateurs

**Résultat** — douze routes sans aucun écran disparaissent, avec leurs entités, leurs migrations et leur cascade. La portée redevient l'utilisateur. C'est la suppression la plus lourde du backlog.
**Zones** — `apps/api/src/organizations/`, `org-context.service.ts`, les dix-huit tables portant `organization_id` directement ou par chaîne, `invoice_sequences`, `quote_sequences`, migration.
**Fin quand** — plus aucune référence à l'organisation dans le code de production, la suite d'intégration est verte, et la numérotation des factures reste continue. **Charge L.**

**`/model opus` · `/effort xhigh`** — c'est l'opération la plus dangereuse du backlog. `organization_id` porte sur dix-huit tables, la portée est résolue côté serveur dans le chemin critique de toutes les requêtes authentifiées, et deux tables sans entité — les séquences de numérotation — sont atteintes en SQL brut avec l'organisation en clé primaire composite. Une migration ratée détruit la continuité légale des numéros de facture. Il n'existe aucune circonstance où ce travail se délègue à un modèle moins capable. `xhigh` : dix-huit tables, migration irréversible en pratique, vérification longue.

```text
/model opus
/effort xhigh
Entre en plan mode et ne code rien avant que je valide le plan.

Objectif : supprimer les organisations et le multi-utilisateurs. Décision D3 étendue de l'ADR. Le module organizations expose douze routes et n'a AUCUN écran ; le multi-utilisateurs a été vendu puis gelé sans jamais avoir d'interface d'invitation.

Ce que tu dois relever avant de proposer quoi que ce soit. L'inventaire existe déjà dans tasks/todo.md, lis-le : huit tables portent organization_id en colonne directe, dix y sont rattachées par chaîne de propriété via projects, et DEUX tables n'ont pas d'entité TypeORM et sont atteintes uniquement en SQL brut — invoice_sequences et quote_sequences, toutes deux en clé primaire composite (organization_id, year). La portée est résolue exclusivement côté serveur dans org-context.service.ts, et le contrôle de propriété passe par trois portes : findOneForOrg qui rend 403, assertProjectInOrg qui rend 403, et des clauses WHERE composites qui rendent 404. La convention de refus est donc DOUBLE et les tests devront asserter le code réellement rendu par chaque route.

DANGER PRINCIPAL, à traiter en premier dans ton plan : les séquences de numérotation. La numérotation des factures est légalement continue et sans trou. Passer d'une clé (organization_id, year) à une clé (user_id, year) ou (year) doit préserver EXACTEMENT les numéros déjà émis et la continuité future. Une facture déjà émise ne doit jamais changer de numéro, et le prochain numéro ne doit créer ni trou ni doublon. Si tu ne sais pas garantir cela, dis-le et propose de conserver la table telle quelle en la renommant plutôt que de la migrer.

Le modèle est backfillé 1 pour 1 : chaque organisation correspond aujourd'hui à un utilisateur. Vérifie que c'est vrai en base avant de t'appuyer dessus, et dis-moi ce que tu trouves.

Ton plan doit couvrir : l'ordre de suppression, la stratégie de migration table par table, la réversibilité ou son absence assumée, l'impact sur l'export de données personnelles, l'impact sur les tests d'intégration existants, et ce qui remplace la portée organisation pour l'isolation — voir E5-4 qui écrira les tests d'isolation par utilisateur.

Après validation, implémente. Vérifie : migration up et down si réversible, pnpm test:api, pnpm test:api:integration, pnpm lint, et prouve-moi par une requête que la numérotation des factures est intacte avant et après.
```

---

### E4-2 · Supprimer les surfaces mortes

**Résultat** — benchmark de coûts, apprentissage des facteurs de perte, précision et ré-entraînement de la vision par ordinateur : les modules et leurs routes d'administration disparaissent. Les tables restent, désactivées, sans coût.
**Zones** — `apps/api/src/{cost-benchmark,waste-learning,analysis}/`, routes `admin/*` sans point d'entrée.
**Fin quand** — plus aucune route non atteignable ne subsiste, et la liste des modules de l'API correspond à ce que le produit fait. **Charge M.**

**`/model opus` · `/effort high`** — suppression, donc cascade de dépendances à identifier : le benchmark est injecté ailleurs, l'apprentissage des pertes se superpose au moteur, et le module `analysis` porte encore la route de photos. Il faut distinguer ce qui se supprime de ce qui se neutralise. Opus 5 pour la sûreté de la suppression. `high` : périmètre large mais sans migration destructrice.

```text
/model opus
/effort high
Supprime les surfaces construites pour personne. Décision D3 étendue.

À SUPPRIMER — code, contrôleurs, modules, services, tests associés.
1. cost-benchmark. Le benchmark est de plus cassé par construction : il rejette tout chantier où un material_id apparaît sous deux work_type_code, or peinture murale et peinture plafond partagent leurs matériaux — tout projet mêlant les deux est exclu. Vérifie où le service est injecté avant de supprimer.
2. waste-learning. Statistiquement bien construit mais inatteignable : il exige au moins huit chantiers clôturés et trois organisations distinctes par cellule matériau x pose x niveau, soit plus de neuf cents cellules. ATTENTION : la superposition des facteurs appris intervient dans le moteur d'estimation. Retire cette superposition proprement, sans changer une seule quantité produite aujourd'hui — le harnais de snapshots doit rester identique.
3. Les routes d'administration sans point d'entrée : rapport de précision de la vision par ordinateur, ré-entraînement, administration du benchmark et de l'apprentissage. Le back-office ne navigue que vers trois pages ; tout le reste est inatteignable même pour un administrateur.

À CONSERVER : les tables en base, vides et inutilisées. Les supprimer coûterait une migration destructrice pour un gain nul, et elles ne coûtent rien tant qu'elles ne sont pas écrites.

CAS PARTICULIER — le module analysis. La vision par ordinateur est débranchée mais le code reste dans git par décision D2, avec une condition de retour écrite. Ne supprime pas apps/cv-service. En revanche, retire du produit ce qui n'est plus atteignable : la route de photos réduite à une redirection, et les contrôleurs d'administration liés. Dis-moi précisément ce que tu retires et ce que tu laisses, pour que la condition de réouverture de l'ADR reste exécutable.

Vérifie : pnpm test:api, pnpm test:api:integration, le harnais d'estimation INCHANGÉ, pnpm build:api, pnpm lint. Donne-moi la liste des routes supprimées et le nombre de lignes retirées.
```

---

### E4-3 · Rendre l'atteignabilité vérifiable

**Résultat** — plus aucun bouton ne mène à une fonctionnalité gelée. Le bouton « Suivi de chantier », affiché sur chaque carte projet d'un abonné, mène aujourd'hui à un paywall qui lui propose de souscrire au palier auquel il est déjà, pour une fonctionnalité refusée à tous les paliers. Et un test l'interdit désormais.
**Zones** — `apps/web/src/components/project/ProjectCard.tsx:120-128`, `apps/web/src/app/(app)/projects/[id]/site-tracking/page.tsx`, tableau de bord, `src/__tests__/`.
**Fin quand** — un test échoue si un élément de navigation pointe vers une gate désactivée. **Charge M.**

**`/model opus` · `/effort high`** — le dépôt a déjà le meilleur garde-fou du marché sur ce point (`offer-catalogue.spec.ts` interdit de *vendre* une gate gelée) mais il ne vérifie pas l'*atteignabilité*. Écrire ce second garde-fou demande de concevoir une propriété testable à partir d'un catalogue de gates et d'un graphe de navigation, ce qui est un problème de conception, pas de transcription. Opus 5. `high`.

```text
/model opus
/effort high
Aucun élément de navigation ne doit mener à une fonctionnalité gelée. Aujourd'hui trois le font.

1. ProjectCard.tsx:120-128 affiche un bouton "Suivi de chantier" sur CHAQUE carte projet d'un artisan. Il mène à une page dont le premier effet est d'ouvrir le paywall de la gate site_tracking. Cette gate est GELÉE — refusée à tous les paliers, palier maximal compris. Et comme son min_tier vaut le palier payant, le paywall propose à un abonné de souscrire au palier auquel il est déjà. C'est le pire enchaînement possible.
2. La liste d'achat câble un paywall vers la gate eco_materials, également gelée.
3. Le tableau de bord propose le carnet du logement et le parrainage, tous deux gelés par l'ADR et hors cible.

Retire ces points d'entrée. Puis, et c'est le vrai livrable, écris le garde-fou qui manque.

Le dépôt possède déjà src/__tests__/offer-catalogue.spec.ts, qui interdit structurellement de VENDRE une ligne d'offre sans gate réelle derrière. C'est excellent. Sa limite : il ne vérifie pas qu'une gate gelée n'est pas ATTEIGNABLE depuis la navigation. Conçois et écris ce second test. Propose la méthode : relevé statique des liens et des appels de navigation croisé avec le catalogue de gates, ou parcours navigateur systématique, ou déclaration explicite par écran de la gate qu'il requiert. Argumente ton choix — je veux un test qui ne produise ni faux positif ni angle mort silencieux — puis implémente-le.

La règle à faire respecter est écrite au paragraphe 3.4 de l'ADR : toute ligne vendue doit être atteignable depuis la navigation par un compte du palier concerné. Étends-la : et rien de gelé ne doit être atteignable par personne.

Vérifie : pnpm test:web, le nouveau test, pnpm build:web, pnpm lint, et donne-moi la liste exhaustive des gates gelées avec, pour chacune, la preuve qu'aucun chemin de navigation n'y mène.
```

---

### E4-4 · Trancher la page de vérification de devis

**Résultat** — `/verifier-un-devis` cesse d'aider un particulier à contester le devis d'un artisan, alors que l'artisan est le client. Elle est retournée en outil de défense du devis, ou retirée.
**Zones** — `apps/web/src/app/verifier-un-devis/page.tsx`, `apps/web/src/lib/quote-check.ts`, `apps/api/src/estimations/public-quote-check.controller.ts`, sitemap.
**Fin quand** — la décision est prise, appliquée, et cohérente avec la cible de l'ADR. **Charge M.**

**`/model opus` · `/effort high`** — c'est d'abord un arbitrage produit à conséquence commerciale : la page a une vraie valeur SEO (priorité 0,9 au sitemap) mais elle est structurellement hostile au client payant. Décider entre retourner et retirer, puis réécrire le récit sans mentir, demande du jugement. Opus 5. `high`.

```text
/model opus
/effort high
Tranche le sort de la page /verifier-un-devis, et applique ta décision.

Le problème. Cette page permet de saisir les dimensions d'une pièce et les quantités annoncées dans un devis reçu, et de les confronter à ce que le catalogue implique. Elle est bien faite : elle annonce des quantités et non un jugement, un test lui interdit toute promesse de prix, et elle porte la priorité 0,9 au sitemap, la plus élevée du site. Mais elle s'adresse à un PARTICULIER qui veut contester le devis d'un ARTISAN. Or l'artisan est notre client payant. Nous outillons quelqu'un contre notre utilisateur.

Deux options, et je veux ta recommandation argumentée avant l'exécution.

Option A, retourner. La page devient un outil pour l'artisan : "défendez votre devis". Il saisit son chantier, obtient les quantités calculées avec leurs sources, et une note d'une page qu'il peut joindre à son devis pour justifier ses fournitures face à un client qui négocie. Le moteur est le même, le récit s'inverse. Avantage : conserve l'actif SEO et le transforme en argument commercial. Risque à évaluer : les requêtes qui amènent du trafic sur cette page sont-elles des requêtes de particulier ou d'artisan ? Si elles sont de particulier, retourner le contenu tue le trafic sans rien gagner.

Option B, retirer. Suppression de la page, de son contrôleur public, de son entrée au sitemap, avec une redirection propre. Avantage : cohérence totale. Coût : perte d'une surface indexable travaillée.

Instruis les deux, recommande, et applique. Si tu choisis A, réécris entièrement le contenu, les métadonnées, la FAQ, le JSON-LD et les appels à l'action pour l'artisan, et vérifie que le test qui interdit toute promesse de prix reste vert. Si tu choisis B, fais la suppression proprement, redirection comprise.

Dans les deux cas, mets à jour le sitemap et les liens internes. Vérifie : pnpm test:web, pnpm test:api, pnpm build:web, pnpm lint.
```

---

### E4-5 · Purger les mentions de ce qui n'existe plus

**Résultat** — la documentation et les surfaces du produit cessent de décrire des fonctionnalités supprimées. `docs/` contient encore des documents qui décrivent un produit lancé et mature qui n'existe pas — et ils sont lus par tout nouvel arrivant, y compris par les agents qui travaillent sur ce dépôt.
**Zones** — `docs/`, `README.md`, `apps/api/README.md`, `apps/web/README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`.
**Fin quand** — un lecteur qui ne connaît pas le projet comprend en dix minutes ce que le produit fait, et ne trouve aucune fonctionnalité décrite qui n'existe pas. **Charge M.**

**`/model sonnet` · `/effort medium`** — travail documentaire de grande ampleur mais entièrement guidé : les suppressions ont été faites en E4-1 à E4-4, il s'agit de répercuter. Sonnet 5, prix d'introduction. `medium` parce qu'il n'y a aucun arbitrage — l'état de vérité est le code.

```text
/model sonnet
/effort medium
Mets la documentation du dépôt à l'état réel du produit après les suppressions des tâches E3 et E4. Enjeu concret : ces documents sont lus par tout nouvel arrivant ET par les agents qui travaillent sur ce dépôt. Les laisser décrire un produit qui n'existe pas garantit que la prochaine session reconstruira des fonctionnalités au lieu de les vendre.

Fichiers à reprendre : README.md à la racine, apps/api/README.md, apps/web/README.md, docs/API.md, docs/ARCHITECTURE.md, docs/CONTEXT.md, et tout autre document de docs/ qui décrit des fonctionnalités.

Ce qui a disparu et ne doit plus être mentionné comme existant : le palier DIY à 9,99 €, la landing particulier, les organisations et le multi-utilisateurs, le benchmark de coûts, l'apprentissage des facteurs de perte, les routes d'administration supprimées, le suivi de chantier, les relances de devis, les éco-matériaux, le carnet du logement, le parrainage, la galerie communautaire, le widget marque blanche, l'API publique à clés, le SSO Enterprise, et l'analyse photo par vision par ordinateur.

Ce qui a changé : l'offre est désormais un gratuit illimité pour le chiffrage et un payant annuel à 279 € pour le devis et la facturation ; la promesse est une estimation à valider et non une quantité exacte ; le périmètre couvre sept ouvrages de finition.

Ce qui reste vrai et doit être dit : la vision par ordinateur est débranchée mais conservée dans git avec une condition de retour écrite dans l'ADR 0001 ; les tables du benchmark et de l'apprentissage restent en base, inutilisées.

Reprends docs/CONTEXT.md en profondeur : il date de mars 2026, se dit "en phase de cadrage", décrit cinq epics MVP et sept sprints qui n'ont plus cours, et présente une architecture "envisagée" avec des choix "à valider en Sprint 0" alors que tout est construit. Soit tu le réécris à l'état réel, soit tu l'archives dans docs/archive/ et tu le remplaces par un document court. Recommande et applique.

Vérifie : aucun lien mort dans les documents, aucune commande d'exemple qui échoue, et la table des scripts du README correspond à package.json.
```

---

### E4-6 · Confirmer le débranchement de la vision par ordinateur

**Résultat** — la condition de réouverture de la décision D2 reste exécutable, et rien dans le produit ne laisse entendre qu'une analyse photo existe. Le service reste dans git, non déployé.
**Zones** — `docker-compose.prod.yml`, `.github/workflows/deploy.yml`, `.env.example`, `apps/cv-service/README.md`, `docs/adr/0001`.
**Fin quand** — un audit du dépôt confirme que le service n'est ni construit, ni déployé, ni référencé comme disponible, et que la procédure de réouverture est écrite et testable. **Charge S.**

**`/model haiku`** — vérification de fichiers de configuration : YAML de composition Docker, YAML d'actions GitHub, variables d'environnement, markdown. Aucun idiome de framework postérieur à février 2025 n'intervient, le contexte de 200k est amplement suffisant, et à 1/5 $ par MTok c'est cinq fois moins cher que Sonnet pour une lecture de configuration. **Pas de ligne `/effort`.**

```text
/model haiku
Vérifie et consolide le débranchement du service de vision par ordinateur, décision D2 de l'ADR 0001. Le service doit rester dans git mais n'être ni construit, ni déployé, ni présenté comme disponible.

Contrôle point par point et corrige ce qui ne va pas.
1. docker-compose.prod.yml : le service cv ne doit pas y figurer, et les 4 Go de RAM qu'il réservait doivent être libérés. Confirme la valeur par défaut de CV_ENABLED.
2. .github/workflows/deploy.yml : aucune étape ne doit récupérer ou vérifier des poids de modèle YOLO. Confirme que le déploiement n'est bloqué par aucune vérification liée au service.
3. .env.example : CV_ENABLED doit valoir false, et le commentaire doit dire clairement que le service est hors production. Aucune valeur d'exemple ne doit être un secret réel.
4. docker-compose.yml de développement : le service peut rester pour un usage local, mais dis-moi s'il y est et si c'est intentionnel.
5. apps/cv-service/README.md : doit indiquer en tête que le service est débranché, avec un renvoi vers la condition de retour de l'ADR.
6. Cherche dans apps/web et apps/api toute mention affichée à l'utilisateur d'une analyse photo, d'un scan de pièce ou d'une estimation par image, et liste-les-moi sans les modifier.

Produis un compte rendu en tableau : point de contrôle, état constaté, action faite ou recommandée. Ne touche à aucun fichier TypeScript.
```

---

---

## E5 — Conformité, droit et risque

*Les postes que le modèle économique ignorait, et dont un seul peut coûter la totalité de la base client.*

---

### E5-1 · Décider et préparer la Plateforme Agréée

**Résultat** — la décision D5 est tranchée sur des chiffres : partenariat avec une PA, ou retrait de la facturation de l'offre. Et si c'est le partenariat, le modèle de facture est prêt à être sérialisé sans migration lourde.
**Zones** — `docs/CONFORMITE_FACTURATION.md`, `apps/api/src/invoices/`, ADR.
**Fin quand** — la décision est écrite dans l'ADR avec son coût, et le modèle de données porte tous les champs qu'exige EN 16931. **Charge L.**

**`/model opus` · `/effort xhigh`** — obligation réglementaire à échéance ferme, dont le manquement fait partir la totalité de la base en un mois. Il faut lire un cadre juridique daté, évaluer des options contractuelles, et vérifier qu'un modèle de données existant supporte une sérialisation normée sans reprise. La coupure de mai 2026 d'Opus 5 couvre le cadre réformé de 2026 — c'est le seul modèle du lineup dont la connaissance est postérieure au décret. `xhigh` : recherche, analyse, migration, vérification longue.

```text
/model opus
/effort xhigh
Instruis et prépare la décision D5 de l'ADR : la facturation électronique.

Le cadre, à vérifier avant de raisonnner dessus. Réception obligatoire de factures électroniques pour toutes les entreprises assujetties à la TVA au 1er septembre 2026 ; émission et e-reporting obligatoires pour les PME, TPE et micro-entreprises au 1er septembre 2027 ; décret et arrêté du 27 juillet 2026 ; le PPF gratuit d'émission a été supprimé, le raccordement à une Plateforme Agréée par la DGFiP est donc obligatoire. Les travaux facturés à des particuliers relèvent de l'e-reporting, pas de la facture électronique B2B — ce qui est le cas majoritaire de nos utilisateurs. La franchise en base de TVA n'exonère de rien.

Conséquence pour Chiffréo : nous émettons des factures pour nos clients artisans. Au 1er septembre 2027, soit nous sommes raccordés à une PA, soit nos clients partent en un mois.

Travail à faire, en deux volets.

VOLET DÉCISION. Reprends l'instruction des coûts produite en E0-7. Compare les deux options écrites dans l'ADR : (a) partenariat de sous-traitance avec une PA immatriculée, (b) retrait de la facturation de l'offre en ne vendant que le chiffrage et le devis. Chiffre l'impact de (a) sur la marge unitaire : sur un abonnement à 279 € HT par an, un coût de 3 à 6 € par mois et par client représente 36 à 72 € par an, soit 13 à 26 % du revenu. Chiffre l'impact de (b) sur la rétention : la numérotation de facture est le premier verrou du produit. Recommande, et écris la décision dans l'ADR avec sa date de réexamen.

VOLET TECHNIQUE, à faire quelle que soit la décision. Vérifie que le modèle de facture porte déjà TOUS les champs qu'exige la norme EN 16931 pour une sérialisation Factur-X ultérieure : identifiant de l'acheteur, adresse de livraison, catégories et motifs d'exonération de TVA, références de commande, conditions de règlement structurées. docs/CONFORMITE_FACTURATION.md affirme que le modèle est déjà aligné — vérifie-le champ par champ contre la norme, et ajoute par migration ce qui manque. C'est le travail qui doit être fait MAINTENANT : ajouter un champ à des factures déjà émises est coûteux, ajouter un sérialiseur plus tard ne l'est pas.

Vérifie : migration up et down, pnpm test:api, pnpm test:api:integration, pnpm lint, et donne-moi le tableau champ par champ EN 16931 contre modèle actuel, avec la mention présent, ajouté, ou non applicable.
```

---

### E5-2 · Souscrire la responsabilité civile professionnelle

**Résultat** — le dossier est prêt pour souscrire une RC Pro éditeur de logiciel avec extension erreur de calcul. C'est la deuxième ligne de défense, et le mot « assurance » n'apparaissait nulle part dans le projet.
**Zones** — `docs/ASSURANCE_ET_RISQUE.md`.
**Fin quand** — deux devis sont obtenus et comparés, et le contrat est souscrit. **Charge S.**

**`/model opus` · `/effort high`** — il faut décrire fidèlement le risque d'un éditeur de quantitatifs à un assureur qui ne connaît pas le métier, sans le minimiser ni le dramatiser, et savoir quelles exclusions repérer dans une proposition. Rédaction technique à enjeu contractuel : Opus 5. `high` — le travail de recherche a été fait en E0-7.

```text
/model opus
/effort high
Complète docs/ASSURANCE_ET_RISQUE.md avec le dossier de souscription d'une RC Professionnelle éditeur de logiciel, prêt à envoyer à des courtiers.

Le risque à décrire fidèlement. Chiffréo produit des quantitatifs de matériaux du bâtiment à partir de dimensions saisies par un artisan professionnel. Un quantitatif erroné peut entraîner un sur-achat — perte économique directe — ou une rupture d'approvisionnement en cours de chantier — arrêt de chantier, frais de livraison, pénalités de retard, perte de réputation pour l'artisan. Les quantités sont ensuite reprises dans un devis à prix ferme envoyé à un client final : une sous-estimation ampute directement la marge de l'artisan, qui ne peut pas la refacturer.

Le cadre juridique à rappeler dans le dossier. La directive (UE) 2024/2853 sur la responsabilité du fait des produits défectueux, transposable au 9 décembre 2026, inclut désormais les logiciels dans la définition de produit — mais elle exclut expressément les pertes purement économiques, ce qui écarte ce régime pour notre cas. Le risque réel est CONTRACTUEL : devoir de conseil de l'éditeur envers un client même professionnel, et fragilité des clauses limitatives au regard de l'article 1170 du Code civil. Mentionne les mesures de maîtrise déjà en place : promesse formulée en estimation à valider et non en exactitude, ratios adossés à des fiches fabricants datées, validation utilisateur explicite avant émission du devis, traçabilité des corrections manuelles.

Produis : une note de présentation du risque en une page destinée à un courtier ; la liste des garanties à demander, avec l'extension pour erreur de calcul ou de données en tête ; la liste des exclusions à repérer et à faire écarter ; les questions à poser sur les plafonds, la franchise, la territorialité, la reprise du passé et la garantie subséquente ; et un e-mail de demande de devis prêt à envoyer, avec le chiffre d'affaires prévisionnel et le nombre de clients estimé sur douze mois.

Termine par un tableau de comparaison à remplir pour deux à trois propositions. Ne modifie aucun autre fichier.
```

---

### E5-3 · Faire relire le corpus juridique

**Résultat** — CGU, CGV, mentions légales et politique de confidentialité sont cohérentes avec la nouvelle offre — annuel, remboursement à trente jours, chiffrage gratuit — et portent la clause de limitation reformulée. Un avertissement de relecture par un juriste est en tête de chaque page.
**Zones** — `apps/web/src/app/{cgu,cgv,mentions-legales,privacy}/page.tsx`.
**Fin quand** — les quatre pages sont à jour et le dossier est parti chez un juriste. **Charge M.**

**`/model opus` · `/effort high`** — rédaction juridique française sur une vente d'abonnement à distance à des professionnels : droit de rétractation et son exclusion entre professionnels, reconduction tacite d'un contrat annuel, obligations d'information précontractuelle, articulation avec le RGPD. C'est le registre où Opus 5 se distingue le plus nettement, et sa coupure de mai 2026 couvre le cadre récent. `high`.

```text
/model opus
/effort high
Mets à jour le corpus juridique du site pour la nouvelle offre : CGU, CGV, mentions légales et politique de confidentialité.

Ce qui change et doit être reflété. L'offre est désormais un palier gratuit sans limite de chantiers, et un abonnement ANNUEL unique à 279 € HT avec trente jours satisfait ou remboursé. Le mensuel disparaît. Le palier DIY disparaît. La promesse est une estimation à valider et non une quantité exacte, conformément à la reformulation d'E2-3.

Points de droit à traiter avec soin.
1. La vente est à distance et s'adresse à des PROFESSIONNELS. Traite explicitement le droit de rétractation : ses conditions d'application entre professionnels, et l'articulation avec notre garantie commerciale de trente jours, qui est plus favorable et volontaire. Ne confonds pas les deux.
2. Un abonnement annuel se reconduit. Traite la reconduction tacite, l'information préalable à l'échéance, et les modalités de résiliation, en cohérence avec ce qui est réellement implémenté côté Stripe en E3-3.
3. La clause de limitation de responsabilité doit être cohérente avec l'article 1170 du Code civil et avec la promesse reformulée. Ne rédige pas une clause qui prive de sa substance l'obligation essentielle du contrat : elle serait réputée non écrite et nous laisserait sans protection.
4. Vérifie que la politique de confidentialité couvre les traitements réellement en place, y compris la trace de validation des quantités ajoutée en E2-4, et qu'elle reste cohérente avec docs/RETENTION_DONNEES.md et docs/EXPORT_DONNEES.md.
5. Mentions légales : vérifie que les informations de société attendues sont présentes, et signale-moi celles que je dois fournir.

Ajoute en tête de chaque page un bandeau visible indiquant que le document doit être relu par un juriste avant mise en ligne, et produis en parallèle un document docs/RELECTURE_JURIDIQUE.md listant les points précis sur lesquels tu veux l'avis d'un professionnel, avec pour chacun la question posée et l'enjeu.

Vérifie : pnpm test:web, pnpm build:web, pnpm lint.
```

---

### E5-4 · Prouver l'isolation entre utilisateurs

**Résultat** — la propriété qui porte tout le produit — un utilisateur ne voit jamais les données d'un autre — cesse de reposer sur une soixantaine de filtres écrits à la main et sur rien d'autre.
**Zones** — `apps/api/test/integration/`, tous les contrôleurs exposant une ressource privée.
**Fin quand** — chaque route privée est couverte par un test HTTP qui vérifie qu'un appel de l'utilisateur B sur une ressource de l'utilisateur A est refusé, avec le code réellement rendu. **Charge L.**

**`/model opus` · `/effort xhigh`** — sécurité, donc règle numéro 1 sans exception. L'inventaire de `tasks/todo.md` montre que la convention de refus est double — 403 sur la famille projets, 404 sur clients, devis et factures — et que deux tables sont atteintes en SQL brut sans entité. Un test qui asserte un code uniforme choisi a priori serait vert et faux. Il faut asserter le code réellement rendu par chaque route. `xhigh` : quatre-vingts croisements ressource × verbe, exécution répétée contre un vrai PostgreSQL.

```text
/model opus
/effort xhigh
Écris la suite de tests d'isolation qui manque. C'est la propriété qui porte tout le produit et elle ne repose aujourd'hui sur rien d'autre qu'une soixantaine de filtres écrits à la main.

Point de départ : l'inventaire complet est déjà dans tasks/todo.md — lis-le en entier avant de commencer. Il recense les tables org-scopées, les quatre-vingts croisements ressource par verbe à couvrir, et les portes de contrôle de propriété. Si l'épic E4-1 a supprimé les organisations, transpose l'inventaire à une portée par UTILISATEUR et signale-moi tout croisement qui n'existe plus.

Deux pièges relevés dans l'inventaire, à respecter absolument.
1. La convention de refus est DOUBLE. Les projets et leurs dix enfants, ainsi que les photos, rendent 403 par un contrôle après chargement. Les clients, devis, factures et invitations rendent 404 par une clause WHERE composite. Le décompte est de cinquante-trois NotFoundException contre treize ForbiddenException. Tes tests doivent asserter LE CODE RÉELLEMENT RENDU par chaque route, jamais un code uniforme choisi a priori — un test qui attendrait 403 partout serait faux et le prouverait mal.
2. Deux tables n'ont AUCUNE entité TypeORM et sont atteintes uniquement en SQL brut : les séquences de numérotation de devis et de factures. Elles sont invisibles à un relevé par métadonnées. Couvre-les explicitement : un utilisateur ne doit jamais pouvoir consommer ou lire la séquence d'un autre.

Les tests doivent passer par HTTP, contre un vrai PostgreSQL, comme les tests d'intégration existants — pas par appel direct de service avec des dépôts simulés. Deux tests unitaires existent déjà mais aucun ne passe par HTTP et aucun n'affirme de code de statut : c'est précisément le trou.

Structure la suite pour qu'une route ajoutée plus tard sans test d'isolation fasse échouer la suite, plutôt que de passer silencieusement. Propose-moi le mécanisme avant de l'implémenter — relevé dynamique des routes enregistrées croisé avec la liste des routes couvertes, ou déclaration explicite par contrôleur.

Vérifie : pnpm test:api:integration en entier, et donne-moi le tableau final route par route avec le verbe, le code attendu, et le code obtenu.
```

---

### E5-5 · Poser la supervision et l'alerte

**Résultat** — une panne se voit avant que le client l'annonce. Alerte sur la santé de l'application, sur les webhooks Stripe en échec, et sur les erreurs non capturées.
**Zones** — `apps/api/src/sentry-options.ts`, `docs/deploy/`, configuration d'hébergement.
**Fin quand** — une panne simulée déclenche une alerte reçue, et un webhook Stripe en échec en déclenche une autre. **Charge M.**

**`/model sonnet` · `/effort high`** — intégration d'outillage standard, entièrement spécifiable : Sentry est déjà partiellement câblé, il reste à configurer les alertes, la surveillance externe de disponibilité et le canal de notification. Sonnet 5. `high` parce qu'il faut vérifier la chaîne complète jusqu'à la réception, pas seulement la configuration.

```text
/model sonnet
/effort high
Pose la supervision minimale d'une application en production tenue par une seule personne. Le critère n'est pas d'avoir des tableaux de bord, c'est qu'une panne me réveille avant qu'un client me l'annonce.

Trois alertes, et pas une de plus.
1. L'application ne répond plus. Surveillance externe des deux points de santé, de l'API et du web, depuis un service tiers gratuit ou peu coûteux — propose-en deux et recommande. Alerte après deux échecs consécutifs, pour éviter le bruit.
2. Un webhook Stripe échoue. C'est de l'argent : un abonnement peut être payé sans que l'accès s'ouvre, ou annulé sans que l'accès se ferme. Le dépôt écarte déjà les événements obsolètes et garantit l'idempotence ; ce qui manque est l'alerte quand le traitement échoue réellement. Alerte immédiate, sans seuil.
3. Une erreur non capturée survient côté API ou web. Sentry est déjà partiellement câblé — vérifie sentry-options.ts et complète la configuration : environnement, version de l'image déployée, échantillonnage, et surtout filtrage du bruit pour que l'alerte reste crédible.

Le canal de notification doit aboutir sur un téléphone, pas sur une boîte mail consultée le lendemain. Propose une solution simple et documente-la.

Tout doit être inopérant mais silencieux si les variables d'environnement ne sont pas renseignées : aucune erreur au démarrage, aucun plantage. C'est déjà la convention du dépôt, respecte-la.

Documente dans docs/deploy/ la procédure de configuration et, pour chaque alerte, la marche à suivre quand elle se déclenche — c'est ce qui manque le plus quand elle se déclenche à deux heures du matin.

Vérifie : pnpm test:api, pnpm build:api, pnpm lint, et prouve la chaîne complète en simulant les trois pannes et en me montrant les trois alertes reçues.
```

---

## E6 — Mise en ligne

*Trois semaines. Le critère de fin est un paiement réel passé de bout en bout.*

---

### E6-1 · Provisionner et déployer

**Résultat** — l'application tourne sous son domaine, en HTTPS, avec sauvegardes chiffrées et une restauration déjà éprouvée. Le déploiement est réversible.
**Zones** — `docs/DEPLOY.md`, `docs/deploy/`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`.
**Fin quand** — l'application est joignable publiquement, un déploiement puis un retour arrière ont été joués, et une sauvegarde a été restaurée. **Charge M.**

**`/model sonnet` · `/effort xhigh`** — le travail lourd a déjà été fait : le déploiement est conditionné à `--wait` et à un test de fumée, la procédure de retour arrière est écrite en expand/contract, et une restauration a été réellement exécutée. Il reste de la configuration d'infrastructure et une exécution guidée, ce qui est spécifiable. Sonnet 5. `xhigh` parce que c'est une séquence longue avec vérifications en chaîne et des étapes manuelles à orchestrer.

```text
/model sonnet
/effort xhigh
Mets Chiffréo en ligne. Le socle est déjà là : docs/DEPLOY.md, docs/deploy/ avec ses scripts de sauvegarde, de restauration et de test de fumée, un déploiement conditionné à docker compose up --wait, une procédure de retour arrière en expand/contract, et un exercice de restauration hebdomadaire dans .github/workflows/backup-drill.yml. Ne réécris pas ce qui marche.

Ce qui reste à faire.
1. Valide le Caddyfile pour le domaine de production et son sous-domaine d'API, avec TLS automatique, et vérifie les en-têtes de sécurité.
2. Relis docker-compose.prod.yml après la libération des 4 Go du service de vision par ordinateur : redimensionne les limites de mémoire des services restants pour un serveur de 8 Go et dis-moi la marge résiduelle.
3. Vérifie que .env.example ne livre plus AUCUNE valeur par défaut utilisable en production — le dépôt a déjà corrigé le mot de passe PostgreSQL et l'origine CORS, confirme-le — et que la validation d'environnement bloque le démarrage en production sur toute valeur d'exemple.
4. Produis une checklist pas à pas des étapes manuelles que je dois faire moi-même : commande du serveur, enregistrements DNS, création des secrets GitHub, premier déploiement. Numérotée, avec pour chaque étape la commande exacte et la façon de vérifier qu'elle a réussi.
5. Vérifie que le déploiement continu n'est plus bloqué par aucune vérification liée au service de vision par ordinateur.

N'EXÉCUTE RIEN DE DESTRUCTIF et ne touche à aucun serveur : tu prépares et tu vérifies, j'exécute.

Vérifie : docker compose config sur le fichier de production, lint des workflows GitHub, et déroule à blanc la procédure de retour arrière en me montrant ce qui se passe pour les migrations.
```

---

### E6-2 · Passer Stripe en production

**Résultat** — les produits et prix réels existent, le webhook est branché, et un vrai paiement annuel a été encaissé puis remboursé.
**Zones** — configuration Stripe, variables d'environnement, `docs/`.
**Fin quand** — un cycle complet est passé en mode live avec une vraie carte : souscription, ouverture d'accès, remboursement, fermeture d'accès. **Charge S.**

**`/model haiku`** — production d'une checklist de configuration à partir de constantes déjà présentes dans le dépôt, et rédaction d'une procédure. Aucun code applicatif, aucun idiome de framework : la coupure de février 2025 est sans effet, et le contexte de 200k suffit. À 1/5 $ par MTok, c'est le bon choix. **Pas de ligne `/effort`.** Si un webhook se comporte mal en production, escaladez sur Sonnet 5 en `high` — le débogage n'est pas de la configuration.

```text
/model haiku
Produis la procédure de passage de Stripe en mode production pour Chiffréo, dans docs/. Ne modifie aucun code applicatif.

Lis d'abord les constantes de plans et la configuration des abonnements côté API pour connaître les identifiants de prix attendus et leur nom de variable d'environnement exact.

La procédure doit couvrir, étape par étape, avec la commande ou le clic exact et la façon de vérifier le succès de chaque étape.
1. Création du produit et du prix en mode live : un seul produit, un seul prix, récurrence ANNUELLE, 279 € HT. Indique où renseigner la TVA et la devise.
2. Les variables d'environnement à renseigner côté serveur : liste exhaustive, avec pour chacune où trouver sa valeur dans le tableau de bord Stripe.
3. La configuration du webhook : URL exacte de l'endpoint, liste des événements à activer, et où récupérer le secret de signature.
4. Le portail client, si le produit s'en sert : ce qu'il faut y activer et y interdire.
5. La checklist de test d'un cycle complet en mode live avec une vraie carte : souscription, vérification de l'ouverture d'accès, remboursement dans les trente jours, vérification de la fermeture d'accès, puis annulation.

RÈGLE : aucun secret ne doit apparaître en clair dans le dépôt, ni dans ta réponse. Écris des emplacements réservés.

Termine par la liste des vérifications à faire APRÈS la mise en production : que le webhook reçoit bien, que les événements sont traités, et où regarder si ce n'est pas le cas.
```

---

### E6-3 · Écrire le test navigateur du parcours payant

**Résultat** — un test navigateur couvre le chemin qui produit le revenu : compte gratuit, chiffrage, tentative d'export du devis, paywall, souscription, export réussi.
**Zones** — `apps/web/e2e/`.
**Fin quand** — le test tourne en intégration continue contre un Stripe de test et échoue si une marche du parcours casse. **Charge M.**

**`/model sonnet` · `/effort high`** — écriture de test navigateur sur des parcours déjà cartographiés, avec quatre tests Playwright existants comme modèle. Entièrement spécifiable. Sonnet 5. `high` parce que l'orchestration d'un paiement de test dans un test navigateur demande de la rigueur sur les états d'attente.

```text
/model sonnet
/effort high
Écris le test navigateur du parcours qui produit le revenu. Le dépôt en a quatre dans apps/web/e2e/ — parcours invité, conversion, devis-minute et chronométrage — mais aucun ne couvre le passage au payant.

Scénario à couvrir, d'un bout à l'autre : création d'un compte gratuit, création d'un chantier, saisie des dimensions, sélection d'un ouvrage, obtention de l'estimation, obtention de la liste d'achat avec les sources visibles, saisie d'au moins un prix, tentative d'export du devis, apparition du paywall, souscription à l'offre annuelle via Stripe en mode test, retour sur l'application, et export du devis PDF réussi.

Points de vigilance. Le test doit vérifier qu'AUCUN paywall n'apparaît avant la tentative d'export du devis : c'est la promesse du nouveau modèle et c'est ce qui se cassera en premier lors d'une future migration de gates. Il doit aussi vérifier que le PDF exporté n'est pas vide et contient au moins une ligne de matériau et une ligne de main-d'œuvre.

Suis les conventions des quatre tests existants pour l'amorçage des données, l'authentification et l'attente des états. Utilise les cartes de test Stripe. Rends le test capable de tourner en intégration continue sans intervention manuelle, et documente ce qu'il faut configurer pour cela.

Ajoute-le au workflow d'intégration continue. Vérifie : le test passe en local et en intégration continue, et prouve qu'il échoue si tu remets temporairement une gate payante sur la liste d'achat.
```

---

## E7 — Distribution

*Aucun canal ne suffit seul. Le SEO seul ne tient pas l'arithmétique — voir le paragraphe 5.4 du document de refonte.*

---

### E7-1 · Retourner les calculateurs vers le professionnel

**Résultat** — les calculateurs publics cessent de parler au bricoleur. Ils deviennent l'échantillon du produit gratuit, avec les sources visibles et une conversion vers l'inscription, pas vers un tarif.
**Zones** — `apps/web/src/lib/calculators.ts`, `apps/web/src/app/calculateurs/`, `apps/api/src/estimations/public-calculators.controller.ts`.
**Fin quand** — les trois pages parlent au professionnel, affichent les sources, et leur appel à l'action mène à un compte gratuit fonctionnel. **Charge M.**

**`/model sonnet` · `/effort high`** — réécriture de contenu et d'appels à l'action sur une base technique excellente déjà en place : rendu statique, métadonnées par slug, données structurées, positionnement écrit et testé. Le travail est spécifiable. Sonnet 5. `high` pour ne pas casser le test de positionnement existant.

```text
/model sonnet
/effort high
Réoriente les calculateurs publics du bricoleur vers le professionnel. Leur socle technique est excellent — génération statique, métadonnées par slug, données structurées FAQ, vrai moteur derrière, et un test qui interdit une promesse sans mécanisme nommé derrière. Ne casse rien de tout cela.

Ce qui change, c'est le public et le rôle. Sous le nouveau modèle économique, le chiffrage est gratuit et illimité : ces pages ne sont plus un appât vers un paywall, elles sont l'ÉCHANTILLON du produit gratuit.

Travail à faire.
1. Le contenu s'adresse à un professionnel. Remplace le registre bricoleur — "votre niveau de bricolage", "votre pièce" — par le registre du métier : chantier, ouvrage, chute, entraxe, taux de perte. Emploie le vocabulaire qu'un peintre ou un carreleur reconnaît.
2. Affiche les sources dans le résultat, comme dans le produit — c'est l'argument différenciant et c'est ce qui donne envie de créer un compte.
3. L'appel à l'action mène à la création d'un compte gratuit, avec une promesse vraie : chantiers illimités, aucune carte bancaire, le devis conforme en option payante. Ne promets ni budget suivi en temps réel ni carnet du logement — le premier est désormais gratuit et doit être annoncé comme tel, le second n'existe plus.
4. Vérifie que le chemin de sortie fonctionne réellement, après la correction du cul-de-sac faite en E3-7.
5. Mets à jour la FAQ de chaque page pour répondre aux questions d'un professionnel, pas d'un particulier.

Le test de positionnement des calculateurs impose que chaque promesse soit adossée à un mécanisme nommé qui s'exécute sur le chemin public. Mets-le à jour, ne le désactive pas.

Vérifie : pnpm test:web, pnpm build:web, rendu statique effectif, pnpm lint, et confirme que le contenu principal des trois pages est dans le HTML servi.
```

---

### E7-2 · Construire le corpus SEO transactionnel

**Résultat** — trente à cinquante pages qui répondent à des requêtes d'ACHAT de professionnel, pas à des questions de calcul. Les questions de calcul sont absorbées par les réponses génératives de Google et ne produisent plus de clic.
**Zones** — `apps/web/src/app/`, nouveau segment de contenu, sitemap.
**Fin quand** — les pages sont en ligne, indexées, et le suivi de position est en place. **Charge L.**

**`/model fable` · `/effort xhigh`** — la difficulté n'est pas d'écrire des pages, c'est de choisir les bonnes : il faut identifier des requêtes réellement transactionnelles sur un marché de niche, sans accès à un outil de volume, en croisant les pages des concurrents, les forums professionnels et la structure des résultats. C'est une investigation ouverte à réponse non garantie, plus grande qu'une session — le profil de Fable 5. `xhigh` : recherche web répétée sur des dizaines de requêtes.

*Option* — `/effort ultracode` : la production des pages se parallélise par thème une fois la liste arrêtée.

```text
/model fable
/effort xhigh
Construis le corpus SEO de Chiffréo. Contrainte de cadrage, à respecter absolument : ne cible PAS les requêtes de calcul de quantité.

Pourquoi. Ces requêtes sont massivement de particuliers, et surtout leur réponse est un nombre que les réponses génératives de Google affichent sans clic. Sur les requêtes informationnelles où une réponse générative s'affiche, le taux de clic organique chute d'environ soixante pour cent, et environ deux tiers des recherches se terminent aujourd'hui sans clic. Investir là serait investir dans le segment le plus détruit du canal.

Cible à la place les requêtes TRANSACTIONNELLES d'un artisan qui cherche un outil, et les requêtes de MÉTHODE que l'IA résout mal parce qu'elles appellent un raisonnement et non un nombre.

Première étape, la plus importante : établis la liste des requêtes. Croise les pages de contenu des concurrents (Obat, Tolteck, Costructor, Organilog, ArtisanSmart, Batappli, Mediabat), les questions posées sur les forums et groupes professionnels du bâtiment, les suggestions de recherche, les sections "autres questions posées", et la structure des résultats. Pour chaque candidate, évalue : intention (achat, méthode, comparaison), public (professionnel ou particulier), difficulté apparente, et présence d'une réponse générative. Tu n'as pas accès à un outil de volume : dis-le, et raisonne sur la structure des résultats plutôt que d'inventer des chiffres. Livre une liste priorisée de 30 à 50 requêtes avec sa justification.

Deuxième étape : produis les pages. Elles doivent être substantielles et utiles, jamais des variations paramétriques d'un même gabarit — cent pages qui ne diffèrent que par un format de carreau finiront en "explorée, actuellement non indexée", ce qui est un zéro, pas une pénalité, mais un zéro quand même. Chaque page apporte quelque chose qu'aucune autre n'apporte. Quand le moteur peut illustrer le propos, fais-le tourner et montre un cas réel avec ses sources.

Structure technique : rendu statique, métadonnées et canonical par page, données structurées pertinentes, maillage interne vers les calculateurs et vers l'inscription gratuite, entrées au sitemap. Suis les conventions déjà en place sur les calculateurs.

Livre aussi docs/SEO.md : la liste des requêtes avec leur priorité, le calendrier de publication par vagues de dix pages, et le dispositif de suivi de position à mettre en place.

Vérifie : pnpm test:web, pnpm build:web, rendu statique effectif, pnpm lint, et confirme qu'aucune page n'est une simple variation paramétrique d'une autre.
```

---

### E7-3 · Se faire référencer sur les annuaires et comparateurs

**Résultat** — Chiffréo est listé sur appvizer, tool-advisor, lebonlogiciel, Capterra, independant.io et batiadvisor. C'est le canal le plus rapide à rendre : ces sites captent l'intention d'achat sans qu'il faille construire son autorité de domaine.
**Zones** — `docs/ANNUAIRES.md` (à créer).
**Fin quand** — les fiches sont soumises sur au moins quatre annuaires. **Charge S.**

**`/model sonnet` · `/effort high`** — production de contenu structuré et répétitif à partir d'informations déjà établies, avec une contrainte de format par annuaire. Spécifiable. Sonnet 5. `high` parce qu'il faut vérifier les formats attendus de chaque site avant d'écrire.

```text
/model sonnet
/effort high
Prépare le référencement de Chiffréo sur les annuaires et comparateurs de logiciels. C'est le canal le plus rapide à rendre : ces sites captent l'intention d'achat d'un artisan qui cherche "comparatif logiciel devis", sans qu'il faille avoir construit son autorité de domaine.

Cibles : appvizer, tool-advisor, lebonlogiciel, Capterra et GetApp, independant.io, batiadvisor, vox-bati, et tout autre comparateur français du logiciel bâtiment que tu identifies. Vérifie pour chacun la procédure exacte de soumission, si elle est gratuite ou payante, et le format attendu.

Produis docs/ANNUAIRES.md contenant, pour chaque annuaire : l'URL de soumission, la procédure, le coût, et le contenu prêt à coller — description courte, description longue, liste de fonctionnalités dans leur taxonomie, catégories, tarifs, public cible, et les captures d'écran à fournir avec ce qu'elles doivent montrer.

Le positionnement à porter, identique partout : Chiffréo calcule les quantités de matériaux à partir de la géométrie réelle de la pièce, avec les fiches fabricants derrière chaque ratio, sur les ouvrages de finition ; le chiffrage est gratuit et illimité ; le devis conforme et la facturation sont à 279 € par an. Ne promets pas l'exactitude, ne prétends pas être le seul à calculer, et annonce le périmètre restreint aux métiers de finition — un utilisateur déçu par un périmètre caché laisse un avis négatif qui coûte plus cher que l'inscription ne rapporte.

Ajoute une section sur les avis : comment en obtenir honnêtement, ce qu'il est interdit de faire, et à quel moment du parcours les demander.

Ne modifie aucun autre fichier.
```

---

### E7-4 · Préparer la démonstration de quatre-vingt-dix secondes

**Résultat** — une démonstration filmable qui montre, en quatre-vingt-dix secondes, une cloison ou une pièce chiffrée du relevé au devis. C'est le prérequis de tout placement chez un créateur, et de toute relance de négoce.
**Zones** — jeu de données de démonstration, script, `docs/DEMO.md`.
**Fin quand** — la démonstration est jouable en direct sans incident et le script est écrit. **Charge M.**

**`/model sonnet` · `/effort high`** — préparation d'un jeu de données de démonstration, d'un script et d'un enchaînement d'écrans, à partir d'un produit qui existe. Spécifiable. Sonnet 5. `high` parce qu'il faut éprouver l'enchaînement réellement et non le décrire.

```text
/model sonnet
/effort high
Prépare la démonstration de Chiffréo en quatre-vingt-dix secondes. Elle sert deux fois : pour proposer un placement à un créateur du bâtiment sur YouTube, et pour la relance des négoces et fabricants contactés en E0-6. Une démonstration qui ne tient pas à l'écran en quatre-vingt-dix secondes ne convaincra ni l'un ni l'autre.

Ce qu'elle doit montrer, dans cet ordre : un chantier qu'un artisan reconnaît immédiatement ; le relevé des dimensions, y compris un décroché pour montrer que la géométrie est réelle et pas un simple rectangle ; le choix de l'ouvrage ; la liste d'achat en pots, sacs et boîtes ; l'ouverture d'une source fabricant sur une ligne ; et le devis PDF conforme. Fin.

Ce qu'elle ne doit PAS faire : expliquer le produit, montrer un tableau de bord, montrer un tarif, ou prononcer le mot "exact".

Livre trois choses.
1. Un jeu de données de démonstration reproductible : un script d'amorçage qui crée un compte, un client et un chantier réalistes, pour que la démonstration soit rejouable à l'identique et sans improvisation. Il ne doit jamais pouvoir s'exécuter en production.
2. docs/DEMO.md : le script minuté seconde par seconde, avec ce qui est montré à l'écran et ce qui est dit. Écris deux variantes du commentaire — une pour un artisan, une pour un acheteur de négoce, dont les intérêts sont différents : l'artisan veut du temps gagné et de la marge protégée, le négoce veut du panier moyen et de la fidélisation.
3. La liste des points où la démonstration peut casser, avec leur parade.

Éprouve l'enchaînement réellement, en local, du début à la fin, et chronomètre-le. Dis-moi combien de temps il prend et ce que tu as dû retirer pour tenir en quatre-vingt-dix secondes.

Vérifie : le script d'amorçage fonctionne sur une base vierge, et l'enchaînement complet ne provoque aucune erreur à l'écran.
```

---

### E7-5 · Constituer le dossier CAPEB départementale

**Résultat** — un dossier de partenariat prêt à envoyer à une chambre départementale de la CAPEB. Le modèle est prouvé : Tarifeo, Costructor, Tactidevis et Mediabat sont partenaires.
**Zones** — `docs/PARTENARIAT_CAPEB.md` (à créer).
**Fin quand** — le dossier est envoyé à trois chambres départementales. **Charge S.**

**`/model opus` · `/effort high`** — rédaction institutionnelle à destination d'une organisation professionnelle, avec un enjeu de crédibilité : un dossier maladroit ferme la porte pour longtemps, et l'entrée nationale est déjà fermée à un acteur seul. Il faut comprendre ce qu'une chambre départementale cherche pour ses adhérents et le formuler dans son registre. Opus 5. `high`.

```text
/model opus
/effort high
Constitue le dossier de partenariat de Chiffréo avec une chambre DÉPARTEMENTALE de la CAPEB, dans docs/PARTENARIAT_CAPEB.md.

Contexte à intégrer. La CAPEB représente environ cinquante-quatre mille entreprises de dix salariés ou moins et opère un guide d'offres partenaires. Le modèle est prouvé : Tarifeo, Costructor, Tactidevis et Mediabat y figurent. L'entrée nationale n'est pas accessible à un éditeur seul et sans clients ; une chambre départementale l'est, et elle sert de preuve sociale et de canal de test. L'UPMF-FFB, qui fédère les métiers de la finition, revendique plus de sept mille deux cents entreprises adhérentes et constitue la cible fédérale la plus directement pertinente.

Le dossier doit contenir.
1. Une présentation d'une page, écrite pour un responsable de chambre et non pour un investisseur : quel problème d'adhérent l'outil résout, sur quels métiers, ce qu'il ne fait pas. Sois franc sur le périmètre restreint aux ouvrages de finition — c'est ce qui rend la proposition crédible, pas ce qui l'affaiblit.
2. La proposition de partenariat elle-même. Réfléchis à ce qu'une chambre peut vouloir et propose deux ou trois formes : accès gratuit ou remisé pour les adhérents, atelier de formation au chiffrage, contenu pour leur lettre d'information. Ne demande rien en échange dans le premier échange.
3. Le traitement des objections prévisibles : combien de clients avez-vous, depuis quand existez-vous, que se passe-t-il si vous arrêtez, comment gérez-vous les données de nos adhérents, êtes-vous conforme à la facturation électronique de 2027. Réponds honnêtement, y compris quand la réponse est faible — un dossier qui esquive se voit.
4. Un e-mail de premier contact de cent cinquante mots maximum, et une relance à J+15.
5. La liste des chambres départementales à viser en priorité, avec le critère de choix, et la démarche pour identifier le bon interlocuteur.

Ne promets aucune fonctionnalité qui n'existe pas, ne cite aucun chiffre de clients que nous n'avons pas, et n'emploie jamais le mot "exact" au sujet des quantités. Ne modifie aucun autre fichier.
```

---

## E8 — Lire et corriger

*Le funnel remplace le terrain. Sans utilisateurs, ces tâches ne servent à rien — elles viennent après la mise en ligne, pas avant.*

---

### E8-1 · Instrumenter les trois chiffres

**Résultat** — trois chiffres, relevés chaque semaine : visiteur vers inscription gratuite, gratuit vers payant, et churn annuel. Pas un tableau de bord de vingt indicateurs.
**Zones** — `apps/api/src/analytics/`, page d'administration.
**Fin quand** — les trois chiffres sont lisibles sur une page, et un rapport hebdomadaire arrive par e-mail. **Charge M.**

**`/model sonnet` · `/effort high`** — extension d'un module d'analytique déjà en place, requêtes d'agrégation et une page de restitution. Entièrement spécifiable. Sonnet 5. `high` pour la justesse des agrégations, qui décideront de la stratégie.

```text
/model sonnet
/effort high
Instrumente et restitue les TROIS chiffres qui décident de la suite, et rien d'autre. Le dépôt a déjà un module d'analytique et un funnel de revenu instrumenté : étends-les, ne recommence pas.

Les trois chiffres.
1. Visiteur vers inscription gratuite. Numérateur : comptes gratuits créés sur la période. Dénominateur : visiteurs uniques sur les surfaces publiques — accueil, calculateurs, corpus SEO. Segmenté par page d'entrée, parce que c'est ce qui dira quelles pages du corpus fonctionnent.
2. Gratuit vers payant. Numérateur : abonnements annuels souscrits. Dénominateur : comptes gratuits actifs, définis comme ayant produit au moins une liste d'achat. Avec le délai médian entre inscription et souscription.
3. Churn. Sur un abonnement annuel, le churn mensuel n'a pas de sens : mesure le taux de non-reconduction à l'échéance, et en attendant la première échéance, mesure les indicateurs avancés — remboursements dans les trente jours, comptes payants sans aucune activité depuis soixante jours.

Ajoute deux mesures secondaires, qui disent si le produit est utilisé et pas seulement acheté : le nombre de listes d'achat produites par compte actif et par mois, et le nombre de devis émis par compte payant et par mois.

Restitution : UNE page d'administration, les trois chiffres en gros, l'évolution sur douze semaines, et la segmentation par page d'entrée pour le premier. Applique le skill dataviz pour les graphiques. Pas de tableau de bord à vingt indicateurs — c'est ce qui fait qu'on ne regarde rien.

Ajoute un rapport hebdomadaire par e-mail avec ces trois chiffres, leur évolution, et une ligne par changement significatif.

Respecte la vie privée et la cohérence avec la politique de confidentialité : pas de suivi individuel identifiant au-delà de ce qui est déjà déclaré.

Vérifie : pnpm test:api, pnpm test:web, pnpm build:web, pnpm lint, et montre-moi la page avec des données d'amorçage réalistes.
```

---

### E8-2 · Fermer la boucle de correction

**Résultat** — la clôture de chantier, déjà écrite, devient un canal de données : « vous avez acheté cinq sacs, nous en annoncions quatre — pourquoi ? ». Plus une question par ligne dans la liste. C'est le seul œil sur le réel d'un fondateur qui ne visite pas de chantiers.
**Zones** — `apps/api/src/projects/` (clôture), `apps/web/src/app/(app)/projects/[id]/shopping-list/closeout/page.tsx`, `ShoppingListMaterials.tsx`.
**Fin quand** — les écarts sont collectés, structurés et consultables par matériau et par ouvrage. **Charge M.**

**`/model opus` · `/effort high`** — la mécanique est simple mais la conception ne l'est pas : ce qu'on demande, à quel moment, et sous quelle forme décide de la qualité de la seule donnée de terrain que le projet aura jamais. Une question mal posée produit du bruit qu'on ne pourra pas exploiter. C'est de la conception de collecte, pas du formulaire. Opus 5. `high`.

```text
/model opus
/effort high
Ferme la boucle de correction. C'est le seul œil sur le réel de ce projet : je ne visiterai pas de chantiers, donc la seule information de terrain qui me parviendra sera celle que le produit collecte.

Deux points de collecte.

PREMIER — la clôture de chantier. La fonctionnalité existe déjà (gate project_closeout, écran de clôture). Transforme-la en canal de données. Quand l'artisan clôture, présente-lui les quantités annoncées à côté d'un champ pour la quantité réellement achetée, matériau par matériau. Quand un écart existe, demande la RAISON, avec un petit nombre de choix fermés — chute plus importante que prévue, support différent, format différent, erreur de ma part, achat de sécurité — plus un champ libre. Les choix fermés valent plus que le champ libre : ce sont eux qui seront exploitables.

SECOND — la ligne de liste. Ajoute sur chaque ligne une question discrète, "cette quantité vous paraît juste ?", avec trois réponses possibles : oui, trop, pas assez. Une seule réponse par ligne et par chantier, jamais réaffichée si elle a été donnée. Ce doit être un tap, pas un formulaire.

Récupère aussi les corrections manuelles enregistrées en E2-4 : ce sont des écarts eux aussi, déclarés avant achat plutôt qu'après.

Structure les données pour être exploitables : matériau, ouvrage, pose, niveau, quantité calculée, quantité retenue ou achetée, écart relatif, raison, horodatage. Pas un champ de texte libre stocké tel quel.

Ajoute une page d'administration qui agrège ces écarts par matériau et par ouvrage, avec la médiane et la dispersion, et qui range en haut les matériaux dont l'écart médian est le plus élevé. C'est la liste de ce que je dois corriger dans le registre.

CONTRAINTE : ne dégrade pas le parcours. Rien de tout cela ne doit être bloquant, et la clôture doit rester ignorable. Un artisan qui ne répond jamais doit pouvoir utiliser le produit normalement.

Vérifie : migration up et down, pnpm test:api, pnpm test:web, pnpm build:web, pnpm lint, et montre-moi la page d'agrégation avec des données d'amorçage.
```

---

### E8-3 · Consigner le verdict

**Résultat** — un document vivant qui, douze mois après la mise en ligne, dit si le modèle sans terrain fonctionne. Le seuil est écrit avant l'observation : moins de vingt-cinq clients payants et moins de deux mille cinq cents visiteurs organiques mensuels, sans réponse sérieuse d'un négoce, invalide la thèse.
**Zones** — `docs/VERDICT.md` (à créer).
**Fin quand** — le document existe, ses seuils sont fixés, et il est mis à jour chaque mois. **Charge S.**

**`/model opus` · `/effort high`** — écrire un critère d'arrêt qui résiste à sa propre rationalisation est un exercice de discipline intellectuelle, pas de rédaction. Le seuil doit être posé avant l'observation, et le document doit anticiper les arguments que l'on se donnera pour ne pas le respecter. Opus 5. `high`.

```text
/model opus
/effort high
Écris docs/VERDICT.md, le document qui dira si le modèle sans terrain fonctionne, et qui doit être écrit MAINTENANT, avant toute observation, précisément pour que je ne puisse pas le rationaliser plus tard.

Contexte à consigner. Le fondateur travaille seul, plus de vingt heures par semaine, et a décidé de ne pas faire de terrain : pas de rencontres, pas de démarchage, pas d'accompagnement sur chantier. L'acquisition repose donc sur le contenu, les annuaires, les placements auprès de créateurs et un éventuel partenariat de distribution. Il n'existe AUCUN précédent documenté de logiciel vertical vendu aux artisans français acquis purement en self-service : Tolteck s'est construit sur la distribution en négoce, Obat sur une levée de douze millions et quatre-vingts salariés. Ce plan est sans précédent, ce qui ne le rend pas impossible mais interdit de dater sa réussite au trimestre.

Le seuil, à écrire tel quel. Douze mois après la mise en ligne : moins de vingt-cinq clients payants ET moins de deux mille cinq cents visiteurs organiques mensuels ET aucune réponse sérieuse d'un négoce ou d'un fabricant. Si les trois sont réunis, la thèse du self-service sans terrain est invalidée. Explique pourquoi deux mille cinq cents et pas mille : à mille visiteurs par mois, avec trois pour cent de conversion vers l'inscription et douze pour cent vers le payant, le premier objectif de revenu est atteint en plus de cinq ans. Un seuil trop bas est pire que pas de seuil.

Écris les trois issues, à égalité et sans hiérarchie implicite : accepter de faire du terrain ; vendre ou céder le moteur à un négoce, un fabricant ou un éditeur ; arrêter proprement en conservant l'actif. Pour chacune, ce qu'elle suppose et ce qu'elle coûte.

Ajoute une section "les arguments que je me donnerai pour ne pas respecter ce seuil", et réponds-y par avance. Anticipe notamment : "le SEO met plus de temps", "il manque juste une fonctionnalité", "je viens de trouver un nouveau canal", "les chiffres remontent depuis un mois".

Consigne aussi le coût d'opportunité : plus de vingt heures par semaine sur dix-huit mois représentent environ mille cinq cents heures pour un objectif de deux mille euros par mois. C'est la donnée qui manque à la décision, elle doit figurer dans le document.

Termine par un tableau de suivi mensuel à remplir : mois, visiteurs organiques, inscriptions gratuites, clients payants, revenu mensuel récurrent, réponses de partenaires. Ne modifie aucun autre fichier.
```

---

### E8-4 · Tenir le journal des leçons

**Résultat** — `tasks/lessons.md` reste vivant et utilisable. C'est le seul artefact du dépôt qui empêche de recommencer les mêmes erreurs, et il contient déjà des leçons remarquables.
**Zones** — `tasks/lessons.md`, `CLAUDE.md`.
**Fin quand** — le fichier est structuré, consultable par thème, et son usage est inscrit dans le flux de travail. **Charge S.**

**`/model sonnet` · `/effort medium`** — réorganisation documentaire sur un contenu qui existe. Aucun arbitrage. Sonnet 5, prix d'introduction. `medium`.

```text
/model sonnet
/effort medium
Structure tasks/lessons.md pour qu'il reste utilisable à mesure qu'il grossit. C'est le seul artefact du dépôt qui empêche de recommencer les mêmes erreurs, et il contient déjà des leçons remarquables — par exemple qu'une consigne écrite dans la documentation n'est pas un garde-fou, ou qu'un contrôle portant sur un objet omniprésent ne contrôle rien.

Travail à faire.
1. Relis le fichier en entier et regroupe les leçons par thème plutôt que par ordre chronologique. Propose la taxonomie à partir de ce que tu lis, ne l'impose pas d'avance. Conserve la date et le contexte d'origine de chaque leçon.
2. Ajoute en tête un sommaire et, pour chaque leçon, une formulation d'une ligne qui peut se lire seule. Une leçon qu'il faut lire en entier pour comprendre ne sera pas relue.
3. Élimine les doublons et les leçons devenues sans objet parce que le code concerné a été supprimé, en signalant ce que tu retires.
4. Ajoute une section "leçons de produit", distincte des leçons techniques, et ouvre-la avec la plus importante de toutes : un plan dont l'étape finale est incompatible avec le tempérament de celui qui l'exécute produit un backlog qui se régénère indéfiniment.
5. Vérifie que CLAUDE.md renvoie bien à ce fichier et décrit quand l'alimenter.

Ne réécris pas le contenu des leçons : réorganise, résume en tête, et conserve le texte d'origine.
```

---

## E9 — Après le verdict, et seulement sur données

*Conditionnel. Rien ici ne démarre avant que l'épic E8 ait rendu un chiffre.*

---

### E9-1 · Élargir le périmètre chiffrable

**Résultat** — un huitième ouvrage, puis un neuvième. C'est le seul chemin qui rouvre un tarif plus élevé et le segment généraliste, et il ne se décide que sur des demandes réelles.
**Zones** — registre matériaux, `work-types.data.ts`, moteur.
**Fin quand** — l'ouvrage ajouté produit une liste achetable, sourcée, et validée par le même harnais que les sept autres. **Charge L.**

**`/model fable` · `/effort high`** — même profil qu'E1-10 : recherche ouverte, curation de données sourcées, jugement métier sur ce qui appartient à un ouvrage. C'est le type de tâche pour lequel Fable 5 est documenté. `high`, son défaut.

```text
/model fable
/effort high
Ajoute un huitième type d'ouvrage à Chiffréo. NE COMMENCE PAS avant de m'avoir dit lequel et pourquoi.

Première étape, obligatoire : détermine quel ouvrage ajouter, à partir des DONNÉES et non d'une intuition. Regarde ce que les utilisateurs ont réellement demandé — recherches internes infructueuses, retours de clôture de chantier, demandes reçues, requêtes du corpus SEO qui amènent du trafic sur un ouvrage non couvert. Croise avec la taille du métier concerné en France et avec la faisabilité : un ouvrage n'est ajoutable que si ses rendements sont sourçables auprès de fiches fabricants librement consultables. Candidats plausibles à évaluer sans t'y limiter : ratissage et enduit de lissage, ravalement et peinture de façade, isolation thermique par l'intérieur, chape et ragréage, pose de sol souple en lés, faux plafond.

Seconde étape, après ma validation : ajoute-le en suivant exactement la méthode des sept ouvrages existants. Détermine son assiette — dérivée de la pièce, ou saisie comme la cloison. Établis la liste des matériaux avec leur rôle, leur rendement sourcé, leurs conditionnements commerciaux réels. Établis les facteurs de perte par pose et par niveau, sans laisser de trou. Établis les temps de pose, sur le modèle d'E2-1. Détermine les paramètres qui changent le résultat et fais-les agir — la règle du dépôt est que toute question posée doit changer une quantité.

Étends le harnais de snapshots à ce nouvel ouvrage sur les trois géométries de test, et vérifie que les six invariants métier passent.

Si un rendement n'est pas sourçable, n'invente pas : écarte le matériau et écris pourquoi dans docs/SOURCES_CATALOGUE.md.

Vérifie : pnpm test:api, le harnais complet, sources-catalogue.spec.ts, les migrations up et down, pnpm lint.
```

---

### E9-2 · Ouvrir le moteur à un partenaire

**Résultat** — si un négoce ou un fabricant a donné suite, le moteur devient consommable de l'extérieur, avec leur catalogue et leurs références. Cette tâche ne se déclenche que sur un contrat, jamais sur une hypothèse.
**Zones** — nouveau module d'API partenaire, `apps/api/src/materials/`.
**Fin quand** — un partenaire réel appelle le moteur en production et obtient une liste d'achat dans ses propres références. **Charge L.**

**`/model opus` · `/effort xhigh`** — API exposée à un tiers, donc authentification, quotas, versionnement et isolation des données : sécurité, règle numéro 1. Le dépôt a déjà supprimé une API à clés construite pour personne ; celle-ci ne se construit que contre un contrat signé, et doit être conçue à partir des besoins réels du partenaire. `xhigh` : conception, sécurité, vérification longue.

```text
/model opus
/effort xhigh
NE COMMENCE PAS cette tâche sans un partenaire réel qui a signé ou s'est engagé par écrit. Si ce n'est pas le cas, dis-le-moi et arrête-toi : le dépôt a déjà construit et supprimé une API publique à clés faite pour personne, et refaire la même erreur serait la troisième occurrence du même mode de défaillance.

Si un partenaire existe, ouvre le moteur de chiffrage à une consommation externe.

Commence en plan mode par une conception fondée sur le besoin RÉEL du partenaire, pas sur une API générique : que veut-il exactement, appelée depuis où, avec quelles données en entrée, et que doit-elle rendre ? Une intégration de négoce veut probablement une liste d'achat dans SES références et à SES prix, appelée depuis son site ou son application, et se terminant par un panier. Un fabricant veut probablement un calculateur restreint à ses propres produits.

Points à traiter, chacun explicitement.
1. Correspondance entre notre registre matériaux et le catalogue du partenaire : c'est le vrai travail, et il est plus difficile que l'API elle-même. Comment associer "mortier-colle flexible C2" à leur référence ? Que faire quand aucune correspondance n'existe ? Propose une stratégie et son mécanisme de contrôle.
2. Authentification et quotas. Clés par partenaire, rotation, limitation de débit, journalisation. Sécurité critique.
3. Versionnement. Une fois qu'un tiers dépend du format de sortie, tu ne peux plus le changer librement. Pose une politique de version dès le premier jour.
4. Isolation. Aucune donnée d'un utilisateur de Chiffréo ne doit être accessible par cette voie, jamais.
5. Contrat de service : que promet-on sur la disponibilité, et l'hébergement actuel à instance unique le permet-il ? Sois honnête sur ce point, y compris si la réponse est non.

Documente l'API pour un intégrateur externe, avec des exemples appelables.

Vérifie : pnpm test:api, pnpm test:api:integration, tests de sécurité et de quotas, pnpm lint, et fais-moi une revue de sécurité écrite avant toute mise en production.
```

---

### E9-3 · Instruire la réouverture de la vision par ordinateur

**Résultat** — la décision D2 est réexaminée sur des mesures, pas sur une envie. La condition écrite avant collecte : cinquante à cent photos réelles, dimensions relevées au télémètre, erreur médiane sous cinq pour cent.
**Zones** — `apps/cv-service/`, ADR 0001 §5.2.
**Fin quand** — la mesure est faite et la décision est écrite, quelle qu'elle soit. **Charge L.**

**`/model opus` · `/effort xhigh`** — évaluation quantitative d'un système de vision, plus un arbitrage juridique sur une dépendance sous licence AGPL, plus une comparaison honnête à des solutions natives qui atteignent un ou deux pour cent d'erreur pour un coût serveur nul. Correctness et droit : règle numéro 1. `xhigh` : mesure, analyse, décision, sur un horizon long.

```text
/model opus
/effort xhigh
Instruis la réouverture de la vision par ordinateur, décision D2 de l'ADR 0001. Applique la condition écrite AVANT collecte, sans l'assouplir.

La condition, telle qu'elle est écrite : cinquante à cent photos réelles de pièces, avec les dimensions relevées au télémètre comme référence, et une erreur médiane sous cinq pour cent. Plus quatre conditions cumulatives : une comparaison honnête aux solutions natives ARKit et ARCore, qui donnent un à deux pour cent d'erreur pour un coût serveur nul ; un arbitrage juridique sur la dépendance ultralytics, sous licence AGPL-3.0, jamais tranché ; un score de confiance qui mesure la JUSTESSE et non la cohérence interne ; et un budget mémoire tenable — le service réservait quatre gigaoctets, soit la moitié du serveur, pour une analyse simultanée.

Ce que tu dois faire.
1. Établis le protocole de mesure : comment constituer le jeu de photos, comment relever les références, comment calculer l'erreur médiane par dimension et par surface. Écris-le avant de mesurer.
2. Rappelle les défauts déjà mesurés, qui restent à corriger avant toute mesure honnête : avec une porte apparaissant vingt à trente pour cent plus petite que le plan de calibration — c'est-à-dire une porte au fond d'une pièce, le cas nominal — l'erreur sur chaque dimension atteint vingt-quatre à quarante-deux pour cent ; une armoire sans porte est acceptée comme porte de référence ; le score de confiance ne bouge quasiment pas entre zéro virgule quatre et vingt-quatre pour cent d'erreur ; et le calcul de longueur multiplie un rapport sans dimension par une hauteur en pixels, ce qui n'est pas homogène physiquement.
3. Tranche la question AGPL avant toute autre chose. Si la conclusion est que la dépendance est incompatible avec une distribution en logiciel de service propriétaire, la mesure est sans objet et il faut soit changer de modèle, soit fermer définitivement. Ne fais pas la mesure avant cet arbitrage.
4. Compare honnêtement à ARKit et ARCore, qui font le travail sur l'appareil pour un coût serveur nul. Si la comparaison est défavorable — c'est mon hypothèse — dis-le clairement, même si cela invalide des mois de travail.

Écris la décision dans l'ADR, quelle qu'elle soit, avec ses mesures. Une réouverture non fondée sur ces critères est un retour au mode de défaillance que ce projet a déjà connu deux fois.
```

---

### E9-4 · Arrêter proprement, si c'est l'issue

**Résultat** — si le verdict est négatif, le projet s'arrête sans perte : données restituées aux utilisateurs, abonnements clos honnêtement, actif conservé et présentable.
**Zones** — tout le dépôt, `docs/`.
**Fin quand** — aucun utilisateur n'est lésé, aucune obligation ne subsiste, et le moteur reste exploitable ailleurs. **Charge M.**

**`/model opus` · `/effort high`** — arrêter un service qui détient des factures légalement numérotées et des données personnelles engage des obligations : conservation, restitution, information des abonnés, remboursement au prorata. Une erreur ici est une erreur de droit. Opus 5. `high`.

```text
/model opus
/effort high
NE LANCE CETTE TÂCHE que si docs/VERDICT.md a rendu un verdict négatif. Sinon, arrête-toi.

Prépare l'arrêt propre de Chiffréo, sans qu'aucun utilisateur ne soit lésé et sans que l'actif soit perdu.

Volet UTILISATEURS, par ordre d'obligation.
1. Les factures émises par nos clients ont une valeur légale et une numérotation continue. Détermine ce que nous devons conserver, combien de temps, et sous quelle forme, et comment le restituer à chaque utilisateur dans un format exploitable et durable, pas dans un export propriétaire.
2. L'export de données personnelles existe déjà : vérifie qu'il couvre TOUT ce qu'un utilisateur voudra emporter — chantiers, listes, devis, factures, clients, prix. Complète-le si nécessaire.
3. Les abonnements annuels en cours : détermine ce qui est dû. Un remboursement au prorata est probablement l'obligation, en plus d'être la bonne conduite. Vérifie ce que disent nos CGV et ce que dit le droit, et signale-moi tout écart.
4. Rédige le message d'annonce aux utilisateurs : la date d'arrêt, un préavis suffisant, ce qu'ils doivent faire, comment récupérer leurs données, ce qu'ils sont remboursés. Écris-le honnêtement, sans jargon et sans excuse défensive.

Volet ACTIF.
5. Le moteur de chiffrage, le registre sourcé et le harnais de tests gardent de la valeur indépendamment du produit. Prépare-les pour être présentés ou cédés : documentation d'entrée, découplage de ce qui est spécifique au produit, licence à décider.
6. Écris docs/POST_MORTEM.md : ce qui a été construit, ce qui a marché, ce qui n'a pas marché, et pourquoi. Sans complaisance et sans autoflagellation — c'est le document qui a de la valeur pour le prochain projet.

Volet TECHNIQUE.
7. La procédure d'extinction : ordre d'arrêt des services, conservation des sauvegardes et durée, résiliation des abonnements techniques, fermeture du compte Stripe, sort du nom de domaine.

Vérifie : l'export de données produit un fichier exploitable pour un compte de test complet, et déroule à blanc la procédure d'extinction.
```

---

# Partie C — Vue d'ensemble

## C.1 Répartition des modèles

**59 tâches, 59 commandes.**

| Modèle | Tâches | Part | Où, et pourquoi |
|---|---|---|---|
| **Opus 5** (`opus`) | 31 | 53 % | Moteur de calcul, schéma, migrations, sécurité, argent, droit, suppression de code, décisions structurantes. Là où une erreur coûte de l'argent, du droit ou de la confiance — et là où la coupure de mai 2026, la plus récente du lineup, compte pour les idiomes de Next.js 16, React 19 et NestJS 11. |
| **Sonnet 5** (`sonnet`) | 17 | 29 % | Frontend, contenu, SEO, annuaires, tests, supervision, documentation — tout ce qui est spécifiable à l'avance. Prix d'introduction 2/10 $ jusqu'au 31 août 2026. |
| **Fable 5** (`fable`) | 6 | 10 % | E0-5, E0-7, E1-10, E2-1, E7-2, E9-1 : les seules tâches plus grandes qu'une session, ambiguës, à forte composante de recherche autonome et de curation — la définition officielle du modèle. |
| **Haiku 4.5** (`haiku`) | 3 | 5 % | E0-1, E4-6, E6-2 : normalisation de fins de ligne, vérification de YAML et d'environnement, checklist de configuration Stripe. Rien qui touche à un framework postérieur à février 2025. |
| **`opusplan`** | 2 | 3 % | E1-2 et E1-11 : la difficulté est dans la conception, le volume dans l'exécution. Conception au prix d'Opus, frappe au prix de Sonnet. |

La part élevée d'Opus 5 n'est pas une facilité : elle vient de ce que ce backlog est dominé par le moteur de calcul, les migrations de schéma, les suppressions en cascade et le droit — quatre familles où la règle numéro 1 s'applique. Les épics E6 et E7, une fois la mise en ligne faite, basculent majoritairement sur Sonnet 5.

## C.2 Répartition des efforts

| Niveau | Tâches | Lecture |
|---|---|---|
| `high` | 34 | Le régime normal, conforme au défaut officiel de tous les modèles concernés. |
| `xhigh` | 18 | Toutes multi-fichiers avec migration, sécurité, argent ou recherche longue — la définition officielle du niveau : *« travail long-horizon, 30 minutes et plus »*. |
| `medium` | 4 | E0-2, E3-4, E4-5, E8-4 : éditions et réorganisations sur périmètre déjà décidé. |
| non applicable | 3 | Les trois tâches Haiku : le modèle ne supporte pas le paramètre, et le demander ferait retomber silencieusement sur autre chose. |
| `max` | **0** | La documentation avertit d'un coût significatif pour des gains faibles et d'une propension à sur-réfléchir. Aucune tâche ici ne le justifie. |
| `low` | **0** | Trop risqué sur un dépôt dont 1 500 tests n'ont pas vu un défaut d'ordre de grandeur. |

`ultracode` est proposé **en option** sur deux tâches — E1-10 (curation du registre, sept branches indépendantes) et E7-2 (production du corpus, parallélisable par thème). Il envoie `xhigh` et fait orchestrer des workflows multi-agents ; il est session-only et demande Claude Code ≥ v2.1.203.

## C.3 Deux remarques de calendrier

**Sonnet 5 est à 2/10 $ par million de tokens jusqu'au 31 août 2026**, puis 3/15 $. Les 23 tâches Sonnet — la quasi-totalité d'E3, E6 et E7 — coûteront 50 % de plus en septembre. Si le budget de tokens est un sujet, c'est une raison concrète de regrouper ce mois-ci celles qui ne dépendent pas d'E1.

**Opus 5 exige Claude Code ≥ v2.1.219.** Vérifiez avec `claude --version` avant de commencer. Sur une version antérieure, `/model opus` sélectionne silencieusement Opus 4.8, dont la posture d'effort recommandée est différente — et toutes les recommandations de ce document deviennent inadaptées.

## C.4 Ordre d'exécution

```
E0 · 8 tâches · ~2 sem.        ◄── AUCUN code produit avant la fin d'E0
  │
  ├─► E1 · 12 tâches · ~7-9 sem.   ◄── la seule épic non négociable
  │     └─► E2 · 5 tâches · ~3 sem.
  │
  ├─► E3 · 7 tâches · ~3 sem.      [parallélisable avec E1]
  │     └─► E4 · 6 tâches · ~2 sem.
  │           └─► E5 · 5 tâches · ~3 sem.
  │                 └─► E6 · 3 tâches · ~1 sem.   ◄── MISE EN LIGNE
  │                       ├─► E7 · 5 tâches · continu
  │                       └─► E8 · 4 tâches · continu
  │                             └─► E9 · 4 tâches · conditionnel, sur verdict
```

Chemin critique jusqu'à la mise en ligne : **E0 → E1 → E2 → E5 → E6**. E3 et E4 se mènent en parallèle d'E1, parce qu'ils ne touchent ni au moteur ni au devis. À plus de 20 h par semaine, cela place la mise en ligne **début décembre 2026**.

**Deux règles opposables, à afficher.** Aucun commit `feat(...)` hors E1 à E6 avant que l'application soit en ligne et qu'un paiement réel soit passé. Et E0-5 — l'instruction d'ArtisanSmart — conditionne le démarrage d'E1 : si le concurrent fait déjà ce que nous voulons faire, avec des sources, neuf semaines de moteur ne se justifient plus de la même façon.

---

# Partie D — Sources

Modèles, alias, prix et niveaux d'effort **vérifiés le 6 août 2026** sur :

- [Models overview — Claude Platform](https://platform.claude.com/docs/en/about-claude/models/overview) — identifiants, fenêtres de contexte, sorties maximales, coupures de connaissances, conseil de choix par défaut
- [Introducing Claude Fable 5 and Claude Mythos 5 — Claude Platform](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5) — positionnement de Fable 5, accès restreint de Mythos 5 via Project Glasswing, rétention de 30 jours, thinking toujours actif
- [Pricing — Claude Platform](https://platform.claude.com/docs/en/about-claude/pricing) — tarifs par million de tokens, prix d'introduction Sonnet 5 jusqu'au 31 août 2026, multiplicateurs de cache, tarifs Batch
- [Effort — Claude Platform](https://platform.claude.com/docs/en/build-with-claude/effort) — les cinq niveaux, modèles supportant le paramètre, recommandations par modèle, avertissement sur `max`, définition de `xhigh` comme travail long-horizon
- [Model configuration — Claude Code](https://code.claude.com/docs/en/model-config) — alias `opus`/`sonnet`/`haiku`/`fable`/`opusplan`, variantes `[1m]`, résolution par fournisseur et versions minimales, `/effort`, `ultracode`, sémantique de `ultrathink`, repli sur le niveau supporté
- [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code) — diagnostic « modèle ou effort ? »

Faits produit et marché : `CHIFFREO_REFONTE.md`, lui-même sourcé et soumis à contre-expertise. Faits dépôt : lecture de `HEAD` (fb5009d) le 6 août 2026.