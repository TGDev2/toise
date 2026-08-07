# Chiffréo — Backlog V1 : publier, se différencier, encaisser

> Suite de [REPRISE_PROJET.md](REPRISE_PROJET.md). Périmètre : la V1 « chiffrage juste des ouvrages de finition » pour l'artisan de finition.
> Chaque tâche porte : résultat attendu, zones du dépôt, critère de fin vérifiable, charge humaine, **modèle Claude**, **niveau d'effort**, **commande exacte**.
> Modèles et réglages vérifiés sur la documentation officielle le 3 août 2026 (sources en fin de document).

---

## Partie A — Comment lire les recommandations de modèle

### A.1 Ce qui a changé depuis votre `docs/MODELES_CLAUDE.md`

Ce fichier date de juin 2026 et **trois de ses affirmations sont aujourd'hui fausses**. Il faut le corriger avant de s'en servir (tâche E0-4).

| Affirmation du fichier | Réalité vérifiée le 3 août 2026 |
|---|---|
| « `/model opus` → Opus 4.8 » | L'alias `opus` résout vers **Opus 5** sur l'API Anthropic (depuis Claude Code v2.1.219). Opus 4.8 reste accessible en nom complet. |
| « L'effort par défaut est `high`… la doc recommande `xhigh` pour le codage » | Cette consigne était celle d'**Opus 4.7/4.8**. Pour **Opus 5**, la consigne officielle est : *« Start with `high` (default), adjust based on evals »*, `xhigh` étant réservé au *« demanding coding and agentic work »*. Mettre tout le backlog en `xhigh` fait payer un surcoût de tokens sans justification. |
| « Fable 5 · contexte 1M · à escalader si Opus cale » | Exact sur le contexte. Mais Fable 5 n'est pas une escalade générique : la doc le décrit comme adapté aux *« tasks larger than a single sitting »*, aux problèmes ambigus, aux investigations de cause racine et aux décisions d'architecture. L'utiliser sur une tâche bien spécifiée, c'est payer $10/$50 par MTok pour rien. |

### A.2 Le catalogue réel (3 août 2026)

| Modèle | Alias Claude Code | Contexte / sortie | Prix $/MTok (in–out) | Positionnement officiel | Limites |
|---|---|---|---|---|---|
| **Fable 5** | `fable` | 1M / 128k | 10 – 50 | Le plus capable ; agents longue durée, tâches plus grandes qu'une session | Latence élevée ; raisonnement adaptatif toujours actif ; indisponible en zero-data-retention ; repli automatique sur classificateurs (cyber/bio) |
| **Opus 5** | `opus` | 1M / 128k | 5 – 25 | **Point de départ recommandé.** Codage agentique complexe, refactoring à grande échelle, ingénierie système | Plus cher que Sonnet ; sur Opus 5, baisser l'effort ne raccourcit pas fiablement les réponses — le demander dans le prompt |
| **Sonnet 5** | `sonnet` | 1M / 128k | 3 – 15 · **2 – 10 jusqu'au 31 août 2026** | Meilleur rapport vitesse/intelligence ; performances « proches d'Opus 4.8 à prix inférieur » | Moins capable qu'Opus 5 en raisonnement complexe ; **nouveau tokenizer : 1,0 à 1,35× plus de tokens pour le même texte** |
| **Haiku 4.5** | `haiku` | **200k / 64k** | 1 – 5 | Le plus rapide ; volume, sous-agents, tâches simples | **Ne supporte pas le paramètre `effort`** ; pas de raisonnement adaptatif ; **coupure de connaissances fiable février 2025** |

Alias composites utiles ici :
- **`opusplan`** — Opus pendant le plan mode, puis bascule sur Sonnet pour l'exécution. Le meilleur compromis coût/qualité sur les tâches multi-fichiers dont la difficulté est dans la conception, pas dans la frappe.
- **`opus[1m]` / `sonnet[1m]`** — fenêtre 1M explicite. Sans effet sur Sonnet 5 et Opus 5 qui l'ont nativement.

### A.3 Les niveaux d'effort

| Niveau | Usage officiel | Emploi dans ce backlog |
|---|---|---|
| `low` | Tâches courtes, cadrées, non sensibles à l'intelligence | jamais — trop risqué sur ce dépôt |
| `medium` | Économie de tokens sur travail moins exigeant | édition mécanique, contenu, config |
| `high` | **Défaut sur tous les modèles.** Raisonnement complexe, codage difficile | le régime normal — ~60 % des tâches |
| `xhigh` | *« Extended capability for long-horizon work (30+ minutes) »*, codage et agentique exigeants, appels d'outils répétés | ~30 % — moteur, migrations, sécurité, argent |
| `max` | Capacité maximale sans contrainte de tokens | **zéro tâche.** La doc avertit : coût significatif pour un gain qualité faible, et propension à sur-réfléchir. Rien dans ce backlog ne le justifie. |
| `ultracode` | Réglage Claude Code : `xhigh` + orchestration de workflows dynamiques. Session uniquement | proposé en option sur **une seule** tâche (E1-3), là où la parallélisation a un sens |

Deux compléments vérifiés :
- **`ultrathink`** dans le prompt demande un raisonnement plus profond **sur ce tour seulement**, sans changer l'effort envoyé à l'API. Utile ponctuellement ; ne remplace pas `/effort`.
- `max` et `ultracode` sont **session-only** : ils ne se persistent pas dans les settings.

### A.4 La règle de sélection appliquée ici

Trois questions, dans cet ordre :

1. **Une erreur coûte-t-elle de l'argent, du droit ou de la confiance ?** (calcul de quantités, migration de schéma, Stripe, RGPD, isolation multi-tenant) → **Opus 5**. Ne jamais descendre pour économiser.
2. **La tâche est-elle spécifiable précisément à l'avance ?** → **Sonnet 5**. C'est la majorité du frontend, du contenu, du SEO et des tests. Et jusqu'au **31 août 2026** son prix d'introduction ($2/$10) le met à 40 % du prix d'Opus 5 — il y a une raison de calendrier à concentrer ces tâches ce mois-ci.
3. **La tâche est-elle purement mécanique, sans idiome de framework récent ?** → **Haiku 4.5**. Attention : sa coupure de connaissances fiable est **février 2025**, or ce dépôt tourne sur Next.js 16, React 19, Tailwind 4 et NestJS 11 — tous postérieurs. Haiku n'est employé ici que sur du YAML, du `.env` et du markdown.

Et le diagnostic officiel quand un résultat déçoit : *« Did it not try hard enough, or did it not know enough ? »* — s'il a sauté un fichier ou n'a pas lancé les tests, **montez l'effort** ; s'il a vraiment essayé et s'est trompé, **montez le modèle**.

### A.5 Format des commandes

Chaque commande se colle telle quelle dans une session Claude Code :

```text
/model <alias>
/effort <niveau>
<prompt>
```

Notes d'usage : `/model` sur une conversation déjà entamée demande confirmation (l'historique est relu sans cache) ; il est donc préférable d'ouvrir une session par tâche. `/effort` en mode non interactif (`-p`) ne vaut que pour la session. Pour Haiku, **la ligne `/effort` est omise** : le modèle ne supporte pas le paramètre.

---

## Partie B — Le backlog

Charge = charge humaine de pilotage et de relecture, pas temps machine. **S** ≤ ½ j · **M** 1–2 j · **L** 3–5 j.

---

## E0 — Arbitrages et remise à niveau du dépôt

*Aucune ligne de produit. Ces quatre tâches empêchent la prochaine session de reconstruire des épics au lieu de réparer le moteur.*

---

### E0-1 · Remettre la documentation à l'état réel

**Résultat** — `docs/PRODUCT_STRATEGY.md`, `docs/BACKLOG.md` et `tasks/todo.md` (5 012 lignes) décrivent un produit lancé et mature. Ils sont archivés sous `docs/archive/` et remplacés par ce backlog + le document de reprise. `CLAUDE.md` gagne une section « périmètre V1 » et une règle : aucune nouvelle fonctionnalité hors backlog V1.
**Zones** — `docs/`, `tasks/`, `CLAUDE.md`, `README.md`.
**Fin quand** — un nouvel arrivant (humain ou agent) qui lit `README.md` puis `CLAUDE.md` ne peut plus croire que le produit est en production. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — réorganisation de fichiers et réécriture de prose à partir d'un état des lieux déjà rédigé. Aucune décision produit à prendre, aucun code touché : la tâche est entièrement spécifiable, ce qui est le domaine de Sonnet 5. `medium` parce que la doc officielle le décrit comme l'économie de tokens sur du travail qui peut céder un peu d'intelligence — c'est exactement le cas.

```text
/model sonnet
/effort medium
Remets la documentation du dépôt à l'état réel du produit. 1) Crée docs/archive/ et y déplace PRODUCT_STRATEGY.md, BACKLOG.md et tasks/todo.md en préfixant chacun d'un encadré "ARCHIVE — décrit un produit non lancé, conservé pour l'historique, ne pas utiliser comme source". 2) docs/REPRISE_PROJET.md et docs/BACKLOG_V1.md deviennent les deux seules sources de vérité produit : mets à jour tous les liens du README et des docs restants. 3) Réécris la section Documentation du README pour ne lister que ce qui est à jour, et retire du README toute mention de fonctionnalité non atteignable depuis la navigation (analyse CV, widget, API publique, SSO). 4) Ajoute dans CLAUDE.md une section "Périmètre V1" qui énonce : le périmètre est fixé par docs/BACKLOG_V1.md, aucune fonctionnalité hors de ce fichier ne doit être implémentée sans mise à jour explicite du fichier. Ne touche à aucun fichier de code.
```

---

### E0-2 · Consigner la décision de cible dans un ADR

**Résultat** — un ADR unique fige : cible = artisan de finition ; le particulier reste surface d'acquisition sans monétisation ; la CV sort du périmètre avec sa condition de retour chiffrée ; widget/API/SSO gelés puis supprimés.
**Zones** — `docs/adr/0001-cible-et-perimetre-v1.md` (à créer).

> **Livré, puis amendé le 7 août 2026.** L'[ADR 0002](adr/0002-modele-economique-facturation-distribution.md) confirme D1 et D2, étend D3 (les organisations et le multi-utilisateurs rejoignent les suppressions), **révise D4** (chiffrage gratuit et illimité ; conformité à 279 €/an) et ajoute **D5** (facturation électronique) et **D6** (canal B2B2C). Le prompt d'origine ci-dessous est conservé tel quel — il dit ce qui a été demandé le 3 août, pas ce qui fait foi aujourd'hui.
**Fin quand** — chaque décision de l'ADR porte sa conséquence de périmètre et son critère de réouverture. **Charge S.**

**Modèle : `opus` · Effort : `high`** — un ADR est un exercice de raisonnement et d'arbitrage, pas de rédaction : il doit tenir des conséquences ensemble (une cible implique un tarif, qui implique un périmètre chiffrable, qui implique des ouvrages). C'est du « raisonnement complexe, analyse nuancée » — la définition officielle de `high`. Opus 5 plutôt que Sonnet parce que la qualité de l'arbitrage conditionne tout le reste du backlog et qu'une erreur ici ne se voit qu'après des semaines.

```text
/model opus
/effort high
Lis docs/REPRISE_PROJET.md, puis rédige docs/adr/0001-cible-et-perimetre-v1.md au format ADR (Contexte / Décision / Conséquences / Alternatives écartées / Critères de réouverture). Décisions à consigner : (1) cible V1 = artisan des métiers de finition (peintre, carreleur, plaquiste, solier) ; le particulier reste une surface d'acquisition non monétisée ; (2) le service de vision par ordinateur sort du périmètre V1, condition de réouverture = erreur médiane < 5% sur 50-100 photos réelles mesurées au télémètre ; (3) widget marque blanche, API publique à clés et SSO/Enterprise sont gelés puis supprimés après la V1 s'ils ne sont pas demandés ; (4) un seul palier payant à 19 EUR/mois en V1. Pour chaque décision, écris la conséquence concrète sur le périmètre et ce qui la ferait réviser. Confronte explicitement l'alternative "cibler le particulier" et dis pourquoi elle est écartée. N'écris aucun code.
```

---

### E0-3 · Geler les surfaces hors périmètre par les feature gates

**Résultat** — les gates `public_api`, `enterprise_sso`, `multi_user`, `cv_analysis`, `cost_benchmark`, `eco_materials`, `site_tracking`, `quote_reminders` sont désactivées en base par migration réversible, et le miroir `feature-gates-catalogue.ts` est mis à jour dans le même lot.
**Zones** — `apps/api/src/migrations/`, `apps/web/src/lib/feature-gates-catalogue.ts`, `apps/web/src/__tests__/offer-catalogue.spec.ts`.
**Fin quand** — la suite `offer-catalogue.spec.ts` passe et plus aucune surface publique n'annonce une gate désactivée. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — une migration touche l'état de production et doit être réversible ; le test `offer-catalogue.spec.ts` fait le lien entre base, miroir front et pages marketing, donc l'agent doit tenir quatre fichiers cohérents en même temps. C'est du travail agentique multi-fichiers avec appels d'outils répétés — le cas d'usage explicite de `xhigh`.

```text
/model opus
/effort xhigh
Gèle les fonctionnalités hors périmètre V1 par feature gate, sans supprimer de code. 1) Crée une migration TypeORM réversible qui met is_enabled=false sur les gates public_api, enterprise_sso, multi_user, cv_analysis, cost_benchmark, eco_materials, site_tracking et quote_reminders, en conservant les lignes (le down() doit restaurer l'état exact). 2) Mets à jour le miroir apps/web/src/lib/feature-gates-catalogue.ts dans le même lot, comme l'exige la règle du dépôt. 3) Retire de apps/web/src/lib/pricing.ts toute ligne d'offre adossée à une de ces gates, et de calculators.ts tout différenciateur qui en dépend. 4) Fais passer apps/web/src/__tests__/offer-catalogue.spec.ts sans jamais l'affaiblir : si une assertion échoue, c'est le catalogue d'offre qu'il faut corriger, pas le test. Vérifie : migration up puis down sur une base locale, pnpm test:api, pnpm test:web, pnpm lint.
```

---

### E0-4 · Corriger `docs/MODELES_CLAUDE.md`

**Résultat** — le fichier reflète le catalogue du 3 août 2026 : `opus` → Opus 5 ; effort par défaut `high` sur Opus 5 avec `xhigh` réservé au codage exigeant ; Haiku 4.5 sans paramètre d'effort et coupure février 2025 ; prix d'introduction Sonnet 5 jusqu'au 31 août 2026.
**Zones** — `docs/MODELES_CLAUDE.md`.
**Fin quand** — chaque affirmation du fichier porte sa source et sa date de vérification. **Charge S.**

**Modèle : `sonnet` · Effort : `high`** — la tâche exige d'aller lire des pages de documentation en ligne et d'en extraire des faits exacts sans les inventer. Sonnet 5 est explicitement positionné sur la recherche agentique (résultats BrowseComp cités à son lancement) et la tâche est mécaniquement spécifiable. `high` et non `medium` parce que la valeur du livrable est sa justesse factuelle : c'est le cas où « la qualité compte plus que le coût ».

