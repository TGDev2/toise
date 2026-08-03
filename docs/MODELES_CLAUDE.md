# Modèles Claude × Backlog Chiffréo

> **Objet** : quel modèle Claude et quel niveau d'effort utiliser dans Claude Code pour chaque tâche du backlog, avec la commande exacte à coller.
> **Sources modèles** : documentation officielle Anthropic, revérifiée le 2026-08-03 (liens et lignes « vérifié le » sous chaque tableau). **Sources tâches** : [BACKLOG_V1.md](BACKLOG_V1.md). **Version visuelle** : artifact « Modèles Claude × Backlog Chiffréo ».
> **Réglages Claude Code** : [doc officielle model-config](https://code.claude.com/docs/en/model-config).

---

## 1. Régler le modèle et l'effort dans Claude Code

Chaque commande ci-dessous se lit en deux lignes de contrôle (`/model`, `/effort`) suivies du prompt.

### Modèle — `/model`

| Modèle | Commande |
|---|---|
| Opus 5 | `/model opus` |
| Sonnet 5 | `/model sonnet` |
| Haiku 4.5 | `/model haiku` |
| Fable 5 | `/model fable` (ou `/model claude-fable-5`) |

L'alias `opus` résout vers **Opus 5** sur l'API Anthropic (Claude Code ≥ v2.1.219 ; avant cette version il résolvait vers Opus 4.8). `sonnet` résout vers Sonnet 5 sur l'API Anthropic. Ces alias dépendent du provider (Bedrock/Foundry/Vertex peuvent résoudre vers une version antérieure) — sur ce projet on est sur l'API Anthropic directe.

*Vérifié le 2026-08-03 sur [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config).*

### Effort de raisonnement — `/effort`

- `/effort low | medium | high | xhigh | max` — règle l'effort pour la session. `low`/`medium`/`high`/`xhigh` persistent entre sessions une fois réglés en interactif ; `max` est limité à la session en cours (sauf via la variable d'environnement).
- `/effort` seul — ouvre un slider ; `/effort auto` — revient au défaut du modèle.
- Dans le sélecteur `/model` — flèches gauche/droite pour ajuster l'effort.
- Au lancement — flag `--effort <niveau>` ; variable `CLAUDE_CODE_EFFORT_LEVEL` (prioritaire sur tout le reste) ; réglage `effortLevel` dans les settings (`max` et `ultracode` non acceptés dans ce champ).
- Mot-clé `ultrathink` dans le prompt — **ne change pas le niveau d'effort envoyé à l'API** ; Claude Code se contente d'ajouter une instruction de raisonnement plus approfondi dans le contexte, pour ce tour uniquement. (Corrige l'ancienne fiche, qui affirmait à tort que `ultrathink` force l'effort `max`.)
- `ultracode` (via `/effort ultracode` ou `--effort ultracode`) — envoie l'effort `xhigh` et fait en plus orchestrer des workflows multi-agents par Claude Code pour les tâches substantielles. Session uniquement.

**Niveaux d'effort disponibles par modèle** :

| Modèle | Niveaux supportés |
|---|---|
| Fable 5 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 5, Sonnet 5 | `low`, `medium`, `high`, `xhigh`, `max` |
| Haiku 4.5 | **aucun** — le paramètre `effort` n'est pas supporté sur ce modèle |

*Vérifié le 2026-08-03 sur [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config) (tableau « Adjust effort level »).*

**Défauts et reco** :
- L'effort par défaut est `high` sur tous les modèles qui le supportent (Fable 5, Opus 5, Sonnet 5).
- Sur **Opus 5**, la doc recommande de **partir de `high`** (le défaut) et de monter à `xhigh` seulement pour du codage/agentique exigeant, ou à `max` quand la tâche le justifie ; `low`/`medium` sont à utiliser librement dès que les évals tiennent. C'est un changement de posture par rapport à Opus 4.7/4.8, dont la doc recommandait de démarrer directement en `xhigh` pour le codage — cette dernière recommandation ne s'applique plus à Opus 5.
- Sur **Sonnet 5**, même logique : défaut `high`, `xhigh` réservé aux tâches de codage/agentique les plus dures, `medium` en repli économique.
- Sur **Haiku 4.5**, la notion d'effort ne s'applique pas.
- Conséquence pour ce document : contrairement à l'ancienne version, `xhigh` n'est plus le réglage par défaut recommandé pour la majorité des tâches — voir section 3.

