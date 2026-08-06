# Modèles Claude × Backlog Chiffréo

> **Objet** : quel modèle Claude et quel niveau d'effort utiliser dans Claude Code, et comment les régler. Les recommandations par tâche vivent désormais dans le backlog courant ([BACKLOG_V1.md](BACKLOG_V1.md)), pas dans ce document.
> **Sources modèles** : documentation officielle Anthropic, revérifiée le 2026-08-06 (liens et lignes « vérifié le » sous chaque tableau).
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

L'alias `opus` résout vers **Opus 5** sur l'API Anthropic depuis Claude Code ≥ v2.1.219 (avant cette version il résolvait vers Opus 4.8 — ne pas se fier à cette ancienne association si un environnement tourne encore sur une version antérieure). `sonnet` résout vers Sonnet 5, `haiku` vers Haiku 4.5, `fable` vers Fable 5. Ces alias dépendent du provider (Bedrock/Foundry/Vertex peuvent résoudre vers une version antérieure) — sur ce projet on est sur l'API Anthropic directe.

Mythos 5 (`claude-mythos-5`) existe dans le catalogue Anthropic mais reste en accès restreint via le programme **Project Glasswing** : il n'a pas d'alias `/model` public et est hors de portée pour ce projet tant que l'accès n'est pas accordé.

*Vérifié le 2026-08-06 sur [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config).*

### Effort de raisonnement — `/effort`

- `/effort low | medium | high | xhigh | max` — règle l'effort pour la session. `low`/`medium`/`high`/`xhigh` persistent entre sessions une fois réglés en interactif ; `max` est limité à la session en cours (sauf via la variable d'environnement).
- `/effort` seul — ouvre un slider ; `/effort auto` — revient au défaut du modèle.
- Dans le sélecteur `/model` — flèches gauche/droite pour ajuster l'effort.
- Au lancement — flag `--effort <niveau>` ; variable `CLAUDE_CODE_EFFORT_LEVEL` (prioritaire sur tout le reste) ; réglage `effortLevel` dans les settings (`max` et `ultracode` non acceptés dans ce champ).
- Mot-clé `ultrathink` dans le prompt — **ne change pas le niveau d'effort envoyé à l'API**. Claude Code se contente d'ajouter une instruction de raisonnement plus approfondi dans le contexte, pour ce tour uniquement ; le paramètre `effort` de la requête API reste celui réglé par `/effort`.
- `ultracode` (via `/effort ultracode` ou `--effort ultracode`) — envoie l'effort `xhigh` et fait en plus orchestrer des workflows multi-agents par Claude Code pour les tâches substantielles. Réglage Claude Code, pas un niveau `effort` de l'API ; session uniquement.

**Niveaux d'effort disponibles par modèle** :

| Modèle | Niveaux supportés |
|---|---|
| Fable 5 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 5, Sonnet 5 | `low`, `medium`, `high`, `xhigh`, `max` |
| Haiku 4.5 | **aucun** — le paramètre `effort` n'est pas supporté sur ce modèle |

*Vérifié le 2026-08-06 sur [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config) (tableau « Adjust effort level »).*

**Défauts et repères** :
- L'effort par défaut est `high` sur tous les modèles qui le supportent (Fable 5, Opus 5, Sonnet 5).
- **L'échelle d'effort est calibrée par modèle** : un `high` ou un `xhigh` n'a pas le même coût ni le même comportement d'un modèle à l'autre — ne pas transposer un réglage d'un modèle à un autre sans le revérifier.
- Sur **Opus 5**, partir de `high` (le défaut) et monter à `xhigh` pour du codage/agentique exigeant. C'est un changement de posture par rapport à Opus 4.7/4.8, dont la doc recommandait de démarrer directement en `xhigh` pour le codage — cette recommandation ne s'applique plus à Opus 5.
- Sur **Sonnet 5**, même logique : défaut `high`, `xhigh` réservé aux tâches de codage/agentique les plus dures, `medium` en repli économique.
- Sur **Haiku 4.5**, la notion d'effort ne s'applique pas.
- **`max` est déconseillé par la documentation officielle** en usage courant : coût et latence les plus élevés pour un gain marginal dans la plupart des cas. Ne pas en faire un réglage par défaut, y compris pour des tâches volumineuses ou structurantes — préférer `xhigh`, et réserver `max` aux cas où la doc elle-même le justifie explicitement.