```text
/model sonnet
/effort high
Le fichier docs/MODELES_CLAUDE.md date de juin 2026 et contient des informations périmées. Va lire les pages officielles https://code.claude.com/docs/en/model-config, https://platform.claude.com/docs/en/about-claude/models/overview, https://platform.claude.com/docs/en/build-with-claude/effort et https://platform.claude.com/docs/en/about-claude/pricing, puis réécris entièrement les sections 1, 2 et 3 du fichier à partir de ce que tu y lis. Points à corriger en priorité : l'alias opus résout désormais vers Opus 5 et non Opus 4.8 ; la consigne "xhigh pour le codage" venait d'Opus 4.7/4.8 alors qu'Opus 5 recommande de partir de high ; Haiku 4.5 ne supporte pas le paramètre effort et a une coupure de connaissances fiable en février 2025 ; Sonnet 5 utilise un tokenizer qui produit 1,0 à 1,35x plus de tokens et bénéficie d'un prix d'introduction jusqu'au 31 août 2026. Ne conserve aucune affirmation que tu n'as pas vérifiée sur ces pages, et fais suivre chaque tableau d'une ligne "vérifié le <date> sur <URL>". Ne touche pas à la section 4 (recommandations par tâche) : elle sera remplacée par docs/BACKLOG_V1.md.
```

---

## E1 — Le moteur : rendre la liste d'achat juste

*L'épic non négociable. Tant qu'elle n'est pas finie, tout le reste chiffre du vide.*

---

### E1-1 · Écrire le test rouge sur le catalogue réel

**Résultat** — un test qui construit les matériaux depuis le seed réel et échoue aujourd'hui sur quatre assertions : nombre de lignes, unités totales, accessoires multipliés par les couches, conditionnement choisi.
**Zones** — `apps/api/src/estimations/__tests__/` (à créer), seed `1711468800006`.
**Fin quand** — le test échoue avec un message qui nomme les quatre défauts. Un test rouge qui échoue pour la bonne raison est le livrable. **Charge S.**

**Modèle : `opus` · Effort : `high`** — écrire un test qui échoue pour la bonne raison suppose de comprendre d'abord pourquoi le code produit ce qu'il produit ; c'est un exercice de raisonnement sur du code existant, pas de génération. Opus 5 parce que ce test devient le contrat de toute l'épic : s'il est mal posé, on « répare » le moteur sans le réparer. `high` suffit — le périmètre est un seul fichier et la cible est connue.

```text
/model opus
/effort high
Crée un test unitaire qui exécute le moteur d'estimation sur le catalogue RÉELLEMENT seedé, et non sur un mock. Importe les tableaux de matériaux depuis apps/api/src/migrations/1711468800006-SeedMaterialsCatalog.ts (extrais-les dans un module partagé si nécessaire, sans changer le comportement de la migration). Cas de test : ouvrage wall_painting, pièce 400x300x250 cm, une ouverture 83x204, niveau intermediate, pose standard. Assertions attendues : le nombre de lignes générées est inférieur ou égal à 6 ; le total d'unités à acheter est inférieur ou égal à 15 ; aucune ligne dont le nom contient Pinceau, Rouleau ou Bâche n'a units_needed supérieur à 5 ; la ligne "Peinture acrylique mate" (6,66 L ajustés) donne 1 pot de 5 L plus 1 pot de 2,5 L. Le test DOIT échouer sur les quatre assertions dans l'état actuel du code : ne corrige rien, ne contourne rien. Termine en me montrant la sortie d'échec et en expliquant, pour chaque assertion, quelle ligne de code produit la valeur observée.
```

---

### E1-2 · Lier les ouvrages aux matériaux

**Résultat** — un ouvrage ne charge plus toute sa catégorie. `work_types.required_materials` est peuplé, ou remplacé par une table `work_type_materials` si la relation doit porter un rôle (principal / sous-couche / accessoire). `loadMaterialInputs` filtre dessus.
**Zones** — `apps/api/src/estimations/estimations.service.ts:85-99`, `apps/api/src/projects/entities/work-type.entity.ts`, migrations `…003` et nouvelle migration.
**Fin quand** — la première assertion d'E1-1 passe (≤ 6 lignes) pour les 7 ouvrages. **Charge L.**

**Modèle : `opusplan` · Effort : `xhigh`** — la difficulté est dans la conception du schéma (relation simple ou porteuse de rôle ? migration réversible sur données existantes ?), pas dans la frappe une fois décidé. `opusplan` fait exactement ça : Opus 5 raisonne pendant le plan mode, puis Sonnet 5 exécute — vous payez le raisonnement au prix Opus et l'écriture au prix Sonnet. `xhigh` parce que c'est du multi-fichiers avec migration et retour arrière, le cas « long-horizon work » revendiqué par ce niveau.

```text
/model opusplan
/effort xhigh
Entre en plan mode. Objectif : un ouvrage ne doit plus charger toute sa catégorie de matériaux. Aujourd'hui loadMaterialInputs (apps/api/src/estimations/estimations.service.ts:85-99) charge tous les matériaux de la catégorie, et work_types.required_materials est seedé '[]' et jamais lu — d'où 54 lignes pour une peinture murale. Conçois d'abord la liaison ouvrage -> matériaux : décide si required_materials (jsonb) suffit ou s'il faut une table work_type_materials portant un rôle (principal, sous-couche, accessoire) et un caractère obligatoire ou optionnel, et argumente le choix avant de coder. Puis implémente : migration réversible qui peuple la liaison pour les 7 ouvrages, filtrage dans loadMaterialInputs, et propagation à tous les appelants du moteur (application, calculateurs publics, API partenaire, widget). Ne casse pas la superposition des facteurs de perte appris. Le test créé en E1-1 doit passer sur son assertion de nombre de lignes. Vérifie : migration up et down, pnpm test:api, pnpm test:api:integration, pnpm lint.
```

---

### E1-3 · Curer les jeux de matériaux des 7 ouvrages

**Résultat** — pour chacun des 7 ouvrages, la liste des matériaux qui doivent réellement apparaître, avec leur rôle et leur caractère obligatoire ou optionnel. C'est une décision métier matérialisée en données, pas du code.
**Zones** — seed de liaison créé en E1-2, `apps/api/src/migrations/1711468800006`.
**Fin quand** — un carreleur relit les 7 listes et n'en conteste aucune. Sans cette relecture, la tâche n'est pas finie. **Charge L.**

**Modèle : `fable` · Effort : `high`** — c'est le seul endroit du backlog qui correspond à la description officielle de Fable 5 : *« tasks larger than a single sitting »*, problème ambigu (aucune règle mécanique ne dit si un fixateur de fond appartient à `wall_painting`), 208 matériaux à trier sur 7 ouvrages avec justification, et vérification autonome de son propre travail. C'est aussi la tâche où une erreur est la plus coûteuse et la plus difficile à détecter. `high` est le défaut de Fable 5 et suffit ici : la difficulté est le volume et le jugement, pas la longueur de chaîne d'outils.

*Option* — `/effort ultracode` sur cette tâche seulement : le tri se parallélise naturellement par ouvrage (7 branches indépendantes puis synthèse), ce qui est précisément ce que l'orchestration de workflows sait faire. À réserver si vous acceptez le surcoût en tokens.

```text
/model fable
/effort high
Établis, pour chacun des 7 types d'ouvrage du dépôt (wall_painting, ceiling_painting, floor_tiling, wall_tiling, parquet_flooring, drywall, wall_covering), la liste des matériaux du catalogue seedé qui doivent réellement apparaître dans une liste d'achat, et peuple la liaison ouvrage -> matériaux créée en E1-2. Le catalogue compte 208 matériaux répartis en 5 catégories (apps/api/src/migrations/1711468800006-SeedMaterialsCatalog.ts). Pour chaque ouvrage, distingue : le matériau principal (choix de l'utilisateur parmi des alternatives, une seule doit sortir), les matériaux systématiquement consommés avec lui (sous-couche, colle, joint), et les accessoires (un jeu d'outils, quantité indépendante de la surface). Un matériau ne doit jamais apparaître sur un ouvrage où un professionnel ne l'achèterait pas : une peinture de façade, un décapant ou un white spirit n'ont rien à faire dans une peinture murale intérieure. Le résultat attendu est une liste de 3 à 6 lignes achetables par ouvrage. Livre : la migration de seed réversible, et un tableau récapitulatif en markdown dans docs/ qui liste ouvrage par ouvrage les matériaux retenus, leur rôle, et une ligne de justification par matériau écarté qu'on pourrait croire nécessaire — ce tableau sera relu par un artisan. Vérifie : le test E1-1 sur les 7 ouvrages, pnpm test:api.
```

---

### E1-4 · N'appliquer les couches qu'à ce qui se peint

**Résultat** — le facteur « nombre de couches » cesse de s'appliquer aux accessoires. Le catalogue porte un attribut explicite (`applies_coats`) plutôt qu'une déduction sur la catégorie.
**Zones** — `apps/api/src/estimations/estimation-engine.ts:234-250`, entité `MaterialCatalog`, migration.
**Fin quand** — l'assertion « aucun accessoire au-dessus de 5 unités » d'E1-1 passe, et un test dédié couvre un accessoire à `yield_per_unit = 1`. **Charge M.**

**Modèle : `opus` · Effort : `high`** — défaut circonscrit mais qui touche le moteur de calcul, avec migration de schéma. Opus 5 pour la même raison qu'E1-1 : c'est du calcul, et une régression silencieuse ici se paie en confiance utilisateur. `high` suffit : la portée est de deux fichiers et une migration, sans exploration.

```text
/model opus
/effort high
Corrige l'application du nombre de couches dans le moteur d'estimation. Aujourd'hui computeTheoreticalQty (apps/api/src/estimations/estimation-engine.ts:234-250) multiplie la quantité par le nombre de couches dès que category vaut 'painting', accessoires compris : un pinceau dont yield_per_unit vaut 1 se retrouve commandé 70 fois pour 33 m². Remplace cette déduction par catégorie par un attribut explicite sur le matériau (par exemple applies_coats booléen sur materials_catalog), ajoute la migration réversible qui le renseigne pour les 208 matériaux seedés, et fais lire cet attribut par le moteur. Ajoute un test unitaire dédié qui couvre un accessoire à yield_per_unit=1 avec number_of_coats=2 et vérifie que la quantité n'est pas doublée. Vérifie : migration up et down, le test E1-1, pnpm test:api, pnpm lint.
```

---

### E1-5 · Réécrire le choix du conditionnement

**Résultat** — 6,66 L de peinture donnent 1 pot de 5 L + 1 de 2,5 L, pas 14 pots de 0,5 L. Le critère cesse d'être le surplus absolu.
**Zones** — `apps/api/src/estimations/estimation-engine.ts:252-286`, `estimation-engine.spec.ts:294-302` (test à réécrire, pas à contourner).
**Fin quand** — la quatrième assertion d'E1-1 passe, et une table de cas (0,4 L / 6,66 L / 27 L / 3 m² / 48 m²) est couverte. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — c'est un problème d'optimisation combinatoire sous contraintes floues : il faut choisir un critère (nombre d'unités puis surplus relatif ? combinaison de plusieurs formats ?), et le mauvais critère produit une liste plausible mais chère. Le piège est qu'un test existant verrouille le comportement fautif : l'agent doit reconnaître qu'il faut réécrire le test plutôt que satisfaire les deux. `xhigh` pour l'exploration de l'espace des critères et la vérification sur plusieurs cas.

```text
/model opus
/effort xhigh
Réécris selectBestPackaging dans apps/api/src/estimations/estimation-engine.ts:252-286. Le critère actuel minimise le surplus absolu en volume, ce qui donne 14 pots de 0,5 L (surplus 0,34 L) plutôt que 1 pot de 5 L plus 1 de 2,5 L (surplus 0,84 L) pour 6,66 L de peinture : le résultat est trois à cinq fois plus cher et absurde en magasin. Conçois un critère défendable — commence par comparer "minimiser le nombre d'unités puis départager par le surplus relatif" et "autoriser la combinaison de plusieurs formats pour minimiser le surplus sous contrainte d'un petit nombre d'unités" — et argumente ton choix avant de coder. Attention : le test apps/api/src/estimations/estimation-engine.spec.ts:294-302 verrouille aujourd'hui le comportement fautif ; il doit être RÉÉCRIT pour exprimer le comportement correct, jamais contourné ni supprimé sans remplacement. Ajoute une table de cas couvrant 0,4 L, 6,66 L, 27 L de peinture et 3 m² puis 48 m² de carrelage, avec le résultat attendu justifié pour chacun. Vérifie : le test E1-1, pnpm test:api, pnpm lint.
```

---

### E1-6 · Corriger le contexte carrelage et le doublon des compléments

**Résultat** — la colle et le joint cessent d'être calculés sur 48 fois la surface. Les compléments calculés (`Colle à carrelage`, `Joint`, `Croisillons`) cessent de doublonner les mêmes produits présents au catalogue.
**Zones** — `apps/api/src/shopping-lists/shopping-lists.service.ts:1081-1106`, migrations `…009` / `…010`.
**Fin quand** — 12 m² de carrelage sol donnent une quantité de colle qu'un carreleur reconnaît, et aucun produit n'apparaît deux fois dans la liste. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — deux défauts qui interagissent : corriger le facteur ×48 sans traiter le doublon donne une liste juste en quantité mais fausse en composition. Il faut trancher entre supprimer les compléments calculés ou les retirer du catalogue — une décision de modèle de données, pas un correctif local. `xhigh` pour tenir les deux bouts et vérifier la liste finale de bout en bout.

```text
/model opus
/effort xhigh
Corrige deux défauts liés dans la génération des listes d'achat carrelage. Premier défaut : buildTilingContext (apps/api/src/shopping-lists/shopping-lists.service.ts:1088-1090) somme surface_m2 sur toutes les lignes d'estimation de catégorie tiling ; comme le moteur produisait une ligne par matériau de la catégorie, le contexte valait jusqu'à 48 fois la surface réelle, et la colle comme le joint étaient calculés dessus. Après E1-2 le nombre de lignes chute, mais la déduplication reste à faire explicitement : le contexte doit se fonder sur la surface de l'ouvrage, pas sur la somme des lignes. Second défaut : les compléments calculés (Colle à carrelage, Joint de carrelage, Croisillons, migrations 009 et 010) doublonnent des produits déjà présents au catalogue (5 mortiers-colles, 3 joints, 4 références de croisillons), donc la colle est comptée deux fois. Tranche entre les deux mécanismes — argumente ton choix — puis applique-le par migration réversible. Ajoute un test qui vérifie qu'une liste de carrelage sol de 12 m² ne contient qu'une seule ligne de colle, dans une quantité cohérente avec 12 m². Vérifie : pnpm test:api, pnpm test:api:integration, pnpm lint.
```

---

### E1-7 · Sourcer les rendements et les facteurs de perte, ou réduire le catalogue

**Résultat** — chaque matériau retenu en V1 porte un rendement vérifié contre une fiche fabricant, avec URL et date. Les facteurs de perte cessent d'être appelés « catalogue DTU » sans référence : soit la référence est produite, soit l'appellation disparaît du code et de `docs/API.md:2463`. Les matériaux non sourçables sortent de la V1.
**Zones** — seed `…006`, migration de recalibration `…033`, `docs/`, `apps/api/src/estimations/`.
**Fin quand** — 100 % des matériaux servis en V1 ont une source ; le nombre de matériaux V1 est assumé et écrit. **Charge L.**

**Modèle : `fable` · Effort : `xhigh`** — recherche longue et vérificatrice : aller chercher des fiches techniques fabricant (Weber, Cermix, Bostik, PRB, Sika, Toupret), en extraire un rendement, le confronter à la valeur seedée, et trancher. C'est le profil *« investigates before acting, verifies its work more often than smaller models »* et *« advanced research »*. `xhigh` parce que la tâche est faite d'appels d'outils répétés et de recherche détaillée sur une longue durée — la définition littérale de ce niveau.