*Vérifié le 2026-08-03 sur [platform.claude.com/docs/en/build-with-claude/effort](https://platform.claude.com/docs/en/build-with-claude/effort).*

> Conventions des prompts : ils supposent le workflow de [CLAUDE.md](../CLAUDE.md) (plan mode pour le non-trivial, vérification build/tests/lint). Les paliers d'effort d'Chiffréo restent S/M/L/XL = charge humaine ; l'« effort CC » ci-dessous est le niveau de raisonnement Claude Code.

---

## 2. Comparatif des modèles (rappel)

| Modèle | ID API | Contexte · sortie max | Coupure de connaissances fiable | Prix ($/MTok in-out) | Positionnement officiel |
|---|---|---|---|---|---|
| **Fable 5** | `claude-fable-5` | 1M · 128K | Janvier 2026 | 10 / 50 | « Next-generation intelligence for long-running agents » ; le plus capable |
| **Opus 5** | `claude-opus-5` | 1M · 128K | Mai 2026 | 5 / 25 | « For complex agentic coding and enterprise work » |
| **Sonnet 5** | `claude-sonnet-5` | 1M · 128K | Janvier 2026 | 3 / 15 (prix d'intro 2 / 10 jusqu'au 31 août 2026) | « The best combination of speed and intelligence » |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K · 64K | **Février 2025** | 1 / 5 | « The fastest model with near-frontier intelligence » |

**Écueils** :
- **Fable 5** — cher ; réservé aux workloads les plus longs/durs ; refus possibles sur les domaines cybersécurité/biologie.
- **Opus 5** — coût > Sonnet ; pas de repli max en cas de flag biologie (contrairement à Fable 5).
- **Sonnet 5** — tokenizer plus récent (partagé avec toute la génération « 4.7 et suivants ») : **~30 % de tokens en plus** pour un même texte par rapport à l'ancien tokenizer (Sonnet 4.6 et antérieurs), l'écart exact dépendant du contenu. *Nota : la fiche précédente citait un ratio "1,0 à 1,35x" que nous n'avons pas retrouvé tel quel dans la documentation officielle — seule la formulation "~30 %" y est vérifiée, à traiter comme l'estimation de référence.* Prix d'intro à 2/10 $ jusqu'au 31 août 2026, puis 3/15 $ (tarif "standard" déjà appliqué ci-dessus en repli).
- **Haiku 4.5** — **ne supporte pas le paramètre `effort`** ; coupure de connaissances fiable la plus ancienne du lineup actuel (février 2025, contre 2026 pour les autres) ; plafond de capacité plus bas ; contexte 200K.

Générations précédentes encore actives (à épingler seulement pour figer un comportement) : Opus 4.8/4.7/4.6, Sonnet 4.6.

*Vérifié le 2026-08-03 sur [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) et [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing).*

---

## 3. Logique de sélection

Prendre **le modèle le moins cher qui tient la tâche**, monter d'un cran dès que la *correctness*, l'ampleur multi-fichiers ou l'horizon long le justifient. Ne jamais descendre pour économiser sur une tâche à fort enjeu (sécurité, données, juridique, migration).

**Sur l'effort : partir de `high` (le défaut), pas de `xhigh`.** La doc officielle d'Opus 5 est explicite — *"Start with `high`, the default"* — et ne recommande plus de démarrer en `xhigh` comme le faisait la génération Opus 4.7/4.8. Monter à `xhigh` reste justifié pour le codage/agentique le plus exigeant (long-horizon, ampleur XL, correctness critique), et à `max` pour les phases de conception les plus dures. Ne pas appliquer `xhigh` par défaut à l'ensemble des tâches comme le faisait l'ancienne version de cette fiche.

- **Sonnet 5** — features CRUD, frontend, SEO, intégrations, tests, dataviz (la majorité). Défaut `high` ; `xhigh` pour les tâches les plus dures de ce lot.
- **Opus 5** — algorithmique, structurel/migration, sécurité, ML, juridique. Défaut `high` ; `xhigh`/`max` réservés aux tâches qui le justifient réellement (conception XL, sécurité critique).
- **Haiku 4.5** — config mécanique, edits triviaux, volume délégué. Pas de réglage d'effort disponible.
- **Fable 5** — escalade ponctuelle sur la conception des problèmes les plus durs (ENG-2, CV-6, PLAT-4) si Opus cale. Défaut `high`, `xhigh` pour les workloads les plus sensibles à la capacité.

*Vérifié le 2026-08-03 sur [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) (section « Choosing a model ») et [platform.claude.com/docs/en/build-with-claude/effort](https://platform.claude.com/docs/en/build-with-claude/effort) (recommandations par modèle).*

---

## 4. Recommandations et commandes par tâche

Chaque tâche : `Modèle · effort CC · charge (S/M/L/XL)` — justification — commande à coller.
Statut `(livré)` = déjà présent dans le repo (réf. [tasks/todo.md](archive/todo.md), archivé / commits) ; la commande reste donnée pour référence/itération.

### P0 — Lancer ce qui existe

#### Epic GTM-A — Surface commerciale

**GTM-1 · Sonnet 5 · effort medium · (S)** — Câblage metadata/favicon/OG, mécanique. Passer à Opus 4.8 / `high` si génération d'un mark SVG original.

```text
/model sonnet
/effort medium
Câble l'identité visuelle minimale (BACKLOG GTM-1) : favicon, icônes PWA dans manifest.ts, et image OpenGraph par défaut dans les metadata Next d'apps/web. Utilise les assets d'apps/web/public ; si aucun logo n'existe, génère un mark SVG sobre "Chiffréo". Vérifie: build web + présence des balises og:image/favicon.
```

**GTM-2 · Opus 4.8 · effort xhigh · (M)** *(livré)* — Copie marketing + intuitions design + frontend d'un bloc.

```text
/model opus
/effort xhigh
Réécris la landing apps/web/src/app/page.tsx (BACKLOG GTM-2) en page vendeuse : hero avec promesse chiffrée (15-25% d'économie), démo visuelle du parcours photo→travaux→quantités→liste, section preuve honnête, bandeau artisans, aperçu tarifs, CTA "essayer sans compte" branché sur le mode invité existant (startGuestSession). Ne touche pas la logique invité. Cadre le style (évite serif/cream générique). Vérifie: build + tests web + lint.
```

**GTM-3 · Sonnet 5 · effort xhigh · (M)** *(livré)* — Frontend + SEO + CTA checkout auth-aware.

```text
/model sonnet
/effort xhigh
Crée la page publique /pricing (BACKLOG GTM-3) : page serveur statique comparant Free/Pro/Contractor, metadata + canonical + JSON-LD SoftwareApplication/AggregateOffer, données depuis un module partagé (pricing.ts), CTA auth-aware (connecté → checkout via price_id ; anonyme → /register). Ajoute l'entrée sitemap. Vérifie: build + tests + lint + rendu statique.
```

**GTM-4 · Sonnet 5 · effort xhigh · (L)** *(livré)* — Feature multi-fichiers (API + web + tests), patterns connus. Escalade Opus 4.8 si run très autonome souhaité.

```text
/model sonnet
/effort xhigh
Implémente le lead magnet calculateurs publics (BACKLOG GTM-4) : endpoint public POST /public/calculators/estimate (sans auth, DTO strict, throttling anti-abus, réutilise le moteur sans persister) + pages SSG /calculateurs et /calculateurs/[type] (peinture, carrelage, sol) avec metadata/JSON-LD FAQ + CTA "sauvegarder mon projet" → conversion invité. Commence en plan mode. Vérifie: tests API + web, build, lint.
```

**GTM-5 · Sonnet 5 · effort xhigh · (M)** *(livré)* — Intégration provider transactionnel + templating.

```text
/model sonnet
/effort xhigh
Ajoute l'envoi du résultat par e-mail sur le lead magnet (BACKLOG GTM-5) : intègre un provider transactionnel (Brevo ou Resend) via une abstraction, template du récap d'estimation, capture d'e-mail sur les pages /calculateurs, respect RGPD (consentement). Variables d'env + fail-safe si non configuré. Vérifie: tests + build + lint.
```

**GTM-6 · Opus 4.8 · effort xhigh · (M)** *(livré)* — Rédaction juridique FR : rigueur et qualité de prose. Relecture juriste requise.

```text
/model opus
/effort xhigh
Rédige et intègre les pages CGU, CGV et mentions légales (BACKLOG GTM-6), sur le modèle de apps/web/src/app/privacy/page.tsx : contenu FR conforme (vente d'abonnement en France, droit de rétractation, données société), routes + liens footer + sitemap. Ajoute un bandeau "à faire relire par un juriste". Vérifie: build + lint.
```

#### Epic OPS-A — Mise en production

**OPS-1 · Sonnet 5 · effort xhigh · (M)** — Config Caddy/compose/DNS ; le provisioning matériel reste manuel.

```text
/model sonnet
/effort xhigh
Aide-moi à provisionner la prod (BACKLOG OPS-1) en suivant docs/DEPLOY.md : génère/valide le Caddyfile (chiffreo.fr + api.chiffreo.fr, TLS auto), vérifie docker-compose.prod.yml, et produis une checklist pas-à-pas des étapes manuelles (VPS Hetzner/OVH 8 Go, DNS). N'exécute rien de destructif. Vérifie: docker compose config.
```

**OPS-2 · Haiku 4.5 · effort défaut · (S)** — Remplissage d'env + config, mécanique. Escalade Sonnet 5 / `xhigh` pour débugger un webhook.

```text
/model haiku
Guide la création des produits Stripe réels + webhook (BACKLOG OPS-2) : liste les 4 prix à créer (Pro, Contractor ×3), les variables STRIPE_*_PRICE_ID à renseigner d'après plans.constants.ts, l'URL d'endpoint webhook et les événements à activer. Produis la checklist de test d'un cycle abonnement/annulation. Ne stocke aucun secret en clair dans le repo.
```

**OPS-3 · Sonnet 5 · effort high · (S)** — Scripts backup + test de restauration : risque de perte de données.

```text
/model sonnet
/effort high
Fiabilise les sauvegardes (BACKLOG OPS-3) : script cron pg_dump chiffré + rotation, sauvegarde du volume uploads, et surtout un script/procédure de RESTAURATION testée sur une base jetable. Documente la procédure. Vérifie: dry-run du script de restauration sur une DB de test.
```

**OPS-4 · Sonnet 5 · effort xhigh · (M)** — Pipeline GitHub Actions CD.

```text
/model sonnet
/effort xhigh
Ajoute le déploiement continu (BACKLOG OPS-4) : job GitHub Actions qui, sur tag, build les images api/web, les pousse vers un registry, puis déploie sur le VPS (SSH + docker compose pull/up). Réutilise .github/workflows/ci.yml. Secrets via GitHub. Vérifie: lint du workflow + dry-run.
```

**OPS-5 · Sonnet 5 · effort xhigh · (M)** — Intégration Sentry + alerting.

```text
/model sonnet
/effort xhigh
Ajoute un monitoring minimal (BACKLOG OPS-5) : Sentry côté API et web (erreurs + traces de base), alerte sur healthcheck en échec et sur webhook Stripe en échec. Variables d'env, no-op si non configuré. Vérifie: build + tests + lint.
```

#### Epic DATA-A — Instrumentation du funnel

**DATA-1 · Sonnet 5 · effort xhigh · (M)** — Extension du module analytics existant.

```text
/model sonnet
/effort xhigh
Étends le module analytics (apps/api/src/analytics/) pour tracer le funnel complet (BACKLOG DATA-1) : visite calculateur → création de compte → 1re estimation → liste générée → checkout. Événements typés, non bloquants, respect vie privée. Vérifie: tests API + build + lint.
```

**DATA-2 · Sonnet 5 · effort xhigh · (M)** — Requêtes + dashboard (dataviz).

```text
/model sonnet
/effort xhigh
Construis le tableau de bord North Star (BACKLOG DATA-2) à partir des événements DATA-1 : requêtes pour listes générées/semaine, conversion par marche du funnel, MRR par tier, et une page dashboard simple. Applique le skill dataviz pour les graphiques. Vérifie: build + tests + lint.
```

#### Epic CV-A — Combler l'écart silencieux

**CV-1 · Opus 4.8 · effort xhigh · (L)** — ML : sourcing/fine-tuning YOLOv8n + éval. Fable 5 si l'entraînement/éval devient réellement ardu.

```text
/model opus
/effort xhigh
Comble le trou du modèle portes/fenêtres (BACKLOG CV-1) : le fichier models/door-window-yolov8n.pt est absent (fallback heuristique silencieux). Évalue les datasets publics portes/fenêtres, propose un plan (modèle pré-entraîné vs fine-tuning YOLOv8n), écris les scripts d'entraînement/éval et le versionnement des poids en artefact (hors git). Commence en plan mode ; l'entraînement lui-même tournera séparément.
```

**CV-2 · Sonnet 5 · effort xhigh · (M)** — Job d'analyse d'écart médian sur logs.

```text
/model sonnet
/effort xhigh
Implémente la mesure de précision CV (BACKLOG CV-2) : job qui calcule l'écart médian entre dimensions CV et corrections utilisateur depuis cv_correction_logs, par type de dimension, avec export exploitable. Prérequis de toute com sur la précision. Vérifie: tests + build + lint.
```

### P1 — Crédibiliser la promesse de précision

#### Epic ENG-A — Lever les limites du moteur

**ENG-1 · Opus 4.8 · effort xhigh · (L)** — Géométrie par composition de rectangles : correctness algorithmique, moteur + UI.

```text
/model opus
/effort xhigh
Supporte les pièces non rectangulaires (BACKLOG ENG-1) : gère les formes en L/T par composition de rectangles dans le moteur d'estimation, avec saisie guidée ("votre pièce a-t-elle un décroché ?"). Couvre surfaces murs/sol/plafond. Commence en plan mode. Ajoute des tests unitaires du moteur sur des formes composées. Vérifie: tests + build + lint.
```

**ENG-2 · Opus 4.8 · effort max · (XL)** — Changement structurel entités + moteur + liste. Fable 5 pour la conception si l'agrégation se révèle très complexe. Redescendre en `xhigh` pour l'implémentation.

```text
/model opus
/effort max
Conçois puis implémente le multi-pièces par projet (BACKLOG ENG-2) : aujourd'hui 1 projet = 1 pièce. Permets N pièces avec agrégation des quantités (mutualisation des pots de peinture entre pièces = cœur de la promesse). Touche entités projet + moteur + liste d'achats + migration. Commence par un plan d'architecture et de migration détaillé dans tasks/todo.md avant tout code. Vérifie: tests + build + lint + migration réversible.
```

**ENG-3 · Sonnet 5 · effort xhigh · (M)** — Déduction manuelle simple.

```text
/model sonnet
/effort xhigh
Ajoute les surfaces à exclure (BACKLOG ENG-3) : déduction manuelle de zones non traitées (crédence, demi-mur, plinthes) sur les surfaces d'une pièce, répercutée sur les quantités. UI de saisie simple + prise en compte moteur. Vérifie: tests + build + lint.
```

**ENG-4 · Sonnet 5 · effort xhigh · (M)** — Tests E2E API, méthodique.

```text
/model sonnet
/effort xhigh
Écris les tests E2E du parcours critique (BACKLOG ENG-4) : projet → dimensions → estimation → liste d'achats, en E2E côté API (aligne-toi sur les E2E auth/projects existants). Couvre les cas nominaux et limites. Vérifie: la suite E2E passe en CI.
```

**ENG-5 · Opus 4.8 · effort xhigh · (M)** — Réconciliation rendements/pertes vs fiches fabricants (web) : un facteur faux casse la promesse.

```text
/model opus
/effort xhigh
Étalonne le catalogue (BACKLOG ENG-5) : vérifie les rendements et facteurs de perte seedés contre les fiches techniques fabricants (recherche web) et signale les écarts. Produis un tableau source→valeur seedée→valeur recommandée avec justification par matériau × pose. Ne modifie les seeds qu'après validation. Vérifie: tests moteur inchangés au vert.
```

#### Epic CV-B — Fiabiliser l'analyse photo

**CV-3 · Opus 4.8 · effort xhigh · (L)** — Algo de calibration (A4/carte) + guidage UI.

```text
/model opus
/effort xhigh
Ajoute une calibration par objet étalon universel (BACKLOG CV-3) : aujourd'hui la calibration dépend d'une porte détectée (~204 cm). Permets un étalon utilisateur (feuille A4 ou carte bancaire posée au mur), guidé par l'UI, pour débloquer les photos sans porte. Touche cv-service + UI de capture. Commence en plan mode. Vérifie: tests CV + build.
```

**CV-4 · Sonnet 5 · effort xhigh · (M)** — Écran de conseils + rejet photos.

```text
/model sonnet
/effort xhigh
Ajoute le guidage de prise de vue (BACKLOG CV-4) : écran de conseils avant capture (angles, recul, lumière, porte visible) + rejet des photos inexploitables avec explication. Améliore la précision sans toucher au modèle. Vérifie: tests + build + lint.
```

**CV-5 · Sonnet 5 · effort xhigh · (M)** — Intervalles de confiance + propagation quantités.

```text
/model sonnet
/effort xhigh
Affiche des intervalles de confiance (BACKLOG CV-5) : "4,2 m ± 15 cm" au lieu d'une valeur sèche, avec répercussion sur les quantités (fourchette basse/haute) dans la liste. Propagation depuis les incertitudes CV. Vérifie: tests + build + lint.
```

**CV-6 · Opus 4.8 · effort max · (XL)** — Pipeline de ré-entraînement ML long-horizon. Fable 5 pour l'orchestration éval/training la plus délicate. Redescendre en `xhigh` pour l'implémentation.

```text
/model opus
/effort max
Conçois puis implémente la boucle de ré-entraînement CV (BACKLOG CV-6) : pipeline périodique corrections (cv_correction_logs) + photos → dataset → fine-tuning → éval → déploiement des poids. Première brique réelle du "learns from real projects". Commence par un plan d'architecture (stockage, déclenchement, garde-fous d'éval anti-régression) dans tasks/todo.md avant tout code. Dépend de CV-1 et CV-2.
```

**CV-7 · Sonnet 5 · effort xhigh · (M)** — Jeu d'images de référence + assertions CI.

```text
/model sonnet
/effort xhigh
Ajoute des tests de non-régression CV (BACKLOG CV-7) : jeu d'images de référence à dimensions connues + assertion d'écart max dans la CI du cv-service (aucun test aujourd'hui). Vérifie: la suite tourne et échoue si l'écart dépasse le seuil.
```

### P2 — Monétiser et fidéliser

#### Epic BUY-A — Prix réels et affiliation

**BUY-1 · Opus 4.8 · effort xhigh · (L)** — Adaptateur réel + matching catalogue→produits : correctness d'intégration.

```text
/model opus
/effort xhigh
Implémente le premier adaptateur d'affiliation ManoMano (BACKLOG BUY-1) dans le registre existant (apps/api/src/price-comparison/adapters/supplier-registry.ts) via le flux produits du programme d'affiliation. Matching catalogue→produits marchands, suppression des mocks CAD. Commence en plan mode (stratégie de matching). Vérifie: tests + build + lint.
```

**BUY-2 · Sonnet 5 · effort medium · (S)** — Bascule de gate + QA. `high` si la QA du parcours est fouillée.

```text
/model sonnet
/effort medium
Réactive la feature gate price_comparison (BACKLOG BUY-2), désactivée en migration 027, une fois BUY-1 en place. QA du parcours comparaison → application à la liste. Vérifie: tests + build + lint.
```

**BUY-3 · Sonnet 5 · effort xhigh · (M)** — Lien affilié par ligne.

```text
/model sonnet
/effort xhigh
Ajoute des liens d'achat commissionnés sur la liste (BACKLOG BUY-3) : chaque ligne de la liste d'achats → lien affilié "acheter chez X" (y compris tier Free). Génération des liens depuis l'adaptateur BUY-1. Vérifie: tests + build + lint.
```

**BUY-4 · Sonnet 5 · effort xhigh · (L)** — Second adaptateur sur pattern établi → réplication.

```text
/model sonnet
/effort xhigh
Ajoute un deuxième adaptateur d'enseigne (Leroy Merlin ou Castorama) (BACKLOG BUY-4) en suivant le pattern de l'adaptateur ManoMano (BUY-1). La comparaison n'a de valeur qu'à ≥ 2 sources réelles. Vérifie: tests + build + lint.
```

#### Epic PRO-A — Justifier les paliers Contractor

**PRO-1 · Sonnet 5 · effort xhigh · (M)** — Feature gates sur mécanique existante.

```text
/model sonnet
/effort xhigh
Différencie les paliers Contractor 50/100/200 € (BACKLOG PRO-1), aujourd'hui identiques : gate Essentiel = devis+clients ; Standard = + suivi chantier + relances ; Premium = + multi-utilisateurs + API. Réutilise les feature gates existantes. Vérifie: tests + build + lint.
```

**PRO-2 · Sonnet 5 · effort xhigh · (L)** — Feature statuts/jalons multi-écrans, patterns connus.

```text
/model sonnet
/effort xhigh
Ajoute le suivi de chantier + timeline (BACKLOG PRO-2) : statuts d'avancement par projet client, jalons, dates prévues/réelles. Différenciateur Standard (gate PRO-1). Commence en plan mode. Vérifie: tests + build + lint.
```

**PRO-3 · Sonnet 5 · effort xhigh · (M)** — Scheduling + e-mail.

```text
/model sonnet
/effort xhigh
Ajoute les relances devis (BACKLOG PRO-3) : rappels automatiques sur devis "envoyé" sans réponse à J+7/J+14 (e-mail au client via le provider GTM-5, notification à l'artisan). Vérifie: tests + build + lint.
```

**PRO-4 · Opus 4.8 · effort xhigh · (L)** — Mentions légales FR, numérotation, conformité e-invoicing.

```text
/model opus
/effort xhigh
Implémente devis → facture (BACKLOG PRO-4) : conversion d'un devis accepté en facture avec mentions légales françaises et numérotation conforme. Évalue d'abord la conformité e-invoicing 2026-2027 et documente les contraintes avant de construire. Commence en plan mode. Vérifie: tests + build + lint.
```

**PRO-5 · Sonnet 5 · effort xhigh · (M)** — Frontend/UX mobile. Opus 4.8 si travail design poussé.

```text
/model sonnet
/effort xhigh
Optimise le parcours "devis-minute" mobile (BACKLOG PRO-5) : enchaînement photo → estimation → devis PDF en < 10 min sur mobile chez le client. Pitch n°1 du tier Contractor. Dépend de CV-4. Vérifie: tests + build + lint + rendu mobile.
```

#### Epic COM-A — Communauté comme canal d'acquisition

**COM-1 · Sonnet 5 · effort xhigh · (M)** — Attache liste d'achats aux partages.

```text
/model sonnet
/effort xhigh
Attache les coûts réels aux projets partagés (BACKLOG COM-1) : liste d'achats (quantités + coût final réel) rattachée aux partages communauté. Angle "exact material costs". Vérifie: tests + build + lint.
```

**COM-2 · Sonnet 5 · effort xhigh · (M)** — Galerie publique + SEO.

```text
/model sonnet
/effort xhigh
Rends la galerie communauté approuvée publique et indexable (BACKLOG COM-2) : accès sans compte + SEO (ex. "coût réel carrelage salle de bain 8 m²"). UGC = acquisition gratuite. Metadata + sitemap. Vérifie: tests + build + lint + rendu statique.
```

**COM-3 · Sonnet 5 · effort xhigh · (M)** — Parrainage sur Stripe existant.

```text
/model sonnet
/effort xhigh
Ajoute le parrainage (BACKLOG COM-3) : "1 mois Pro offert par filleul abonné", mécanique simple sur la base Stripe existante (codes/attribution + crédit). Dépend d'OPS-2. Vérifie: tests + build + lint.
```

#### Epic PLAT-A — Rétention

**PLAT-1 · Sonnet 5 · effort xhigh · (L)** — Modèle de données + feature, patterns connus.

```text
/model sonnet
/effort xhigh
Implémente le carnet du logement (BACKLOG PLAT-1) : historique persistant par pièce (dimensions validées, teintes/matériaux utilisés, dates). Raison de rester abonné entre deux chantiers. Dépend d'ENG-2. Commence en plan mode. Vérifie: tests + build + lint.
```

**PLAT-2 · Sonnet 5 · effort xhigh · (M)** — Scheduling + templating sur provider GTM-5.

```text
/model sonnet
/effort xhigh
Ajoute les e-mails de cycle de vie (BACKLOG PLAT-2) : onboarding J+1/J+3, projet abandonné à mi-parcours, fin d'essai Pro. Provider GTM-5 + déclencheurs sur événements DATA-1. Vérifie: tests + build + lint.
```

**PLAT-3 · Sonnet 5 · effort xhigh · (L)** — Extension catalogue + UI bornée.

```text
/model sonnet
/effort xhigh
Ajoute le module éco-matériaux (BACKLOG PLAT-3) : alternatives durables dans le catalogue (badge + filtre + équivalences), intégré au tier Pro. Vérifie: tests + build + lint.
```

### P3 — Étendre

#### Epic PLAT-B — Fondations enterprise

**PLAT-4 · Opus 4.8 · effort max · (XL)** — Migration structurante, à concevoir soigneusement. Fable 5 pour la phase de conception — problème le plus dur du backlog. Redescendre en `xhigh` pour l'implémentation.

```text
/model opus
/effort max
Conçois puis implémente le modèle organisations/membres/rôles (BACKLOG PLAT-4) : entités organizations/memberships, propriété des projets/clients/devis transférée à l'org. Prérequis de Contractor Premium ET de l'enterprise. Migration structurante : commence par une conception détaillée (schéma, stratégie de migration des données existantes, réversibilité, impacts) dans tasks/todo.md avant tout code. Vérifie: tests + build + lint + migration testée.
```

**PLAT-5 · Opus 4.8 · effort xhigh · (L)** — Sécurité/auth : clés API, quotas.

```text
/model opus
/effort xhigh
Implémente l'API publique + clés (BACKLOG PLAT-5) : endpoints d'estimation documentés, clés API, quotas par tier. Sécurité critique (auth, rate limiting, rotation). Dépend de PLAT-4. Commence en plan mode. Vérifie: tests + build + lint + revue sécurité.
```

**PLAT-6 · Opus 4.8 · effort xhigh · (XL)** — SSO SAML/OIDC, sécurité critique. Prépends `ultrathink` sur la conception de la fédération d'identité.

```text
/model opus
/effort xhigh
Implémente l'offre Enterprise (BACKLOG PLAT-6) : SSO SAML/OIDC, facturation annuelle sur devis, SLA, environnement dédié éventuel. Sécurité critique. Commence par ultrathink sur la conception de la fédération d'identité et l'isolation par org, dans tasks/todo.md. Dépend de PLAT-4/5. Vérifie: tests + build + lint + revue sécurité.
```

**PLAT-7 · Sonnet 5 · effort xhigh · (L)** — Frontend + embedding, patterns connus.

```text
/model sonnet
/effort xhigh
Implémente le widget d'estimation marque blanche (BACKLOG PLAT-7) : calculateur embarquable chez des médias/marchands, brandé "powered by Chiffréo", s'appuyant sur l'API publique PLAT-5. Isolation CSS/JS + intégration. Vérifie: tests + build + lint.
```

#### Epic MOB-A — Mobile

**MOB-1 · Sonnet 5 · effort xhigh · (M)** — Service worker web standard.

```text
/model sonnet
/effort xhigh
Ajoute un service worker PWA (BACKLOG MOB-1) : installation réelle + cache offline des projets consultés (le manifest existe déjà, sans SW). Stratégie de cache prudente. Vérifie: build + audit PWA (installable, offline).
```

**MOB-2 · Opus 4.8 · effort xhigh · (XL)** — Greenfield natif long-horizon réutilisant l'API.

```text
/model opus
/effort xhigh
Démarre l'app native React Native/Expo (BACKLOG MOB-2), à ne lancer que si les métriques PWA le justifient : réutilise l'API telle quelle, parcours photo→estimation→liste, caméra. Commence en plan mode (architecture, partage de code, navigation). Vérifie: build + tests de base.
```

#### Epic INTL-A — International

**INTL-1 · Sonnet 5 · effort xhigh · (XL)** — Refactor mécanique massif : suivi littéral + coût maîtrisé au volume. Faire orchestrer par Opus 4.8 et déléguer le volume à des sous-agents Haiku 4.5.

```text
/model sonnet
/effort xhigh
Pose la fondation i18n (BACKLOG INTL-1) : extraction des chaînes en dur (~60 fichiers) vers next-intl + gestion des devises. Commence par un plan d'extraction et une convention de clés, puis délègue le volume répétitif à des sous-agents (Haiku) fichier par fichier, en vérifiant la cohérence. Vérifie: build + tests + lint + aucune chaîne en dur restante.
```

**INTL-2 · Opus 4.8 · effort xhigh · (XL)** — Large et transverse, nombreuses décisions couplées.

```text
/model opus
/effort xhigh
Ouvre le marché nord-américain (BACKLOG INTL-2) : catalogue matériaux US/CA, unités impériales par défaut (base dans apps/web/src/lib/units.ts), affiliation Home Depot/Lowe's réelle, fiscalité. Dépend d'INTL-1. Commence en plan mode. Vérifie: tests + build + lint.
```

#### Epic DATA-B — Flywheel complet

**DATA-3 · Opus 4.8 · effort xhigh · (L)** — Raisonnement statistique qui impacte le moteur.

```text
/model opus
/effort xhigh
Implémente les facteurs de perte appris (BACKLOG DATA-3) : ajuste les facteurs de perte du catalogue à partir des écarts estimé/acheté réels (budget tracking) par matériau × pose × niveau. Méthode statistique robuste + garde-fous (bornes, volume minimal). Dépend de DATA-1 et ENG-5. Vérifie: tests moteur + build + lint.
```

**DATA-4 · Sonnet 5 · effort xhigh · (L)** — Feature data + confidentialité, agrégation connue.

```text
/model sonnet
/effort xhigh
Ajoute le benchmark de coûts anonymisé (BACKLOG DATA-4) : "Votre projet coûte X % de moins que la médiane des projets similaires". Agrégation anonymisée (k-anonymat, seuils de volume). Dépend de COM-1 et DATA-3. Vérifie: tests + build + lint.
```

---

## 5. Synthèse

| Modèle | Tâches (primaire) | Effort CC dominant | Escalade / repli |
|---|---|---|---|
| **Sonnet 5** | 28 | `xhigh` | ↑ Opus 4.8 si correctness/ampleur ; ↓ Haiku pour bascule seule |
| **Opus 4.8** | 17 | `xhigh` (`max` sur conception XL) | ↑ Fable 5 pour la conception la plus dure (ENG-2, CV-6, PLAT-4) |
| **Haiku 4.5** | 1 | défaut/`medium` | ↑ Sonnet 5 `xhigh` dès qu'il faut débugger |
| **Fable 5** | 0 (escalade) | `max` / `ultrathink` | Candidats : ENG-2, CV-1, CV-6, PLAT-4 |

**Règles d'usage transverses** :
- `xhigh` est le défaut de travail pour tout codage/agentique ; `medium` pour le mécanique ; `max`/`ultrathink` pour la conception des XL structurels.
- Pour le long-horizon (L/XL), donner la spécification complète au premier tour ; laisser Opus 4.8 / Fable 5 planifier avant de coder.
- Sur le refactor massif (INTL-1), orchestrer et déléguer le volume à des sous-agents Haiku 4.5.
- Fable 5 n'est pas un upgrade par défaut : coût élevé, rétention 30 j, refus possibles — réservé aux tâches réellement les plus dures.