*Vérifié le 2026-08-06 sur [platform.claude.com/docs/en/build-with-claude/effort](https://platform.claude.com/docs/en/build-with-claude/effort).*

> Conventions des prompts : ils supposent le workflow de [CLAUDE.md](../CLAUDE.md) (plan mode pour le non-trivial, vérification build/tests/lint).

---

## 2. Comparatif des modèles

| Modèle | ID API | Alias `/model` | Contexte · sortie max | Coupure de connaissances fiable | Prix ($/MTok in-out) |
|---|---|---|---|---|---|
| **Fable 5** | `claude-fable-5` | `fable` | 1M · 128K | Janvier 2026 | 10 / 50 |
| **Opus 5** | `claude-opus-5` | `opus` | 1M · 128K | Mai 2026 | 5 / 25 |
| **Sonnet 5** | `claude-sonnet-5` | `sonnet` | 1M · 128K | Janvier 2026 | 2 / 10 jusqu'au 31 août 2026, puis 3 / 15 |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | `haiku` | 200K · 64K | **Février 2025** | 1 / 5 |
| Mythos 5 *(accès restreint)* | `claude-mythos-5` | — | 1M · 128K | — | — |

Mythos 5 existe dans le catalogue mais n'est accessible qu'en accès restreint via **Project Glasswing** — hors de portée pour ce projet tant que l'accès n'est pas accordé ; mentionné pour mémoire uniquement, à ne pas utiliser dans les commandes.

**Écueils** :
- **Fable 5** — le plus cher ; réservé aux workloads les plus longs/durs ; refus possibles sur les domaines cybersécurité/biologie.
- **Opus 5** — coût > Sonnet ; pas de repli max en cas de flag biologie (contrairement à Fable 5).
- **Sonnet 5** — prix d'intro à 2/10 $ jusqu'au 31 août 2026, puis 3/15 $ (tarif « standard »).
- **Haiku 4.5** — **ne supporte pas le paramètre `effort`** ; coupure de connaissances fiable la plus ancienne du lineup actuel (février 2025, contre 2026 pour les autres) ; plafond de capacité plus bas ; contexte 200K.

Générations précédentes encore actives (à épingler seulement pour figer un comportement) : Opus 4.8/4.7/4.6, Sonnet 4.6.

*Vérifié le 2026-08-06 sur [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) et [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing).*

---

## 3. Logique de sélection

Prendre **le modèle le moins cher qui tient la tâche**, monter d'un cran dès que la *correctness*, l'ampleur multi-fichiers ou l'horizon long le justifient. Ne jamais descendre pour économiser sur une tâche à fort enjeu (sécurité, données, juridique, migration).

**Sur l'effort : partir de `high` (le défaut), pas de `xhigh`.** La doc officielle d'Opus 5 est explicite — *"Start with `high`, the default"* — et ne recommande plus de démarrer en `xhigh` comme le faisait la génération Opus 4.7/4.8. Monter à `xhigh` reste justifié pour le codage/agentique le plus exigeant (long-horizon, ampleur XL, correctness critique). `max` est déconseillé par la doc en usage courant (voir section 1) : ne pas l'appliquer par défaut, même sur les tâches structurantes les plus larges.

- **Sonnet 5** — features CRUD, frontend, SEO, intégrations, tests, dataviz (la majorité des tâches). Défaut `high` ; `xhigh` pour les plus dures de ce lot.
- **Opus 5** — algorithmique, structurel/migration, sécurité, ML, juridique. Défaut `high` ; `xhigh` réservé aux tâches qui le justifient réellement.
- **Haiku 4.5** — config mécanique, edits triviaux, volume délégué. Pas de réglage d'effort disponible.
- **Fable 5** — escalade ponctuelle sur la conception des problèmes les plus durs, si Opus 5 cale. Défaut `high`, `xhigh` pour les workloads les plus sensibles à la capacité.

Pour l'assignation modèle/effort d'une tâche donnée, se référer au backlog courant ([BACKLOG_V1.md](BACKLOG_V1.md)) plutôt qu'à une liste figée dans ce document.

*Vérifié le 2026-08-06 sur [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) (section « Choosing a model ») et [platform.claude.com/docs/en/build-with-claude/effort](https://platform.claude.com/docs/en/build-with-claude/effort) (recommandations par modèle).*