```text
/model fable
/effort xhigh
Établis la traçabilité des données de chiffrage de la V1. Pour chaque matériau retenu par E1-3 (et pour lui seul), vérifie le rendement seedé (yield_per_unit) contre une fiche technique fabricant réelle que tu vas chercher en ligne : privilégie les fabricants déjà cités dans la migration 1711468800033 (Weber, Cermix, Bostik, PRB, Sika) et les grandes marques françaises de peinture. Produis docs/SOURCES_CATALOGUE.md avec une ligne par matériau : nom, rendement seedé, rendement constaté sur fiche, écart, URL de la source, date de consultation, et décision (conserver, corriger, retirer de la V1). Applique les corrections par migration idempotente sur le modèle de 1711468800033. Traite séparément les facteurs de perte : le code et docs/API.md:2463 les appellent "catalogue DTU" alors qu'aucune référence DTU n'apparaît nulle part et que les six familles de valeurs sont des nombres ronds. Soit tu produis la référence normative exacte pour chaque famille, soit tu retires l'appellation "DTU" du code, des commentaires et de la documentation et tu la remplaces par une formulation honnête. Un matériau dont le rendement n'est pas sourçable sort du périmètre V1 : dis-le explicitement plutôt que de le conserver. Vérifie : migration up et down, pnpm test:api.
```

---

### E1-8 · Rendre les coûts affichés cohérents

**Résultat** — un seul « coût réel » à l'écran. `computeBudgetSummary` cesse de valoriser les quantités estimées quand l'utilisateur a déclaré ses achats. L'« économie » affichée cesse d'être négative pour un débutant.
**Zones** — `apps/api/src/shopping-lists/shopping-lists.service.ts:898-931`.
**Fin quand** — pour un même chantier clôturé, le budget et le benchmark s'accordent au centime ; un débutant ne voit jamais une économie négative. **Charge M.**

**Modèle : `opus` · Effort : `high`** — deux formules qui produisent des chiffres contradictoires à l'écran : il faut choisir la référence (quantité estimée ou déclarée) et la propager sans casser la clôture de chantier. Erreur d'argent affichée à l'utilisateur, donc pas de descente en gamme. `high` suffit : un seul fichier, périmètre net.

```text
/model opus
/effort high
Rends cohérents les coûts affichés sur la liste d'achat. Deux défauts. Premier : computeBudgetSummary (apps/api/src/shopping-lists/shopping-lists.service.ts:931) valorise real_unit_price multiplié par units_needed, c'est-à-dire la quantité ESTIMÉE, alors que le benchmark de coûts utilise purchased_units, la quantité DÉCLARÉE (cost-benchmark.service.ts:403-410). Deux "coûts réels" contradictoires coexistent à l'écran. Choisis la référence — la quantité déclarée quand elle existe, l'estimée sinon — et propage-la partout, en le documentant dans le code. Second : le calcul d'économie (lignes 898-913) compare un coût brut à 10% de perte forfaitaire au coût réel au facteur du niveau ; un débutant (15%) se voit donc annoncer une économie NÉGATIVE, et un expert une économie qui n'est qu'un artefact de paramétrage. Redéfinis l'économie sur une base défendable (par exemple l'écart entre ce qui a été acheté et ce qui aurait été acheté sans arrondi ni marge de perte optimisée) ou retire l'indicateur s'il n'est pas défendable — argumente. Ajoute des tests couvrant les trois niveaux de compétence. Vérifie : pnpm test:api, pnpm lint.
```

---

### E1-9 · Poser le harnais de non-régression du moteur

**Résultat** — une suite qui exécute le moteur sur le catalogue réel pour les 7 ouvrages × 3 niveaux × poses disponibles, et fige les sorties dans des instantanés relus. Toute dérive future devient visible.
**Zones** — `apps/api/src/estimations/__tests__/`, CI.
**Fin quand** — la CI échoue si une quantité change sans qu'un instantané soit mis à jour explicitement. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — c'est le filet qui protège tout E1 dans la durée, et un harnais mal conçu (instantanés trop larges, tolérances trop lâches) donne une fausse sécurité — exactement la maladie actuelle du dépôt, dont les 1 619 tests n'ont rien vu. `xhigh` parce que la tâche est combinatoire et demande de générer, exécuter et relire un grand nombre de cas.

```text
/model opus
/effort xhigh
Pose un harnais de non-régression sur le moteur d'estimation. Construis une suite qui exécute le moteur sur le catalogue RÉELLEMENT seedé pour toutes les combinaisons ouvrage x niveau de compétence x type de pose disponible, sur trois géométries de référence : une pièce rectangulaire 400x300x250 avec une porte, une pièce en L, et un projet à deux pièces. Fige les sorties dans des instantanés versionnés, lisibles à la relecture (nom du matériau, quantité ajustée, conditionnement, unités) : un instantané qu'on ne peut pas relire ne protège rien. Branche la suite dans .github/workflows/ci.yml. Documente dans le README de test la règle : un instantané ne se met à jour qu'avec une justification écrite dans le message de commit. Attention au piège du dépôt : les tests existants passent tous alors que le moteur produisait 54 lignes pour une peinture murale, parce qu'ils s'exécutent sur un catalogue mocké d'un seul matériau — ce harnais existe précisément pour que cela ne puisse plus arriver. Vérifie : la suite passe, la CI l'exécute, pnpm lint.
```

---

## E2 — Le parcours : le fermer de bout en bout

---

### E2-1 · Débloquer l'invité jusqu'à la liste d'achat

**Résultat** — un visiteur sans compte va de la page d'accueil à sa liste d'achat. C'est le correctif le moins cher et le plus rentable du dépôt.
**Zones** — `apps/web/src/app/(app)/projects/[id]/estimate/page.tsx:57-59`, `.../shopping-list/page.tsx:153-156`, quotas API côté invité.
**Fin quand** — le test navigateur d'E2-6 passe sans authentification. **Charge M.**

**Modèle : `opus` · Effort : `high`** — le correctif front tient en trois lignes, mais autoriser un compte anonyme à faire persister une estimation ouvre une surface : quotas, limites de projets, coût de calcul. Le vrai travail est de vérifier ce que l'invité peut désormais atteindre côté API. C'est du raisonnement sur les garde-fous, pas de l'écriture d'écran.

```text
/model opus
/effort high
Ouvre le parcours invité jusqu'à la liste d'achat incluse. Aujourd'hui apps/web/src/app/(app)/projects/[id]/estimate/page.tsx:57-59 teste seulement !appUser et redirige vers /login, alors que work-selection teste !appUser && !isGuest : un invité qui a saisi ses dimensions et choisi ses travaux est éjecté sans message juste avant de voir un résultat. Même défaut sur shopping-list/page.tsx:153-156. Corrige les deux gardes pour accepter isGuest. Puis, et c'est le point important, vérifie côté API ce qu'un compte anonyme Firebase peut désormais atteindre : quotas de projets, coût de calcul, persistance de l'estimation et de la liste, export PDF et partage par token. Ajoute les limites manquantes plutôt que d'ouvrir en grand, et écris-les dans le code. Le PDF et le partage doivent rester derrière la création de compte : c'est le moment de conversion. Vérifie : pnpm test:web, pnpm test:api, pnpm lint, et déroule le parcours à la main en local sans être connecté.
```

---

### E2-2 · Ne plus perdre la sélection d'ouvrages à la conversion

**Résultat** — l'invité qui crée son compte retrouve ses travaux, pas seulement ses dimensions.
**Zones** — `apps/web/src/contexts/AuthContext.tsx:99-121` (type `LocalProjectDraft`) et `:210-256` (`migrateLocalProjects`).
**Fin quand** — un test couvre la migration d'un brouillon complet avec `work_items`. **Charge S.**

**Modèle : `opus` · Effort : `high`** — perte de données silencieuse au moment exact de la conversion, c'est-à-dire au moment le plus coûteux du funnel. Le type ne déclare même pas le champ que `work-selection` écrit, donc TypeScript ne pouvait rien signaler : il faut comprendre la chaîne complète localStorage → Firebase anonyme → API avant de corriger.

```text
/model opus
/effort high
Corrige la perte de la sélection d'ouvrages à la conversion invité vers compte. Dans apps/web/src/contexts/AuthContext.tsx, migrateLocalProjects (lignes 210-256) migre le nom, les dimensions, les segments, les exclusions et les ouvertures, mais pas les work_items ; et le type LocalProjectDraft (lignes 99-121) ne déclare même pas le champ que work-selection/page.tsx:124 écrit dans localStorage, ce qui empêchait TypeScript de le signaler. Complète le type et la migration, et vérifie qu'aucun autre champ écrit par le parcours invité n'est absent du type — fais l'inventaire de tout ce qui est écrit dans localStorage sous chiffreo_local_projects et compare-le au type. Ajoute un test de la migration d'un brouillon complet (dimensions, segments, exclusions, ouvertures, work_items) et un test de non-régression qui échoue si un champ écrit n'est pas déclaré. Vérifie : pnpm test:web, pnpm lint.
```

---

### E2-3 · Main-d'œuvre par ouvrage dans le devis

**Résultat** — le devis porte une ligne de main-d'œuvre par ouvrage (taux horaire ou forfait, avec temps unitaire au m² proposé par défaut), et non plus un bloc unique.
**Zones** — `apps/api/src/quotes/entities/quote.entity.ts:75-102`, service et PDF, `apps/web/src/app/(app)/projects/[id]/quote/new/`.
**Fin quand** — un peintre produit un devis à deux ouvrages avec deux lignes de MO distinctes, PDF conforme et totaux justes. **Charge L.**

**Modèle : `opusplan` · Effort : `xhigh`** — la conception est délicate (modèle de MO, rétrocompatibilité des devis existants, impact sur les totaux HT/TVA/TTC, sur le PDF et sur la conversion en facture immuable) tandis que l'exécution est volumineuse mais mécanique une fois le modèle arrêté. `opusplan` place le coût là où est la difficulté. `xhigh` : chaîne longue, plusieurs fichiers, migration, PDF et facture à ne pas casser.

```text
/model opusplan
/effort xhigh
Entre en plan mode. Objectif : permettre une ligne de main-d'oeuvre par ouvrage dans le devis. Aujourd'hui apps/api/src/quotes/entities/quote.entity.ts:75-102 ne porte qu'un bloc unique (labor_type horaire ou forfait, taux, heures, ou montant forfaitaire) ; pour un peintre, dont la main-d'oeuvre fait l'essentiel du prix, un devis à une seule ligne de MO n'est pas envoyable. Conçois le modèle : lignes de MO rattachées aux ouvrages du projet, temps unitaire au m² proposé par défaut et modifiable, taux horaire par défaut au niveau du profil d'entreprise. Traite explicitement la rétrocompatibilité des devis existants et l'impact sur les totaux HT, TVA et TTC, sur le PDF (apps/api/src/common/pdf/) et sur la conversion en facture, dont les lignes sont figées en snapshot immuable et numérotées sans trou — ne casse ni l'immuabilité ni la séquence. Restent hors périmètre : déboursé sec, avoir, acompte, autoliquidation BTP, multi-taux de TVA. Vérifie : migration up et down, pnpm test:api, pnpm test:api:integration, pnpm test:web, génère un PDF de devis à deux ouvrages et relis-le.
```

---

### E2-4 · Créer la page fichier clients

**Résultat** — `client_management` est vendu au palier payant sans qu'aucun écran n'existe : les clients ne se créent qu'en ligne au moment d'un devis, sans consultation, édition ni suppression. Une page `/clients` avec liste, fiche, historique des devis.
**Zones** — `apps/web/src/app/(app)/clients/` (à créer), `ContractorDashboard.tsx` (tuile à rendre cliquable), API `clients` existante.
**Fin quand** — chaque opération vendue est réalisable depuis l'interface. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — CRUD frontend sur une API existante et complète, avec des composants et des conventions déjà posés dans le dépôt : la tâche est précisément spécifiable, ce qui est le critère officiel pour descendre en gamme. Sonnet 5 est positionné sur la génération de code et l'usage agentique d'outils, et jusqu'au 31 août il coûte 40 % d'Opus 5.

```text
/model sonnet
/effort high
Crée le fichier clients côté web. La gate client_management est vendue au palier payant (apps/web/src/lib/pricing.ts:220) mais il n'existe aucune page /clients : les clients ne se créent qu'inline via ClientSelect au moment d'un devis, sans consultation, édition ni suppression, et la tuile "Clients : N" du ContractorDashboard n'est pas cliquable. L'API apps/api/src/clients/ est complète — n'y touche pas sauf manque avéré. Crée /clients (liste avec recherche, pagination si nécessaire, état vide soigné) et /clients/[id] (fiche éditable, suppression avec confirmation, historique des devis et factures du client avec liens). Rends la tuile du dashboard cliquable comme l'est déjà celle des devis. Respecte scrupuleusement les conventions du dépôt : composants de apps/web/src/components/, Skeleton pour les états de chargement (et non un paragraphe "Chargement..."), getErrorMessage pour les erreurs, cibles tactiles min-h-11, français en dur. Vérifie : pnpm test:web, pnpm lint, pnpm build:web, et rendu à 390 px de large.
```

---

### E2-5 · Rendre la barre de progression honnête

**Résultat** — un utilisateur ne voit plus « Étape 5 / 6 » quand la sixième étape lui est interdite par son palier. La route `/projects/[id]` manquante, vers laquelle `quoteFlowStepHref` renvoie en repli, cesse de produire un 404.
**Zones** — `apps/web/src/components/.../FlowProgress`, `apps/web/src/lib/quote-flow.ts:45`.
**Fin quand** — le nombre d'étapes affiché correspond aux étapes réellement atteignables. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — correctif d'affichage entièrement décrit, sans décision produit ni risque de données. C'est le cas où `medium` économise des tokens sans rien céder d'important, conformément à sa définition officielle.

```text
/model sonnet
/effort medium
Rends honnête le fil de progression du parcours. Premier point : FlowProgress est monté sur les six étapes y compris pour un utilisateur dont le palier n'autorise pas la sixième (le devis, gate export_devis), qui lit donc en permanence "Étape 5 / 6" pour une étape qu'il ne peut pas atteindre, alors que le CTA lui est bien masqué. Fais dépendre le nombre d'étapes des étapes réellement atteignables par l'utilisateur courant, et vérifie l'aria-label qui parle de "Progression du devis" même pour un particulier. Second point : apps/web/src/lib/quote-flow.ts:45 renvoie en repli vers /projects/[id], une route qui n'existe pas et produit donc un 404 — soit tu crées la page, soit tu changes le repli pour une route existante ; choisis et justifie. Ajoute un test pour chaque cas. Vérifie : pnpm test:web, pnpm lint.
```

---

### E2-6 · Écrire le premier test navigateur de bout en bout

**Résultat** — 39 pages, zéro test navigateur aujourd'hui. Un seul scénario : accueil sans compte → dimensions → ouvrage → estimation → liste. Puis un second : connexion artisan → devis-minute → PDF.
**Zones** — `apps/web/e2e/` (à créer), CI.
**Fin quand** — la CI échoue si le parcours casse. C'est ce test qui aurait détecté E2-1. **Charge M.**

**Modèle : `sonnet` · Effort : `xhigh`** — l'outillage (Playwright, sélecteurs, attentes, CI) est du terrain balisé, donc Sonnet ; mais un test de bout en bout se construit par essais successifs contre un navigateur réel, avec des dizaines d'appels d'outils — c'est littéralement le *« extended exploration, repeated tool calling »* qui définit `xhigh`. C'est le seul endroit du backlog où l'effort compte plus que le modèle.

```text
/model sonnet
/effort xhigh
Mets en place le premier test de bout en bout en navigateur du dépôt : il y a 39 pages et zéro test navigateur, ce qui explique que la rupture du parcours invité n'ait jamais été détectée. Installe Playwright dans apps/web (respecte la contrainte du dépôt : ne télécharge pas de navigateur si un chromium est déjà disponible). Écris deux scénarios seulement. Scénario 1, sans compte : depuis la page d'accueil, démarrer une session invité, saisir des dimensions avec une ouverture, choisir l'ouvrage peinture murale et un niveau, obtenir l'estimation, arriver sur la liste d'achat, et assérer que la liste contient entre 1 et 6 lignes. Scénario 2, artisan connecté : depuis le dashboard, lancer un devis-minute, aller jusqu'à la génération du devis et vérifier que le PDF est produit. Utilise des sélecteurs accessibles (rôles et libellés) plutôt que des classes CSS. Branche les deux dans .github/workflows/ci.yml avec les services nécessaires. Vérifie : les deux scénarios passent en local et en CI.
```

---

### E2-7 · Homogénéiser les états de chargement et d'erreur du tunnel

**Résultat** — 15 fichiers affichent encore un `<p>Chargement...</p>` brut, dont `estimate`, `work-selection`, `quote/new` et `quotes` — c'est-à-dire le tunnel principal. Tous passent au `Skeleton` déjà utilisé par 14 autres.
**Zones** — `apps/web/src/app/(app)/**`.
**Fin quand** — plus aucun `Chargement...` brut sur les six étapes du parcours. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — substitution répétitive à motif connu sur des fichiers existants. Haiku serait tentant pour le prix, mais ces fichiers sont des composants React 19 / Next.js 16 App Router, postérieurs à sa coupure de connaissances fiable de février 2025 : le risque d'un idiome périmé n'est pas payant sur l'écart de prix.

```text
/model sonnet
/effort medium
Homogénéise les états de chargement du parcours principal. Quinze fichiers de apps/web/src/app/(app)/ affichent encore un paragraphe "Chargement..." brut, dont estimate, work-selection, quote/new, quotes, invoices, logbook et l'admin, alors que quatorze autres utilisent déjà le composant Skeleton. Remplace-les par des squelettes qui reprennent la forme du contenu attendu (une carte, une ligne de tableau, un bloc de texte), en réutilisant le composant existant sans en créer un nouveau. Traite en priorité les six étapes du tunnel. Vérifie au passage que chaque écran modifié gère aussi l'erreur via getErrorMessage avec un role="alert", comme le reste du dépôt. Ne change aucune logique métier ni aucun appel API. Vérifie : pnpm test:web, pnpm lint, pnpm build:web.
```

---

## E3 — Réduire le produit à la V1

---

### E3-1 · Débrancher le service de vision par ordinateur

**Résultat** — le service sort de la production : 4 Go de RAM libérés (le poste dominant du VPS), la principale source d'erreur de dimensions supprimée, la dépendance AGPL `ultralytics` suspendue. Le code reste dans git.
**Zones** — `docker-compose.prod.yml:126-153`, `apps/api/src/analysis/`, `apps/web` (entrées « analyse photo »), gate `cv_analysis` (déjà traitée en E0-3).
**Fin quand** — la production tourne sans le conteneur CV et aucune surface ne propose l'analyse photo. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — retrait de configuration et d'entrées d'interface entièrement descriptible ; le raisonnement (faut-il le débrancher ?) a déjà été fait. Le point d'attention est de ne pas casser les écrans qui référencent l'analyse, ce qui relève de l'exécution soigneuse et non du jugement.

```text
/model sonnet
/effort high
Débranche le service de vision par ordinateur du périmètre de production, sans supprimer de code. 1) Retire le service cv-service de docker-compose.prod.yml (et la limite de 4 Go qui va avec) et ajoute une variable CV_ENABLED par défaut à false, lue par apps/api/src/analysis/ pour refuser proprement toute demande d'analyse avec un message français explicite. 2) Retire des surfaces web toute entrée vers l'analyse photo : étape photos du parcours, panneau de résultat, écran de conseils de prise de vue, et mentions marketing sur /, /artisans, /pricing et /calculateurs. L'étape de saisie manuelle des dimensions devient le seul chemin. 3) Mets à jour README.md, docs/ARCHITECTURE.md et docs/DEPLOY.md pour refléter une architecture à trois services et non quatre, et note en une phrase que le service reste dans le dépôt, débranché, avec sa condition de réouverture (voir docs/adr/0001). Ne supprime aucun fichier de apps/cv-service. Vérifie : docker compose -f docker-compose.prod.yml config, pnpm test:api, pnpm test:web, pnpm build:web, pnpm lint.
```

---

### E3-2 · Débloquer le déploiement continu

**Résultat** — `deploy.yml:87-94` récupère et vérifie de façon bloquante des poids YOLO qui n'ont jamais été produits : **aucun tag ne peut être déployé aujourd'hui**. L'étape disparaît.
**Zones** — `.github/workflows/deploy.yml`.
**Fin quand** — un tag `v0.1.0` déclenche un déploiement qui va au bout. **Charge S.**

**Modèle : `haiku` · Effort : non applicable** — Haiku 4.5 ne supporte pas le paramètre `effort` (ne pas taper de ligne `/effort`). Le choix se justifie : suppression d'un bloc identifié dans un fichier YAML GitHub Actions, format stable et antérieur à sa coupure de connaissances de février 2025, aucune décision à prendre, contexte requis très inférieur à ses 200 k tokens. C'est le profil « tâche simple » pour lequel il est le plus rapide et le moins cher.

```text
/model haiku
Dans .github/workflows/deploy.yml, supprime l'étape de récupération et de vérification des poids du modèle YOLO (lignes 87-94 environ : appel à fetch-model.sh puis test -s sur door-window-yolov8n.pt), ainsi que l'étape de build et de publication de l'image cv-service si elle existe. Ces poids n'ont jamais été publiés en release, donc l'étape échoue systématiquement et bloque tout déploiement. Supprime aussi cv-service de la liste des images déployées vers le VPS. Ne touche à rien d'autre dans le fichier, et ne modifie pas .github/workflows/ci.yml. Montre-moi le diff.
```

---

### E3-3 · Retirer le widget, l'API publique et le SSO/Enterprise

> **Étendu par l'[ADR 0002 (D3)](adr/0002-modele-economique-facturation-distribution.md)** : les **organisations** et le **multi-utilisateurs** rejoignent les suppressions — l'exception « ne touche pas au module organizations » du prompt ci-dessous est levée. La suppression se fait en **deux lots séparés et dans cet ordre** : (1) les surfaces — écrans d'invitation, rôles, membres, lignes d'offre, gates ; (2) **et seulement ensuite** les colonnes `organization_id`, qui sont portées par toutes les entités métier et touchent chaque requête. Le second lot se vérifie par une migration `up` puis `down` complète sur une base réelle, pas par des tests unitaires.

**Résultat** — après une période de gel (E0-3), ces trois surfaces sortent du dépôt. Le point qui rend cette tâche urgente n'est pas le volume de code : c'est que **l'application du SSO se fait dans `FirebaseAuthGuard`, sur le chemin critique de toute requête authentifiée**.
**Zones** — `apps/widget/`, `apps/api/src/{widget,api-keys,enterprise}/`, `apps/api/src/auth/guards/firebase-auth.guard.ts:51-57`, migrations de retrait, `main.ts:61-76` (CORS dynamique).
**Fin quand** — la suite complète passe, le CORS dynamique du widget a disparu, et le guard d'authentification est plus court qu'avant. **Charge L.**

**Modèle : `opus` · Effort : `xhigh`** — supprimer est plus dangereux qu'ajouter : il faut démêler des dépendances qui traversent l'authentification, le CORS, les quotas et six migrations, sans casser ce qui reste. Une erreur ici casse la connexion de tous les utilisateurs. C'est du refactoring à grande échelle sur code de sécurité — le cas d'usage nommé d'Opus 5 — et `xhigh` pour la longueur de la chaîne.

```text
/model opus
/effort xhigh
Retire du dépôt trois surfaces livrées mais atteignables depuis aucune interface : le widget marque blanche, l'API publique à clés et l'offre Enterprise avec SSO. Procède dans cet ordre et en vérifiant à chaque étape. 1) Supprime apps/widget/ et sa référence dans pnpm-workspace.yaml, package.json et la CI. 2) Supprime apps/api/src/widget/, apps/api/src/api-keys/ et apps/api/src/enterprise/, leurs modules, guards, interceptors, entités et tests. 3) Point le plus délicat : l'enforcement SSO est branché DANS apps/api/src/auth/guards/firebase-auth.guard.ts lignes 51-57, sur le chemin critique de toute requête authentifiée — retire-le en vérifiant que le guard reste correct pour tous les autres cas, et que les tests d'authentification passent. 4) Retire de main.ts:61-76 la résolution CORS dynamique introduite pour le seul préfixe widget, et reviens à la liste blanche statique. 5) Écris les migrations réversibles de suppression des tables (api_keys, widget_configs, enterprise_agreements, sso_connections et associées) en vérifiant les clés étrangères et l'ordre. 6) Nettoie docs/API.md des sections correspondantes. Ne touche pas au module organizations, qui reste. Vérifie après chaque étape : pnpm test:api, pnpm test:api:integration, pnpm lint, pnpm build:api ; et à la fin, migration up puis down complète sur une base locale.
```

---

### E3-4 · Ramener l'offre à deux paliers : chiffrage gratuit, conformité annuelle

**Résultat** — un palier **gratuit portant tout le chiffrage, sans limite de chantiers**, et un unique palier payant **Conformité à 279 € par an, en annuel uniquement**, avec 30 jours satisfait ou remboursé. Les trois paliers Contractor sont ramenés à un ; les paliers `pro` (DIY 9,99 €) et `enterprise` disparaissent des surfaces, ainsi que la landing particulier.
**Zones** — `apps/web/src/lib/pricing.ts`, `apps/api/src/subscriptions/plans.constants.ts`, `apps/web/src/app/page.tsx`, pages `/artisans`, `/pricing`, migration de gates, `offer-catalogue.spec.ts`.
**Fin quand** — la suite `offer-catalogue.spec.ts` passe et chaque ligne vendue est atteignable. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — la décision de tarif est prise en E0-2 puis révisée par l'[ADR 0002 (D4)](adr/0002-modele-economique-facturation-distribution.md) ; il reste à la propager sur quatre surfaces et une migration, avec un test qui vérifie déjà la cohérence. Le catalogue d'offre étant une donnée typée, la tâche est précisément spécifiable.

```text
/model sonnet
/effort high
Ramène l'offre à deux paliers, selon l'ADR 0002 D4 : un gratuit qui porte TOUT le chiffrage sans limite de chantiers, et un unique palier payant "Conformité" à 279 EUR par an, en annuel uniquement, qui porte le devis PDF conforme, le fichier clients, l'historique de prix et la facturation, avec 30 jours satisfait ou remboursé. Aujourd'hui apps/web/src/lib/pricing.ts porte un palier Pro à 9,99 EUR, trois paliers Contractor (19/29/49) et un bandeau Enterprise, dont plusieurs vendent des fonctionnalités sans interface. 1) Réduis OFFER_PLANS à Free et Conformité 279 EUR/an, en ne conservant que les lignes de fonctionnalité adossées à une gate active après E0-3 ; conserve l'identifiant technique contractor_essentiel, seuls le libellé, le montant et la périodicité changent. 2) Retire le quota FREE_TIER_PROJECT_LIMIT du chemin de chiffrage : le chiffrage est illimité par décision. 3) Supprime le palier pro des surfaces, et supprime la landing particulier apps/web/src/app/page.tsx en faisant de la surface artisan la page d'accueil — sans toucher aux calculateurs publics ni au mode invité jusqu'à la liste d'achat, qui restent (ADR 0001 D1). 4) Migration réversible qui ramène les gates du palier unique au bon rang et retire les paliers pro et enterprise des surfaces. 5) Conserve intact le nommage du périmètre couvert et non couvert (COVERED_TRADES et TRADES_NOT_COVERED dans work-types.ts) : c'est un actif, une couverture partielle annoncée coûte des inscriptions, une couverture partielle découverte après paiement coûte la confiance. 6) apps/web/src/__tests__/offer-catalogue.spec.ts doit passer sans être affaibli — s'il rougit, corrige le catalogue, jamais le test. Signale, sans le corriger toi-même, que STRIPE_PRO_PRICE_ID reste exigée au démarrage par env.validation.ts alors que le palier pro n'existe plus : c'est le sujet de E5-1. Vérifie : migration up et down, pnpm test:web, pnpm test:api, pnpm lint, pnpm build:web.
```

---

### E3-5 · Purger les mentions de ce qui n'existe plus

**Résultat** — plus aucune trace, dans le code, la documentation ou l'interface, de l'analyse photo, du widget, de l'API publique, du SSO, du benchmark de coûts ou des facteurs de perte appris en tant que fonctionnalités proposées.
**Zones** — `docs/`, `README.md`, `apps/web/src/**`, `apps/api/src/**` (commentaires).
**Fin quand** — une recherche sur les termes concernés ne renvoie que du code gelé et l'ADR. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — balayage textuel large mais mécanique, sur un périmètre déjà décidé. `medium` : la tâche est volumineuse en fichiers et pauvre en décisions, c'est le profil exact d'une économie de tokens sans perte.

```text
/model sonnet
/effort medium
Purge le dépôt des mentions de fonctionnalités qui ne sont plus proposées en V1. Recherche dans tout le dépôt (hors apps/cv-service et hors docs/archive/) les occurrences de : analyse photo, vision par ordinateur, CV, widget, API publique, clé API, SSO, SAML, OIDC, Enterprise, benchmark de coûts, facteurs de perte appris. Pour chaque occurrence, décide : si c'est une promesse faite à l'utilisateur (page marketing, libellé d'interface, README, docs/API.md), supprime-la ; si c'est un commentaire de code sur du code gelé, conserve-le mais ajoute la mention du gel ; si c'est dans docs/adr/ ou docs/archive/, ne touche pas. Produis à la fin la liste de ce que tu as modifié, groupée par catégorie, et signale toute occurrence que tu n'as pas su classer plutôt que de trancher au hasard. Vérifie : pnpm build:web, pnpm lint.
```

---

## E4 — Différenciation : ce qui fait rester, puis payer

*Ces cinq tâches sont la réponse à « pourquoi vous et pas ArtisanSmart, Tolteck, Obat ou la calculette de Leroy Merlin ». Aucune n'invente de fonctionnalité : elles rendent visible ce que le dépôt sait déjà faire et que personne d'autre ne documente.*

> **Recadrage par l'[ADR 0002](adr/0002-modele-economique-facturation-distribution.md).** Le chiffrage étant désormais gratuit, ces tâches ne justifient plus un prix : elles font la **démonstration** qui amène à la conformité payante. Et la formulation change — ArtisanSmart calcule aussi des quantités, à 29 € HT/mois sur 15 métiers. L'argument n'est plus « le seul qui calcule » mais **« le seul dont on peut vérifier le calcul »** : surface nette, pièces non rectangulaires, ouvertures déduites une par une, perte par pose et par niveau, conditionnement commercial, rendements sourcés fabricant. Les affirmations interdites sont listées dans `VEILLE_CONCURRENTIELLE.md` §5.2 — elles sont opposables.

---

### E4-1 · Faire de « combien acheter » la sortie principale

**Résultat** — l'écran d'estimation cesse de présenter des mètres carrés et des litres comme résultat. Le résultat, c'est une liste de courses : « 2 pots de 5 L + 1 pot de 2,5 L ». C'est le seul chiffre qu'aucun concurrent ne donne.
**Zones** — `apps/web/src/app/(app)/projects/[id]/estimate/`, `shopping-list/`.
**Fin quand** — sur mobile, la première information visible sans défilement est le nombre d'unités à acheter. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — hiérarchisation d'information et travail de composant, sur des données déjà disponibles côté API. Sonnet 5 est explicitement positionné sur la génération de code et la compréhension visuelle, et la spécification est ici entièrement descriptible.

```text
/model sonnet
/effort high
Réorganise l'écran d'estimation pour que le résultat soit ce qu'il faut ACHETER, et non une surface. Aujourd'hui l'écran présente d'abord des m² et des quantités continues ; or le seul chiffre qu'aucun concurrent ne donne, c'est le conditionnement commercial : "2 pots de 5 L et 1 pot de 2,5 L". Hiérarchise : au premier plan et sans défilement sur mobile 390 px, la liste des unités à acheter par matériau ; au second plan, repliable, le détail du calcul (surface brute, ouvertures déduites, surface nette, marge de perte appliquée, quantité continue). Les données sont déjà toutes dans la réponse d'estimation (gross_surface_m2, surface_m2, excluded_surface_m2, theoretical_qty, waste_factor_percent, adjusted_qty, packaging_label, units_needed) — ne modifie pas l'API. Conserve l'affichage de la fourchette basse/haute quand elle existe. Vérifie : pnpm test:web, pnpm lint, pnpm build:web, rendu à 390 px.
```

---

### E4-2 · Rendre le calcul explicable

**Résultat** — chaque ligne peut être dépliée pour montrer la chaîne complète : surface brute → ouvertures déduites → exclusions → surface nette → facteur de perte (avec sa raison : niveau × pose) → quantité → conditionnement retenu et pourquoi. Un artisan qui comprend le calcul peut le défendre devant son client ; c'est ce qui transforme un outil en argument commercial.
**Zones** — `apps/web/src/components/`, réponse d'estimation (déjà complète).
**Fin quand** — un utilisateur peut reconstituer le chiffre à la main depuis l'écran. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — composant d'affichage sur des données existantes. Le jugement produit (quoi montrer) est fixé par l'énoncé ; l'exécution est du frontend classique.

```text
/model sonnet
/effort high
Ajoute une explication dépliable du calcul sur chaque ligne d'estimation. Pour une ligne donnée, montre la chaîne complète dans l'ordre : surface brute (avec la géométrie utilisée : rectangle, ou pièce composée de N rectangles), surface des ouvertures déduites avec leur détail, surfaces exclues saisies, surface nette, nombre de couches le cas échéant, facteur de perte appliqué avec sa raison explicite (niveau de compétence x type de pose, et la mention "appris" quand la source de la ligne le dit), quantité continue obtenue, puis conditionnement retenu avec la raison du choix (combien d'unités, quel surplus). Toutes ces données sont déjà présentes dans la réponse d'estimation : ne modifie pas l'API, et si un élément manque, signale-le-moi plutôt que de l'inventer. Le composant doit rester lisible à 390 px et être accessible au clavier. Vérifie : pnpm test:web, pnpm lint, et ajoute un test qui vérifie que la chaîne affichée se recompose bien jusqu'au nombre d'unités.
```

---

### E4-3 · Rendre les décrochés et les exclusions accessibles

**Résultat** — le moteur gère l'union exacte de rectangles (formes en L, T, U) et les surfaces à exclure : c'est le différenciateur le plus concret contre une calculette d'enseigne, et c'est enfoui dans la saisie. Une saisie guidée le met en avant (« votre pièce a-t-elle un décroché ? », « une crédence ou un demi-mur à ne pas traiter ? »).
**Zones** — `apps/web/src/app/(app)/projects/[id]/dimensions/`, `room-geometry.ts` (à ne pas toucher).
**Fin quand** — un utilisateur non technique saisit une pièce en L sans aide. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — travail d'UX de saisie sur un moteur géométrique qui, lui, est excellent et ne doit pas bouger. La difficulté est la clarté de l'interface, pas l'algorithme.

```text
/model sonnet
/effort high
Rends accessibles au premier essai les deux capacités qui distinguent le produit d'une calculette d'enseigne, et qui sont aujourd'hui enfouies dans l'écran de saisie : les pièces non rectangulaires (union exacte de rectangles, formes en L, T ou U, gérée par apps/api/src/estimations/room-geometry.ts) et les surfaces à exclure. Sur apps/web/src/app/(app)/projects/[id]/dimensions/, ajoute une saisie guidée : une question explicite "votre pièce a-t-elle un décroché ?" qui, si oui, propose d'ajouter un second puis un troisième rectangle avec un schéma qui se met à jour ; et une question "une zone à ne pas traiter ? (crédence, demi-mur, baie)" qui propose des cas courants pré-remplis. Affiche en direct la surface nette obtenue et l'écart avec le rectangle simple, en euros de matériaux quand un prix est connu : c'est l'argument. Ne modifie ni room-geometry.ts ni le moteur. Vérifie : pnpm test:web, pnpm lint, rendu à 390 px, et déroule à la main la saisie d'une pièce en L.
```

---

### E4-4 · Tenir la promesse des dix minutes

**Résultat** — le parcours « photo du chantier → devis envoyé » est chronométré sur un cas réel et ramené sous dix minutes. Chaque frottement mesuré est corrigé ou assumé par écrit.
**Zones** — l'ensemble du tunnel, `StickyActionBar`, `ContractorDashboard`.
**Fin quand** — trois chronométrages sur trois chantiers différents passent sous dix minutes. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — c'est un audit de parcours, pas une fonctionnalité : il faut parcourir huit écrans, mesurer, identifier les frottements et arbitrer lesquels corriger. Investigation multi-fichiers avec conclusion à rendre — le profil pour lequel `xhigh` est décrit (*« extended exploration, repeated tool calling, detailed search »*).

```text
/model opus
/effort xhigh
Audite le parcours artisan "entrée dans le chantier jusqu'au devis envoyé" et ramène-le sous dix minutes. Parcours de référence : dashboard, devis-minute, dimensions, ouvrages, estimation, liste avec saisie des prix, devis, envoi. Pour chaque écran, compte le nombre de gestes et de saisies obligatoires, repère les champs qui pourraient être pré-remplis (taux horaire du profil d'entreprise, dernier client, dernier matériau utilisé, prix déjà saisis pour le même matériau sur un chantier précédent) et les validations qui bloquent inutilement. Produis d'abord un rapport chiffré geste par geste dans docs/, puis implémente les corrections dont le gain est supérieur à trente secondes, en les classant par gain décroissant. Les frottements que tu décides de ne pas corriger doivent être listés avec leur raison. Attention à ne pas casser ce qui a déjà été soigné : StickyActionBar et les safe-areas, l'acceptation de la virgule décimale dans les champs numériques, la feuille de partage native pour l'envoi du PDF. Vérifie : pnpm test:web, pnpm lint, et déroule le parcours complet à 390 px en te chronométrant.
```

---

### E4-5 · Recentrer les calculateurs publics sur « combien acheter »

**Résultat** — les trois pages publiques cessent de disputer le terme de tête aux calculettes d'enseigne et exposent ce qu'elles seules savent faire : surface nette et marge de perte par niveau. Elles conduisent au parcours réparé.
**Zones** — `apps/web/src/app/calculateurs/`, `apps/web/src/lib/calculators.ts`, `calculators-positioning.spec.ts`.
**Fin quand** — les trois pages exposent le conditionnement, et le passage calculateur → compte → liste ne perd aucune donnée saisie. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — contenu, SEO et continuité de données, sur un module déjà structuré en ensemble fermé de clés testé. Domaine explicite de Sonnet 5 (création de contenu, code frontend), avec une spécification serrée par un test existant.

```text
/model sonnet
/effort high
Recentre les trois calculateurs publics sur "combien acheter". Aujourd'hui ils s'arrêtent à une quantité continue et annoncent eux-mêmes être "hors prix", ce qui les met en concurrence frontale avec les calculettes de Leroy Merlin et Castorama sur le seul terrain où nous n'apportons rien. Après E1, le moteur sait produire un conditionnement commercial : expose-le sur le chemin public (nombre de pots, de sacs, de paquets), ce qu'aucune calculette d'enseigne ne donne. Ajoute la clé de différenciateur correspondante dans CALCULATOR_DIFFERENTIATORS (apps/web/src/lib/calculators.ts) avec le mécanisme qui l'exécute réellement sur le chemin public, comme l'exige le motif de ce module ; apps/web/src/__tests__/calculators-positioning.spec.ts doit passer sans être affaibli. Vérifie ensuite la continuité : ce qui est saisi sur la page publique (dimensions, segments, ouvertures, surfaces à exclure) doit se retrouver intégralement dans le brouillon local puis dans le projet créé à l'inscription — teste-le, c'est déjà là qu'une régression est passée une fois. Mets à jour title, h1 et metadata en cohérence. Vérifie : pnpm test:web, pnpm lint, pnpm build:web.
```

---

## E5 — Revenu

---

### E5-1 · Créer les produits Stripe réels et éprouver le cycle complet

**Résultat** — un prix live **annuel à 279 €** pour le palier Conformité, l'endpoint webhook configuré, et un cycle abonnement → paiement → annulation → remboursement déroulé de bout en bout sur un compte réel.
**Zones** — tableau de bord Stripe, `.env` de production, `apps/api/src/subscriptions/`.
**Fin quand** — un euro réel est encaissé puis remboursé, et l'état de l'abonnement en base suit chaque étape. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — de l'argent réel et un webhook dont l'ordre d'arrivée n'est pas garanti. Le code d'idempotence est déjà bon et testé contre un vrai Postgres ; le risque est dans la configuration et dans les états non couverts. Pas de descente en gamme sur une tâche où une erreur facture ou n'encaisse pas.

```text
/model opus
/effort xhigh
Prépare et éprouve la chaîne de paiement en conditions réelles. 0) Traite d'abord le blocage signalé par E3-4 : env.validation.ts exige STRIPE_PRO_PRICE_ID au démarrage alors que le palier pro (DIY 9,99 EUR) est supprimé par l'ADR 0002 D4 — rends la variable facultative plutôt que de créer un prix fantôme, et couvre-le d'un test de configuration. 1) Documente dans docs/DEPLOY.md la procédure exacte de création du produit et du prix Stripe en mode live pour le palier Conformité à 279 EUR par an, en périodicité annuelle, avec la garantie 30 jours satisfait ou remboursé (qui est une politique de remboursement, pas un essai Stripe : dis explicitement comment elle s'opère), les variables STRIPE_* à renseigner, et la configuration de l'endpoint webhook avec la liste des événements à souscrire — dérive cette liste du code de apps/api/src/subscriptions/, pas de la documentation Stripe générale. 2) Écris un script de vérification (apps/api/src/scripts/) qui, sur une clé de test, déroule le cycle complet checkout, abonnement actif, changement de palier, annulation, et vérifie après chaque étape l'état en base et le palier effectif rendu par les feature gates. 3) Traite explicitement le défaut d'ordonnancement : handleSubscriptionUpdated (subscriptions.service.ts:501) applique l'événement qui arrive en dernier alors que Stripe ne garantit pas l'ordre, si bien qu'un événement retardé peut restaurer un palier périmé — ajoute une garde par horodatage ou par version, et un test qui rejoue deux événements dans le désordre. Vérifie : pnpm test:api, pnpm test:api:integration, et exécute le script sur une clé de test.
```

---

### E5-2 · Faire que `past_due` ne donne plus l'accès

**Résultat** — un impayé cesse de conserver toutes les capacités jusqu'à l'annulation Stripe, soit plusieurs semaines de service gratuit.
**Zones** — `apps/api/src/subscriptions/subscriptions.service.ts:557`, écrans de relance.
**Fin quand** — un abonnement `past_due` retombe sur le palier gratuit après un délai de grâce explicite, avec un bandeau de relance. **Charge S.**

**Modèle : `opus` · Effort : `high`** — une ligne à changer, mais elle décide qui paie et qui ne paie pas, et elle a un effet de bord immédiat sur les utilisateurs existants. Le vrai travail est de choisir le délai de grâce et de le rendre visible sans brutaliser un client dont la carte a simplement expiré.

```text
/model opus
/effort high
Traite le cas de l'impayé. Aujourd'hui apps/api/src/subscriptions/subscriptions.service.ts:557 compte le statut past_due comme actif, sans commentaire justificatif contrairement au reste du fichier : un abonné dont le paiement échoue conserve donc toutes ses capacités jusqu'à l'annulation par Stripe, soit plusieurs semaines de relance. Introduis un délai de grâce explicite et configurable (propose une valeur et argumente-la : une carte expirée n'est pas un défaut de paiement), au-delà duquel le palier effectif retombe sur gratuit. Côté web, affiche pendant le délai de grâce un bandeau non bloquant qui explique la situation et renvoie vers le portail de facturation Stripe, et à l'expiration un message clair sur ce qui est perdu et ce qui est conservé — les devis et factures déjà émis ne doivent jamais devenir inaccessibles. Ajoute des tests couvrant l'entrée en past_due, la sortie par paiement réussi, et l'expiration du délai. Vérifie : pnpm test:api, pnpm test:web, pnpm lint.
```

---

### E5-3 · Instrumenter le funnel de revenu

**Résultat** — les marches visiteur → calculateur → compte → première estimation → liste → devis → essai → abonné sont mesurées et lisibles sur un seul écran. Le module analytics existe ; il s'agit de le brancher sur le funnel réel de la V1.
**Zones** — `apps/api/src/analytics/`, `apps/api/src/admin-analytics/`.
**Fin quand** — chaque marche a un taux de conversion affiché et un volume, avec un garde-fou de volume insuffisant. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — extension d'un module existant à des événements nouveaux, avec un tableau de bord déjà en place. Le raisonnement (quelles marches ?) est fixé par l'énoncé ; le reste est de l'exécution.

```text
/model sonnet
/effort high
Instrumente le funnel de revenu de la V1 sur le module analytics existant (apps/api/src/analytics/ et apps/api/src/admin-analytics/). Les marches à mesurer, dans l'ordre : visite d'un calculateur public, calcul public effectué, session invité démarrée, dimensions saisies, estimation obtenue, liste d'achat vue, compte créé, devis généré, essai démarré, abonnement payant actif, résiliation. Ajoute les événements manquants au enum existant plutôt que d'en créer un nouveau système, et étends GET /admin/analytics/dashboard pour rendre le taux de conversion et le volume de chaque marche sur une fenêtre paramétrable. Reprends le garde-fou déjà employé ailleurs dans le dépôt : en dessous d'un volume minimal, renvoie sufficient_data à false plutôt qu'un taux trompeur. Retire du tableau de bord les blocs devenus sans objet en V1 (PWA, benchmark, précision CV). Vérifie : pnpm test:api, pnpm lint.
```

---

### E5-4 · Décider et câbler l'affiliation

**Résultat** — les adaptateurs ManoMano et Leroy Merlin existent et les liens d'achat sont posés sur la liste sans feature gate. Il manque un compte marchand et un flux produits réels. **À n'activer qu'après E1** : envoyer un utilisateur acheter 70 rouleaux via un lien commissionné est pire que de ne pas avoir de lien.
**Zones** — `apps/api/src/price-comparison/adapters/`, comptes partenaires (hors dépôt).
**Fin quand** — un clic sortant est tracé, attribué, et la commission apparaît sur le tableau de bord du programme. **Charge M** (dont l'essentiel est administratif).

**Modèle : `sonnet` · Effort : `high`** — intégration d'un flux produits dans un registre d'adaptateurs déjà conçu, avec du rapprochement de libellés. Domaine balisé, spécification serrée. La partie non déléguable (ouvrir les comptes) n'est pas du code.

```text
/model sonnet
/effort high
Prépare l'activation réelle de l'affiliation, sans l'activer. Les adaptateurs ManoMano et Leroy Merlin existent dans apps/api/src/price-comparison/adapters/ et les liens d'achat sont posés sur la liste sans feature gate ; il manque un compte marchand et un flux produits. 1) Documente dans docs/ ce qu'il faut obtenir côté partenaire : type de compte, format du flux, fréquence de rafraîchissement, règles d'attribution, mentions légales obligatoires sur un lien commissionné en France. 2) Écris un script de validation qui prend un flux produits en entrée et rapporte le taux de rapprochement avec le catalogue matériaux de la V1, matériau par matériau, pour que je sache avant de m'engager combien de lignes de liste porteront réellement un lien. 3) Ajoute un garde-fou dans le code : aucun lien d'achat ne doit être rendu tant que la liste n'est pas issue du moteur corrigé — expose une constante ou un flag explicite avec un commentaire qui rappelle pourquoi (envoyer quelqu'un acheter une liste fausse via un lien commissionné est pire que de ne pas avoir de lien). Ne crée aucun compte, ne modifie pas les gates. Vérifie : pnpm test:api, pnpm lint.
```

---

### E5-5 · Obtenir le chiffre ferme du raccordement à une Plateforme Agréée

**Résultat** — trois devis comparables sur une grille de coûts complets, et la décision de l'[ADR 0002 D5](adr/0002-modele-economique-facturation-distribution.md) tranchée : option (a) partenariat PA, ou option (b) retrait de la facturation de l'offre.
**Zones** — `docs/CONFORMITE_FACTURATION.md` §8. **Aucun code.**
**Fin quand** — la ligne « € par client et par mois, tout compris, e-reporting B2C inclus » est écrite, sourcée d'un devis, et confrontée au seuil de 3,50 €. **Charge S** (délai long, effort court).

**Échéances, écrites d'avance** — envois **avant le 30 septembre 2026** · décision **au 31 octobre 2026** · **non-retour au 1er mars 2027** : sans connecteur en production à cette date, l'option (b) s'applique d'office. Une facturation vendue et non conforme au 1er septembre 2027, c'est la totalité de la base client perdue en un mois.

**Modèle : `opus` · Effort : `high`** — la tâche est de la négociation et de la comparaison sur critères, pas de la frappe. Le risque est de comparer des prix unitaires au lieu de coûts complets, ce qui est précisément l'erreur que la grille de `CONFORMITE_FACTURATION.md` §8.5 existe pour empêcher.

```text
/model opus
/effort high
Exécute les trois actions de docs/CONFORMITE_FACTURATION.md §8.5 et consigne les résultats dans le même fichier. 1) Candidature au programme partenaire Pennylane (catégorie Partenaires Plateforme Agréée) en citant le précédent ArtisanSmart, raccordé en mai 2026. Questions à poser PAR ÉCRIT, dans cet ordre : l'e-reporting B2C est-il inclus et à quelles conditions (c'est l'inconnue n°1, le B2C domine le volume d'un artisan) ; gratuité effective pour un éditeur opérateur de dématérialisation, par facture ou par SIREN ; conditions contractuelles du statut d'OD ; engagement de réversibilité — Pennylane vend aussi un logiciel de facturation, c'est un fournisseur potentiellement concurrent. 2) Deux devis comparables à des PA infrastructurelles, Iopole et Seqino en marque grise, sur un profil chiffré identique : 50 artisans, 5 factures B2B par mois chacun, e-reporting B2C, émission Factur-X générée par Chiffréo. Exige la décomposition set-up / minimum mensuel / prix unitaire / archivage. 3) Compare sur une grille unique de coûts complets et écris le € par client et par mois qui en sort, à confronter au seuil de 3,50 € fixé par l'ADR 0002 §5.2. N'écris aucun code.
```

---

### E5-6 · Envoyer les cinq e-mails B2B2C et arbitrer le canal

**Résultat** — cinq e-mails nominatifs partis, une relance chacun, et la règle d'arbitrage de l'[ADR 0002 D6](adr/0002-modele-economique-facturation-distribution.md) appliquée au 31 décembre 2026 : soit une suite sérieuse est obtenue et cette voie prime sur le SaaS self-service, soit le canal est clos par défaut.
**Zones** — `docs/PROSPECTION_B2B2C.md`. **Aucun code.**
**Fin quand** — les cinq envois et leurs relances sont consignés, avec pour chacun le nom du destinataire et la réponse obtenue. **Charge S.**

**« Suite sérieuse » — les trois conditions, toutes requises** : une demande écrite de seconde réunion à leur initiative · un interlocuteur nommé avec rôle de décision ou de budget · un périmètre pilote énoncé (nombre de points de vente, gamme, zone). Une réponse polie, un « recontactez-nous », un contact de salon sans suite écrite ne comptent pas.

**Modèle : `sonnet` · Effort : `medium`** — les cinq textes et leurs garde-fous sont déjà écrits ; le travail est d'identifier les destinataires nommés et de tenir le registre des envois. Aucune décision produit n'est en jeu à ce stade.

```text
/model sonnet
/effort medium
Prépare l'envoi des cinq e-mails de docs/PROSPECTION_B2B2C.md §3. 1) Pour chaque cible (Gedimat, Tout Faire Matériaux, Chausson Matériaux ou Doras, Siniat ou Knauf, Cermix ou Parexlanko), identifie UN destinataire nommé avec sa fonction — jamais une adresse contact@, jamais deux noms en copie. 2) Contre-vérifie sur les pages publiques de Tolteck la liste de ses enseignes distributrices (Point.P, Cedeo, Asturienne, La Plateforme du Bâtiment) : elle est citée dans les e-mails et n'est adossée à aucune trace du dépôt. 3) Relis chaque e-mail contre les interdits de §1 avant envoi — pas de "conforme aux DTU", pas de "le seul à…", pas de promesse de justesse générale tant que le défaut cloison sèche est ouvert, pas de revendication de largeur, pas de plan importé, pas de marque blanche présentée comme existante. 4) Ajoute au document un tableau de suivi : date d'envoi, destinataire, date de relance à J+10, réponse, et si la réponse remplit les TROIS conditions de "suite sérieuse" de l'ADR 0002 §5.3. N'écris aucun code et n'invente aucune fonctionnalité dans les textes.
```

---

## E6 — Exploitation sérieuse

---

### E6-1 · Effacer réellement les photos et purger les suppressions logiques

**Résultat** — la suppression de compte et de projet efface les fichiers, pas seulement les lignes. Une rétention explicite est écrite. Exposition RGPD directe aujourd'hui : des photos d'intérieurs de clients survivent indéfiniment dans le volume `uploads` et dans les sauvegardes.
**Zones** — `apps/api/src/photos/photos.service.ts:170`, `apps/api/src/projects/projects.service.ts:712`, tâche planifiée de purge.
**Fin quand** — un compte supprimé ne laisse aucun fichier dans `uploads`, vérifié sur une base et un volume de test. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — opération destructive et irréversible sur des données personnelles, avec un risque symétrique : ne rien effacer expose juridiquement, effacer trop détruit des données de clients. Il faut concevoir une rétention, la rendre réversible pendant sa durée, et vérifier tous les chemins de suppression. Pas de descente en gamme.

```text
/model opus
/effort xhigh
Rends effectif le droit à l'effacement. Aujourd'hui la suppression de compte (apps/api/src/auth/auth.service.ts:162) efface les lignes en base de façon transactionnelle, mais les FICHIERS photos ne sont supprimés que par deletePhoto (apps/api/src/photos/photos.service.ts:170), et la suppression de projet est logique (projects.service.ts:712 softDelete) sans aucune tâche de purge : des photos d'intérieurs de clients survivent indéfiniment dans le volume uploads et dans les sauvegardes chiffrées. Conçois et implémente : une rétention explicite après suppression logique (propose une durée et argumente-la au regard du RGPD et du risque de suppression accidentelle), une tâche planifiée de purge qui efface en base et sur disque les projets dont la rétention est expirée, et l'effacement immédiat des fichiers à la suppression de compte. L'opération est destructive : écris-la de façon idempotente, journalise ce qui est supprimé, et prévois un mode simulation. Traite explicitement le cas des photos rattachées à un projet partagé en communauté. Ajoute un test d'intégration qui crée un compte avec des photos sur disque, le supprime, et vérifie qu'aucun fichier ne subsiste. Documente la politique de rétention dans docs/ et sur la page confidentialité. Vérifie : pnpm test:api, pnpm test:api:integration, et exécute le scénario complet en local.
```

---

### E6-2 · Ouvrir l'export des données personnelles

**Résultat** — l'article 20 du RGPD (portabilité) n'a aucun endpoint aujourd'hui. Un utilisateur peut télécharger ses projets, estimations, listes, clients, devis et factures dans un format lisible.
**Zones** — `apps/api/src/users/` ou nouveau module, écran de compte.
**Fin quand** — un export téléchargé s'ouvre et contient tout ce que le compte porte. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — assemblage et sérialisation de données existantes, avec un périmètre entièrement énumérable. La difficulté est l'exhaustivité, qui se vérifie, pas le raisonnement.

```text
/model sonnet
/effort high
Implémente l'export des données personnelles (portabilité, RGPD article 20), aujourd'hui absent. Ajoute un endpoint authentifié qui produit une archive contenant tout ce que le compte porte : profil, organisations dont il est membre, projets avec pièces, dimensions, ouvertures, exclusions et ouvrages, estimations, listes d'achat et déclarations d'achat, clients, devis, factures, abonnement et historique de facturation. Format : un JSON structuré et documenté, plus les PDF de devis et factures déjà générés. Fais l'inventaire des entités depuis apps/api/src/ plutôt que depuis la documentation, et signale-moi toute entité que tu décides d'exclure avec sa raison. Génère l'archive de façon asynchrone si le volume l'exige, et ne mets jamais en mémoire l'intégralité des fichiers. Ajoute l'entrée correspondante dans l'écran de compte côté web, à côté de la suppression de compte existante. Ajoute un test d'intégration qui vérifie l'exhaustivité sur un compte peuplé. Vérifie : pnpm test:api, pnpm test:api:integration, pnpm test:web, pnpm lint.
```

---

### E6-3 · Corriger `merge-guest`

**Résultat** — `POST /auth/merge-guest` accepte un `anonymous_firebase_uid` fourni par le client sans vérifier que l'appelant le contrôle : absorption des projets d'un tiers **et suppression de son compte**.
**Zones** — `apps/api/src/auth/auth.service.ts:190-215`, `dto/merge-guest.dto.ts`.
**Fin quand** — un test prouve qu'un UID anonyme non contrôlé par l'appelant est refusé. **Charge S.**

**Modèle : `opus` · Effort : `high`** — faille d'autorisation avec suppression de compte à la clé. Le correctif est court, mais il faut choisir la preuve de possession (jeton du compte anonyme présenté en plus, ou lien Firebase préalable) sans casser la conversion, qui est le moment le plus sensible du funnel.

```text
/model opus
/effort high
Corrige la faille d'autorisation de POST /auth/merge-guest. Le DTO (apps/api/src/auth/dto/merge-guest.dto.ts:5) accepte un anonymous_firebase_uid fourni par le client, et auth.service.ts:190-215 ne vérifie que le TYPE du compte visé, jamais que l'appelant le contrôle : un compte authentifié qui connaît l'UID anonyme d'un tiers absorbe ses projets et supprime son compte. Conçois la preuve de possession — par exemple exiger le jeton d'identité du compte anonyme en plus de celui du compte cible, ou s'appuyer sur le lien Firebase (linkWithCredential) déjà effectué côté web avant l'appel — en vérifiant que le chemin de conversion réel du front (apps/web/src/contexts/AuthContext.tsx) reste fonctionnel, y compris son repli. Ajoute un test qui prouve qu'un UID anonyme non contrôlé par l'appelant est refusé, et un test qui prouve que la conversion légitime passe toujours. Vérifie : pnpm test:api, pnpm test:api:integration, pnpm test:web, et déroule une conversion invité à la main.
```

---

### E6-4 · Assainir `.env.example` et sa validation

**Résultat** — `.env.example` livre `DB_PASSWORD=chiffreo_dev` et `CORS_ORIGIN=http://localhost:3000` **non vides**, or la validation ne teste que le vide et `DEPLOY.md §1` dit `cp .env.example .env`. Un opérateur qui suit la documentation démarre en production avec le mot de passe Postgres public du dépôt.
**Zones** — `.env.example`, `apps/api/src/config/env.validation.ts`, `docs/DEPLOY.md`.
**Fin quand** — démarrer en `NODE_ENV=production` avec une valeur d'exemple échoue au démarrage avec un message explicite. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — édition d'un fichier d'exemple et ajout de règles de validation à un module existant. Haiku serait suffisant pour le `.env.example` seul, mais la validation touche du code NestJS : Sonnet évite d'avoir à découper la tâche en deux sessions pour un écart de coût négligeable.

```text
/model sonnet
/effort medium
Rends impossible le démarrage en production avec les valeurs d'exemple. Aujourd'hui .env.example livre des valeurs NON VIDES et dangereuses (DB_PASSWORD=chiffreo_dev ligne 10, CORS_ORIGIN=http://localhost:3000 ligne 16, PUBLIC_URL et NEXT_PUBLIC_* sur localhost), or apps/api/src/config/env.validation.ts ne teste que le vide et docs/DEPLOY.md paragraphe 1 recommande cp .env.example .env : un opérateur qui suit la documentation démarre en production avec le mot de passe Postgres public du dépôt. 1) Vide toutes les valeurs sensibles de .env.example en les remplaçant par un marqueur explicite du type CHANGEME, en conservant les commentaires qui expliquent chaque variable. 2) Étends env.validation.ts pour refuser au démarrage, quand NODE_ENV vaut production : toute valeur égale à un marqueur CHANGEME, toute valeur restée identique à l'exemple, toute URL pointant sur localhost ou 127.0.0.1, et un mot de passe de base de données de moins de 16 caractères. Le message d'erreur doit nommer la variable fautive. 3) Corrige la procédure de docs/DEPLOY.md en conséquence. Ajoute des tests de la validation pour chaque règle. Vérifie : pnpm test:api, pnpm build:api, pnpm lint.
```

---

### E6-5 · Vérifier le déploiement et rendre le retour arrière possible

**Résultat** — `docker compose up -d` sans `--wait` et sans test de fumée : un conteneur qui refuse de démarrer ne rend pas le déploiement rouge. Et le retour arrière documenté ne rejoue que les images, sans reprise de migration — il fait tourner l'ancien code contre le nouveau schéma.
**Zones** — `.github/workflows/deploy.yml`, `docs/DEPLOY.md`, `apps/api/src/scripts/migrate.js`.
**Fin quand** — un déploiement volontairement cassé rend la CD rouge, et une procédure de retour arrière est exécutée avec succès sur un environnement de test. **Charge L.**

**Modèle : `opus` · Effort : `xhigh`** — la réversibilité d'un déploiement avec migrations est un problème de conception (migrations expansives et contractantes ? fenêtre de compatibilité ? point de sauvegarde avant déploiement ?), et la procédure actuellement documentée est activement dangereuse. Chaîne longue, plusieurs fichiers, conséquences en production.

```text
/model opus
/effort xhigh
Rends le déploiement vérifiable et réversible. Deux défauts. Premier : .github/workflows/deploy.yml lance docker compose up -d sans --wait et sans aucun test de fumée post-déploiement, si bien qu'un conteneur qui refuse de démarrer parce qu'une migration a échoué ne rend pas la CD rouge. Ajoute --wait, puis un test de fumée qui interroge les endpoints de santé de l'API et du web, vérifie que la version déployée est celle attendue, et fait échouer le job sinon. Second, plus grave : la procédure de rollback de docs/DEPLOY.md ne rejoue que les images, sans aucune reprise de migration, ce qui fait tourner l'ancien code contre le nouveau schéma. Conçois une stratégie explicite — étudie la compatibilité ascendante des migrations (expand puis contract) et la prise d'un point de sauvegarde de la base avant chaque déploiement — et réécris la procédure de retour arrière pour qu'elle soit sûre, en documentant ce qui n'est PAS réversible. Ajoute le déclenchement d'une sauvegarde avant déploiement (aujourd'hui il n'y a qu'un cron à 3h15). Vérifie : simule un déploiement en échec sur un environnement de test et prouve que la CD rougit, puis exécute la procédure de retour arrière de bout en bout.
```

---

### E6-6 · Éprouver une restauration de sauvegarde

**Résultat** — les scripts de sauvegarde et de restauration existent (`docs/deploy/backup.sh`, 219 lignes, chiffrement GPG, copie hors site) mais **aucune restauration n'a jamais été exécutée**. Une sauvegarde non restaurée n'est pas une sauvegarde.
**Zones** — `docs/deploy/backup.sh`, `restore.sh`, CI.
**Fin quand** — une base restaurée depuis une archive chiffrée démarre l'application, et le procès-verbal est écrit. **Charge M.**

**Modèle : `opus` · Effort : `high`** — le script est bon ; le travail est d'éprouver un chemin critique qui n'a jamais été exécuté et de découvrir ce qui casse (droits, ordre des restaurations, volume `uploads`, extensions Postgres). Ce sont des surprises à diagnostiquer, pas du code à écrire.

```text
/model opus
/effort high
Éprouve la chaîne de sauvegarde et de restauration, qui n'a jamais été exécutée. Les scripts existent (docs/deploy/backup.sh, 219 lignes, pg_dump -Fc plus archive du volume uploads, chiffrement GPG, copie hors site par rclone, rétention 14 jours ; docs/deploy/restore.sh, 185 lignes). Déroule le cycle complet en local avec Docker : peuple une base avec un jeu de données représentatif (compte, organisation, projets avec photos sur disque, estimations, listes, devis, factures numérotées), exécute une sauvegarde, détruis complètement la base et le volume, restaure, puis démarre l'application et vérifie que tout est là — en particulier les fichiers du volume uploads, les séquences de numérotation de devis et factures, et les extensions Postgres. Corrige les scripts pour chaque problème rencontré. Écris ensuite docs/deploy/RESTAURATION.md : la procédure exacte, le temps constaté, ce qui est perdu au pire cas selon l'heure du cron, et les pièges découverts. Ajoute enfin un job de CI hebdomadaire qui rejoue ce cycle sur un jeu de données minimal.
```

---

### E6-7 · Tester l'isolation entre organisations

**Résultat** — la propriété qui porte tout le produit repose sur 46 filtres `organizationId` écrits à la main et sur **un seul** test anti-IDOR dans tout le dépôt. Une régression de filtre passerait toutes les barrières actuelles.
**Zones** — `apps/api/test/integration/`.
**Fin quand** — chaque ressource porteuse d'`organization_id` a un test qui prouve qu'une autre organisation ne peut ni la lire, ni la modifier, ni la supprimer. **Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — il faut d'abord établir l'inventaire exhaustif des ressources et des verbes, puis écrire un test par croisement, puis vérifier qu'aucun n'est faussement vert. C'est un travail de sécurité, combinatoire et long en appels d'outils : les deux critères de `xhigh`.

```text
/model opus
/effort xhigh
Couvre l'isolation entre organisations, qui ne repose aujourd'hui que sur 46 filtres organizationId écrits à la main et sur un unique test anti-IDOR dans tout le dépôt (sso-connections.service.spec.ts:379). 1) Établis d'abord l'inventaire exhaustif : toutes les entités portant organization_id, et pour chacune tous les endpoints qui l'exposent, avec leur verbe. Rends-moi cet inventaire avant d'écrire les tests. 2) Écris ensuite, dans apps/api/test/integration/ contre un vrai Postgres, un test par croisement ressource x verbe qui crée deux organisations distinctes et prouve que la seconde ne peut ni lire, ni lister, ni modifier, ni supprimer la ressource de la première — en attendant un 404 ou un 403 selon la convention du dépôt, jamais une réponse vide qui masquerait un filtre absent. 3) Vérifie que chaque test échoue bien si on retire le filtre correspondant : un test d'isolation qui passe avec et sans le filtre ne prouve rien. 4) Branche la suite dans la CI. Signale-moi toute ressource pour laquelle tu découvres que l'isolation n'est PAS effective, sans la corriger toi-même. Vérifie : pnpm test:api:integration, CI verte.
```

---

### E6-8 · Poser le minimum de supervision

**Résultat** — Sentry est optionnel et silencieux s'il manque, il n'y a pas de moniteur de disponibilité, pas d'agrégation de logs, pas de rotation Docker. On ne peut pas exploiter un service payant à l'aveugle.
**Zones** — `apps/api/src/config/`, `docker-compose.prod.yml`, `docs/DEPLOY.md`.
**Fin quand** — une panne d'API, un webhook Stripe en échec et un disque plein déclenchent chacun une alerte reçue. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — configuration d'outils standards et écriture de sondes, sur des points d'accroche déjà présents (healthchecks, Sentry câblé). Terrain balisé, spécification claire.

```text
/model sonnet
/effort high
Mets en place la supervision minimale d'un service payant. 1) Rends Sentry obligatoire en production : aujourd'hui il est optionnel et échoue en silence s'il n'est pas configuré — fais échouer le démarrage en production si le DSN manque, et vérifie que les erreurs API et web y remontent avec la version déployée en tag. 2) Ajoute la rotation des logs Docker dans docker-compose.prod.yml (aucune n'est configurée aujourd'hui) et une alerte d'espace disque, le volume uploads croissant de façon monotone. 3) Documente dans docs/DEPLOY.md la configuration d'un moniteur de disponibilité externe sur les endpoints de santé existants, avec les seuils. 4) Ajoute une alerte spécifique sur l'échec d'un webhook Stripe : le code d'idempotence marque déjà les événements, expose une sonde qui rend le nombre d'événements non traités depuis plus de quinze minutes, et documente comment la brancher. Ne crée aucun compte externe. Vérifie : docker compose -f docker-compose.prod.yml config, pnpm test:api, pnpm build:api.
```

---

### E6-9 · Assumer l'instance unique par écrit

**Résultat** — le rate limiting et le cache des feature gates sont en mémoire, donc multipliés par le nombre d'instances ; le produit suppose une instance unique sans le dire ailleurs que dans un commentaire. Il ne faut rien changer aujourd'hui — il faut l'écrire, pour que personne ne passe à deux nœuds par erreur.
**Zones** — `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`.
**Fin quand** — la contrainte et son signal de déclenchement figurent dans la documentation d'architecture. **Charge S.**

**Modèle : `haiku` · Effort : non applicable** — Haiku 4.5 ne supporte pas le paramètre `effort`. Rédaction courte de trois encadrés en markdown à partir de faits qui lui sont fournis dans le prompt : aucune exploration, aucun idiome de framework, contexte minuscule. C'est le profil « tâche simple » où sa vitesse et son coût sont un avantage net.

```text
/model haiku
Ajoute un encadré "Contrainte : instance unique" dans README.md, docs/ARCHITECTURE.md et docs/DEPLOY.md. Contenu, identique aux trois endroits, formulé en français : le produit suppose aujourd'hui une seule instance d'API, parce que la limitation de débit est tenue en mémoire du processus (100 requêtes par minute par IP) et que le cache des feature gates est lui aussi par processus avec une durée de 60 secondes ; lancer une seconde instance multiplierait donc silencieusement les plafonds de débit et allongerait la propagation d'un changement de palier. Ajoute que le passage à plusieurs instances impose au préalable de déplacer ces deux mécanismes dans un stockage partagé, et que rien ne doit être fait avant que le volume l'impose. N'écris aucun code et ne modifie aucun autre fichier.
```

---

## E7 — Mise en ligne et confrontation

---

### E7-1 · Poser l'identité visuelle minimale

**Résultat** — logo, favicon, icônes PWA et image OpenGraph. Aujourd'hui listés « reste à faire ». Condition de crédibilité de tout le reste.
**Zones** — `apps/web/public/`, `apps/web/src/app/manifest.ts`, metadata.
**Fin quand** — un partage de lien affiche une carte propre, et l'onglet porte un favicon. **Charge S.**

**Modèle : `sonnet` · Effort : `medium`** — câblage de métadonnées et génération d'un mark SVG sobre. Sonnet 5 est positionné sur la compréhension visuelle et la génération de code ; la tâche est mécanique une fois le parti pris posé. Si vous voulez un vrai travail de marque, cela ne relève pas de Claude Code mais d'un designer.

```text
/model sonnet
/effort medium
Pose l'identité visuelle minimale du produit. 1) Génère un mark SVG sobre pour Chiffréo : monogramme ou pictogramme lié à la mesure, sans dégradé, lisible à 16 px comme à 512 px, en deux variantes clair et sombre. Évite les partis pris visuels génériques (serif sur fond crème, dégradé violet). 2) Décline-le en favicon (ICO et SVG), en icônes PWA 192 et 512 dans apps/web/src/app/manifest.ts, et en icône Apple touch. 3) Crée une image OpenGraph par défaut 1200x630 qui porte le nom, la promesse en une ligne ("Chiffrez vos ouvrages de finition et sachez quoi acheter") et le mark, et câble-la dans les metadata Next par défaut, avec une variante par page marketing si le motif existe déjà. 4) Vérifie qu'aucune page ne reste sans og:image ni sans favicon. Vérifie : pnpm build:web, pnpm lint, et contrôle le rendu des balises sur / et /artisans.
```

---

### E7-2 · Provisionner l'hébergement

**Résultat** — VPS, DNS, Caddy, certificats, premières sauvegardes planifiées. La configuration est documentée ; l'exécution est manuelle et vous appartient.
**Zones** — hors dépôt, plus `docs/DEPLOY.md`.
**Fin quand** — `https://chiffreo.fr` sert l'application en production avec un certificat valide. **Charge M.**

**Modèle : `sonnet` · Effort : `high`** — production d'une procédure exécutable et de fichiers de configuration à partir d'une documentation existante. Le raisonnement d'architecture est fait ; reste à le rendre opérationnel sans trou.

```text
/model sonnet
/effort high
Prépare tout ce qui peut l'être pour la mise en production, sans rien provisionner. 1) Reprends docs/DEPLOY.md et transforme-le en une procédure exécutable pas à pas, en tenant compte du fait que le service cv-service a été retiré (E3-1) : la cible RAM recommandée doit être révisée à la baisse et la nouvelle valeur justifiée par les limites déclarées des services restants dans docker-compose.prod.yml. 2) Produis le Caddyfile complet pour chiffreo.fr et api.chiffreo.fr, avec HTTPS automatique, en-têtes de sécurité (HSTS, CSP adaptée à l'application, X-Content-Type-Options, Referrer-Policy) et compression. 3) Produis la liste exhaustive des enregistrements DNS à créer et des variables d'environnement à renseigner, en distinguant celles qui viennent de Stripe, de Firebase et du fournisseur d'e-mail. 4) Écris une checklist de vérification post-mise-en-ligne : certificat, redirections, en-têtes, endpoints de santé, webhook Stripe joignable depuis l'extérieur, sauvegarde exécutée. Ne crée aucune ressource et ne me demande aucun identifiant.
```

---

### E7-3 · Faire relire le corpus juridique

**Résultat** — CGU, CGV et mentions légales existent mais ont été écrites sans relecture. Vendre un abonnement en France les rend opposables.
**Zones** — `apps/web/src/app/{cgu,cgv,mentions-legales,privacy}/`.
**Fin quand** — un juriste a relu et les réserves sont levées. La relecture n'est pas délégable à un modèle. **Charge M.**

**Modèle : `opus` · Effort : `high`** — préparer un dossier de relecture exige d'identifier ce qui, dans le produit réel, engage juridiquement (rétractation sur un abonnement numérique, données personnelles traitées, sous-traitants, promesse de précision) et de confronter cela au texte existant. Travail d'analyse, pas de rédaction — et le livrable est une liste de questions, pas un texte rassurant.

```text
/model opus
/effort high
Prépare le dossier de relecture juridique du produit, sans prétendre remplacer un juriste. 1) Lis les pages existantes (apps/web/src/app/cgu, cgv, mentions-legales, privacy) et confronte-les au produit RÉEL après réduction au périmètre V1 : ce qui est vendu, à quel prix, avec quel essai, quelles données personnelles sont traitées (dont des photos d'intérieurs de clients d'artisans), quels sous-traitants interviennent (Stripe, Firebase, fournisseur d'e-mail, hébergeur), et quelle promesse de précision est faite sur les quantités. 2) Produis docs/RELECTURE_JURIDIQUE.md : la liste des écarts entre le texte et le produit, la liste des points qui exigent une décision (droit de rétractation sur un abonnement numérique avec essai, responsabilité en cas de quantité erronée ayant causé un préjudice à un artisan, durée de conservation des photos et des factures, base légale de chaque traitement), et pour chacun une question précise à poser au juriste. 3) Corrige dans les pages uniquement les écarts factuels avérés (mention d'une fonctionnalité retirée, tarif obsolète, sous-traitant absent). N'invente aucune clause et n'affirme aucune conformité. Vérifie : pnpm build:web, pnpm lint.
```

---

### E7-4 · Recruter cinq artisans de finition

**Résultat** — cinq peintres, carreleurs ou plaquistes acceptent d'utiliser l'outil sur un chantier réel. C'est la tâche qui décide du sort du projet, et la seule que Claude Code ne peut pas faire à votre place.
**Zones** — hors dépôt.
**Fin quand** — cinq personnes ont accepté et un rendez-vous est pris avec chacune. **Charge L.**

**Modèle : `sonnet` · Effort : `high`** — production de matériel de prise de contact et d'un protocole. Rédaction contrainte par un objectif précis, domaine explicite de Sonnet 5. Le travail réel — passer les appels — n'est pas délégable.

```text
/model sonnet
/effort high
Prépare le recrutement de cinq artisans de finition pour tester l'outil sur un chantier réel. Produis docs/TERRAIN.md contenant : 1) le message de prise de contact, en trois versions courtes adaptées à trois canaux (groupe professionnel en ligne, contact direct sur un chantier, réseau personnel), qui dit exactement ce qu'on demande, combien de temps ça prend et ce que l'artisan y gagne — sans survendre, le produit n'a jamais servi ; 2) les critères de sélection : métier de finition uniquement (peintre, carreleur, plaquiste, solier), volume de devis mensuel, outil de devis actuel s'il en a un ; 3) le protocole d'observation : ce qu'on regarde pendant l'usage (où il hésite, ce qu'il corrige à la main, ce qu'il ne comprend pas), ce qu'on ne dit surtout pas pour ne pas guider, et la question unique posée à la fin — "auriez-vous acheté cette liste telle quelle ?" ; 4) la grille de relevé, une page par artisan, à remplir sur place. N'écris aucun code.
```

---

### E7-5 · Rendre le verdict

**Résultat** — cinq listes produites par des personnes extérieures au projet, et une décision écrite : une réponse négative sur cinq relance E1 ; trois positives ouvrent E8.
**Zones** — `docs/`.
**Fin quand** — la décision est écrite et datée, avant toute reprise du développement. **Charge S.**

**Modèle : `opus` · Effort : `high`** — synthétiser cinq retours contradictoires et en tirer une décision qui engage plusieurs semaines, sans céder à l'envie de conclure positivement. C'est un exercice de jugement sous biais, où la valeur du modèle est sa capacité à contredire l'attente.

```text
/model opus
/effort high
À partir des cinq grilles de relevé remplies sur le terrain (docs/TERRAIN.md et les fiches associées que je vais te fournir), rends un verdict écrit dans docs/VERDICT_TERRAIN.md. Structure : 1) ce qui a été observé, artisan par artisan, sans interprétation ; 2) les frottements cités plus d'une fois, classés par gravité, en distinguant ce qui relève d'une quantité fausse, d'un parcours pénible et d'une attente que le produit ne couvre pas ; 3) la réponse à la question unique — combien d'artisans auraient acheté la liste telle quelle ; 4) la décision, selon la règle fixée d'avance : une seule réponse négative relance l'épic E1 du backlog avec les cas précis à corriger, trois réponses positives ouvrent l'épic E8. Ta tâche n'est pas de trouver le résultat encourageant. Si les retours sont mauvais, dis-le, et écris précisément ce qu'il faut reprendre. Si un artisan a cité un besoin hors périmètre (un corps d'état non couvert, une facture d'acompte), note-le sans le transformer en priorité.
```

---

## E8 — Après la V1, et seulement sur données

*À n'ouvrir qu'après un verdict de terrain positif. Chaque tâche porte sa condition de déclenchement.*

---

### E8-1 · Élargir le périmètre chiffrable

**Déclencheur** — au moins deux artisans testeurs citent le même corps d'état manquant.
**Résultat** — un ou deux ouvrages supplémentaires, avec leur catalogue matériaux sourcé et leurs facteurs de perte. C'est le seul chemin qui rouvre un tarif au-dessus de 29 € et le segment généraliste.
**Charge L.**

**Modèle : `fable` · Effort : `xhigh`** — reproduire pour un nouveau corps d'état tout le travail d'E1-3 et E1-7 réunis : recherche de catalogue, sourçage des rendements, définition des règles de calcul, données de seed. Longue durée, recherche, vérification autonome — le profil de Fable 5. C'est aussi la tâche où le coût du modèle est le plus faible rapporté à la valeur : un rendement faux entraîne des devis faux pendant des mois.

```text
/model fable
/effort xhigh
Étends le périmètre chiffrable à un nouveau corps d'état (je te dirai lequel). Reproduis pour lui la chaîne complète établie en E1 : 1) définis le ou les types d'ouvrage à créer, leur cible de surface (mur, sol, plafond ou linéaire — attention, certains corps d'état se chiffrent au mètre linéaire ou à l'unité et non au m², ce que le moteur ne sait pas faire aujourd'hui : dis-le-moi avant de coder si c'est le cas) ; 2) constitue le catalogue de matériaux correspondant, en sourçant chaque rendement contre une fiche technique fabricant réelle, sur le modèle de docs/SOURCES_CATALOGUE.md ; 3) établis les facteurs de perte par niveau et par type de pose, avec leur justification ; 4) écris les migrations de seed réversibles et la liaison ouvrage vers matériaux ; 5) étends le harnais de non-régression du moteur au nouvel ouvrage ; 6) mets à jour COVERED_TRADES et TRADES_NOT_COVERED et les surfaces marketing. Livre également le tableau de relecture destiné à un artisan du métier concerné. Vérifie : migrations up et down, pnpm test:api, pnpm test:web, pnpm lint.
```

---

### E8-2 · Instruire la réouverture de la vision par ordinateur

**Déclencheur** — au moins trois artisans demandent spontanément la mesure par photo.
**Résultat** — un protocole de mesure de précision exécuté sur 50 à 100 photos réelles avec dimensions relevées au télémètre. Le composant ne revient que si l'erreur médiane passe sous 5 %, et seulement après comparaison honnête avec ARKit/ARCore, qui donnent ±1-2 % pour un coût serveur nul.
**Charge L.**

**Modèle : `opus` · Effort : `xhigh`** — conception d'un protocole de mesure, instrumentation du pipeline, analyse statistique des écarts. Il faut aussi savoir conclure contre le composant, ce qui suppose de résister à la tentation de le sauver. Investigation longue et multi-outils.

```text
/model opus
/effort xhigh
Instruis la réouverture éventuelle du service de vision par ordinateur, sans le rebrancher. 1) Écris le protocole de mesure de précision : combien de photos, dans quelles conditions (taille de pièce, luminosité, présence ou absence de porte visible, distance de prise de vue), comment relever la vérité terrain au télémètre, et comment consigner les résultats. 2) Instrumente apps/cv-service pour qu'un lot de photos annotées produise un rapport d'erreur exploitable : erreur médiane et au 90e centile par dimension, taux de photos sans référence détectée, taux de fausse détection de porte, et corrélation entre le score de confiance et l'erreur réelle — cette corrélation est le point décisif, car les mesures antérieures montrent un score décorrélé de la justesse. 3) Documente honnêtement dans le rapport les défauts structurels connus : la formule de longueur (dimension_calculator.py:337-343) n'est pas homogène physiquement, la calibration suppose la porte dans le plan frontal, et un écart réaliste de perspective produit +24 à +42 pour cent d'erreur. 4) Écris le critère de décision AVANT de mesurer : le composant ne revient que si l'erreur médiane passe sous 5 pour cent, et il doit alors être comparé à ARKit et ARCore qui atteignent 1 à 2 pour cent pour un coût serveur nul. Ne rebranche rien.
```

---

### E8-3 · Rendre atteignable l'apprentissage des facteurs de perte

**Déclencheur** — plus de 200 chantiers clôturés en production.
**Résultat** — la mécanique statistique est bien construite (médiane robuste, MAD, crédibilité de Bühlmann, bornage) mais exige ≥ 8 chantiers **et** ≥ 3 organisations **par cellule** matériau × pose × niveau, soit plus de 900 cellules. Après E1-3, le nombre de matériaux servis chute fortement : les seuils redeviennent atteignables et doivent être recalculés.
**Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — statistiques appliquées avec conséquences directes sur les quantités facturées : un seuil trop bas fait apprendre du bruit et dégrade les listes de tout le monde. Raisonnement quantitatif difficile, domaine explicitement cité pour Opus 5 (recherche scientifique et mathématique).

```text
/model opus
/effort xhigh
Recalibre l'apprentissage des facteurs de perte pour qu'il devienne atteignable. La mécanique de apps/api/src/waste-learning/ est statistiquement bien construite (médiane robuste, MAD inférieur ou égal à 15 points, crédibilité de Bühlmann n sur n plus 12, bornage à plus ou moins 10 points et à l'intervalle 0-30 pour cent, upsert transactionnel sous verrou consultatif), mais ses seuils la rendent inatteignable : minimum 8 observations et au plus 3 par organisation, donc au moins 3 organisations distinctes, par cellule matériau x pose x niveau — soit plus de 900 cellules quand le catalogue servait 208 matériaux. 1) Recalcule le nombre réel de cellules après la réduction du catalogue par E1-3, et dis-moi combien de chantiers clôturés sont nécessaires pour qu'une première cellule s'active. 2) Étudie une agrégation à un niveau plus grossier quand la cellule fine n'a pas le volume (par exemple par famille de matériau plutôt que par matériau), en conservant la garantie qu'on n'apprend pas du bruit — argumente et chiffre le risque. 3) Corrige la dérive entre le code (cap de 3 par organisation) et docs/BACKLOG.md ligne 170 (qui annonce 5). 4) Étends les tests aux nouveaux cas d'agrégation. Ne baisse aucun seuil sans démontrer que la variance résiduelle reste acceptable. Vérifie : pnpm test:api, pnpm test:api:integration.
```

---

### E8-4 · Réparer le benchmark de coûts avant de le rouvrir

**Déclencheur** — E8-3 produit ses premières cellules.
**Résultat** — deux verrous rendent le benchmark inalimentable : un chantier est **entièrement rejeté** si un `material_id` apparaît sous deux `work_type_code` (or peinture murale et peinture plafond partageaient les mêmes matériaux), et un ouvrage n'est retenu que si **chacun** de ses matériaux porte un prix et une quantité déclarée.
**Charge M.**

**Modèle : `opus` · Effort : `xhigh`** — corriger la logique d'admission sans casser le k-anonymat, qui est verrouillé par une contrainte `CHECK` en base et dont l'affaiblissement exposerait des dépenses individuelles. Sécurité des données et raisonnement statistique en même temps.

```text
/model opus
/effort xhigh
Répare la logique d'admission du benchmark de coûts, aujourd'hui inalimentable, sans toucher à ses garanties d'anonymat. Deux verrous. Premier : cost-benchmark.service.ts:371 rejette TOUT le chantier si un material_id apparaît sous deux work_type_code — or avant E1-2 peinture murale et peinture plafond partageaient les 54 mêmes matériaux, donc tout projet mixant les deux était exclu ; vérifie si le défaut subsiste après la liaison ouvrage vers matériaux, et si oui, remplace le rejet global par une attribution explicite ou une exclusion de la seule ligne ambiguë. Second : lignes 403-406, un ouvrage n'est retenu que si CHACUN de ses matériaux porte un prix et une quantité déclarée, ce qui est inatteignable en pratique — définis un critère de complétude défendable (par exemple une part minimale du coût couverte) et argumente-le. Ne relâche en aucun cas le k-anonymat : au moins 5 organisations distinctes, au moins 10 chantiers, au plus 3 par organisation, médiane seule publiée, et une cellule sous les seuils n'est pas masquée mais n'est PAS écrite — cet invariant est verrouillé par une contrainte CHECK en base et doit le rester. Étends les tests, y compris un test qui prouve qu'une cellule sous les seuils ne peut pas être insérée. Vérifie : pnpm test:api, pnpm test:api:integration.
```

---

### E8-5 · Trancher PWA ou application native

**Déclencheur** — au moins 200 sessions mesurées sur 30 jours après mise en production.
**Résultat** — la règle de décision a été écrite avant toute collecte, ce qui est méritoire ; il reste à l'appliquer. Le service worker est réel et bien fait (trois stratégies de cache, cache API partitionné par identité Firebase, purge à la déconnexion).
**Charge S** (décision) ou **XL** (si natif).

**Modèle : `sonnet` · Effort : `high`** — appliquer une règle de décision déjà écrite à des chiffres mesurés, et rédiger la conclusion. Le raisonnement difficile a été fait d'avance ; il reste de la lecture de données et de la rédaction contrainte.

```text
/model sonnet
/effort high
Applique la règle de décision PWA contre application native, écrite avant collecte dans docs/archive/BACKLOG.md (section MOB-2). Lis les chiffres réels du bloc pwa de GET /admin/analytics/dashboard sur au moins 30 jours et au moins 200 sessions, puis rends la décision dans docs/DECISION_MOBILE.md en appliquant la règle telle quelle : go si le taux de rejet de photos atteint 15 pour cent, ou si la part de sessions mobiles atteint 40 pour cent alors que la part en mode standalone reste sous 10 pour cent malgré l'éligibilité au prompt, ou si iOS représente au moins la moitié des sessions mobiles ; no-go si la part standalone atteint 25 pour cent et le taux de rejet reste sous 10 pour cent. Si le volume minimal n'est pas atteint, la conclusion est "pas de décision" et rien d'autre — ne cherche pas à trancher quand même. Si les chiffres tombent entre les seuils, dis-le et propose ce qu'il faudrait mesurer en plus, sans réviser les seuils après coup. Rappelle dans la conclusion que le critère du taux de rejet de photos perd son sens tant que la capture photo n'est pas rebranchée (E3-1). N'écris aucun code.
```

---

## Partie C — Vue d'ensemble

### C.1 Répartition des modèles

53 tâches, 53 commandes.

| Modèle | Tâches | Part | Où et pourquoi |
|---|---|---|---|
| **Opus 5** (`opus`) | 24 | 45 % | Calcul, schéma, sécurité, argent, RGPD, suppression de code, décisions. Là où une erreur coûte de l'argent, du droit ou de la confiance. |
| **Sonnet 5** (`sonnet`) | 22 | 42 % | Frontend, contenu, SEO, configuration, tests, intégrations — tout ce qui est spécifiable à l'avance. |
| **Fable 5** (`fable`) | 3 | 6 % | E1-3, E1-7, E8-1 : les seules tâches plus grandes qu'une session, ambiguës et à forte composante de recherche. |
| **`opusplan`** | 2 | 4 % | E1-2, E2-3 : la difficulté est dans la conception, le volume dans l'exécution. |
| **Haiku 4.5** (`haiku`) | 2 | 4 % | E3-2 et E6-9 : YAML GitHub Actions et encadrés markdown, sans idiome de framework postérieur à février 2025. |

### C.2 Répartition des efforts

| Niveau | Tâches | Lecture |
|---|---|---|
| `high` | 27 | Le régime normal, conforme au défaut officiel de tous les modèles concernés. |
| `xhigh` | 18 | Toutes multi-fichiers avec migration, sécurité ou vérification longue — la définition officielle du niveau (*« long-horizon work, 30+ minutes »*). |
| `medium` | 6 | Éditions mécaniques sur périmètre déjà décidé. |
| non applicable | 2 | Les deux tâches Haiku : le modèle ne supporte pas le paramètre. |
| `max` | **0** | La documentation avertit d'un coût significatif pour un gain faible et d'une propension à sur-réfléchir. Aucune tâche de ce backlog ne le justifie. |
| `low` | 0 | Trop risqué sur un dépôt dont les tests existants n'ont pas vu un défaut d'ordre de grandeur. |

### C.3 Deux remarques de calendrier

**Sonnet 5 est à $2/$10 par MTok jusqu'au 31 août 2026**, puis $3/$15. Les 22 tâches Sonnet de ce backlog — la totalité d'E2, E4, une partie d'E6 et E7 — coûteront 50 % de plus en septembre. Si la trésorerie de tokens est un sujet, c'est une raison concrète de les regrouper ce mois-ci. À nuancer : le tokenizer de Sonnet 5 produit 1,0 à 1,35× plus de tokens pour le même texte, ce que le prix d'introduction est précisément censé compenser.

**Opus 5 exige Claude Code v2.1.219 ou plus récent.** Vérifiez avec `claude --version` avant de commencer, et faites `claude update` sinon : sur une version antérieure, `/model opus` sélectionne silencieusement Opus 4.8 et toutes les recommandations d'effort de ce document deviennent inadaptées.

### C.4 Ordre d'exécution

```
E0 (4 tâches, ~2 j)
  └─► E1 (9 tâches, ~8 j)  ◄── rien d'autre n'a de sens avant
        ├─► E2 (7 tâches, ~6 j)
        ├─► E4 (5 tâches, ~5 j)   [dépend de E1 et E2]
        └─► E3 (5 tâches, ~4 j)   [peut démarrer en parallèle d'E2]
              └─► E5 (4 tâches, ~3 j)
                    └─► E6 (9 tâches, ~7 j)
                          └─► E7 (5 tâches, ~4 j + terrain)
                                └─► E7-5 verdict
                                      └─► E8 (conditionnel)
```

Chemin critique jusqu'à la mise en ligne : **E0 → E1 → E2 → E3 → E5 → E6 → E7**, soit une trentaine de jours de pilotage. E4 est parallélisable et c'est ce qui fait la différence commerciale : ne le sacrifiez pas pour gagner une semaine.

---

## Sources

Modèles, prix, alias et niveaux d'effort vérifiés le 3 août 2026 sur :

- [Model configuration — Claude Code](https://code.claude.com/docs/en/model-config) — alias `opus`/`sonnet`/`haiku`/`fable`/`opusplan`, résolution par fournisseur, niveaux d'effort par modèle, `ultracode`, `ultrathink`, versions minimales de Claude Code
- [Models overview — Claude Platform](https://platform.claude.com/docs/en/about-claude/models/overview) — identifiants, fenêtres de contexte, sorties maximales, coupures de connaissances
- [Pricing — Claude Platform](https://platform.claude.com/docs/en/about-claude/pricing) — tarifs par million de tokens, prix d'introduction Sonnet 5, mise en cache
- [Effort — Claude Platform](https://platform.claude.com/docs/en/build-with-claude/effort) — modèles supportant le paramètre, recommandations par modèle, avertissement sur `max`
- [Choosing a model — Claude Platform](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) — cadre de décision, forces et compromis par modèle
- [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code) — diagnostic « modèle ou effort ? »
- [Introducing Claude Opus 5](https://www.anthropic.com/news/claude-opus-5) — positionnement, résultats, mode rapide
- [Introducing Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5) — positionnement, tokenizer, prix d'introduction
