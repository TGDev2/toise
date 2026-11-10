# Entraînement du détecteur portes/fenêtres (BACKLOG CV-1)

Toolkit pour produire `models/door-window-yolov8n.pt`, le modèle YOLOv8n
fine-tuné qui remplace l'heuristique OpenCV de `app/services/opening_detector.py`.
Contrat runtime (figé dans le code) : 2 classes `{0: door, 1: window}`, seuil
de confiance 0,3, photos d'intérieur, inférence CPU.

## Décisions (résumé — détail dans tasks/todo.md CV-1)

**Pré-entraîné vs fine-tuning : fine-tuning de `yolov8n.pt` (COCO).** Aucun
modèle public porte+fenêtre n'existe avec une licence commerciale claire ET le
contrat 2 classes du code. Le transfert COCO converge vite sur ~7k images ;
yolov8n reste adapté à l'inférence CPU (limite 4 Go du conteneur).

**Datasets publics évalués :**

| Dataset | Volume | Licence | Verdict |
|---|---|---|---|
| Roboflow [doors-windows (windowsdoors)](https://universe.roboflow.com/windowsdoors-f281v/doors-windows-iliyz) | ~7,3k | CC BY 4.0 | ✅ cœur du corpus (2 classes exactes) |
| Roboflow [Doors and Windows (Paul Yi)](https://universe.roboflow.com/paul-yi-dyfev/doors-and-windows-ca836) | ~4,8k | CC BY 4.0 | ✅ renfort `--include-paul-yi` (stairs supprimée) |
| [Open Images V7](https://storage.googleapis.com/openimages/web/index.html) (Door/Window) | gros | CC BY 4.0 (annot.) | ⚠️ réserve `--include-open-images` (bruit véhicules/extérieurs) |
| Roboflow « Construction Plan » | 5,4k | CC BY 4.0 | ❌ plans 2D, mauvais domaine |
| [DoorDetect](https://github.com/MiguelARD/DoorDetect-Dataset) | 1,2k | aucune licence | ❌ risque juridique + pas de fenêtres |

CC BY 4.0 ⇒ attribution obligatoire : `prepare_dataset.py` la consigne dans
`DATASET_MANIFEST.json`, `evaluate.py` la reprend dans `MODEL_CARD.md`.

**Note licence framework** : `ultralytics` est sous **AGPL-3.0**. C'est une
dépendance runtime préexistante du service (à signaler en revue juridique du
produit) ; mitigation future possible : export ONNX + onnxruntime, hors
périmètre CV-1.

## Prérequis

```bash
cd apps/cv-service
python -m venv .venv && source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install torch==2.5.1+cpu torchvision==0.20.1+cpu --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt -r training/requirements-train.txt
export ROBOFLOW_API_KEY=...   # compte gratuit : app.roboflow.com → Settings → API Key
```

Sur machine GPU (recommandé pour l'entraînement réel) : installer le torch CUDA
adapté à la machine au lieu de `+cpu` ; le pin `ultralytics==8.4.101` reste
identique à `../requirements.txt` (interdit de dévier : skew train/serve).

## Cycle complet

```bash
# 1. Assembler le dataset (≈ 7-12k images) puis INSPECTER preview.jpg
python training/prepare_dataset.py --out datasets/door-window --preview 24

# 2. Fine-tuner (GPU : ~1h ; --device auto choisit cuda si dispo)
python training/train.py --data datasets/door-window/data.yaml \
    --epochs 100 --imgsz 640 --batch 16 --seed 42 \
    --out models/door-window-yolov8n.pt

# 3. Évaluer (verdict PASS/FAIL vs critères ci-dessous, code retour 2 si FAIL)
python training/evaluate.py --weights models/door-window-yolov8n.pt \
    --data datasets/door-window/data.yaml --images ~/photos-interieur/

# 4. Smoke test du chemin runtime réel
python training/smoke_test.py --weights models/door-window-yolov8n.pt

# 5. Publier (GitHub Release cv-model-vN, immuable)
./scripts/release-model.sh cv-model-v1 models/door-window-yolov8n.pt \
    training/reports/metrics.json training/reports/MODEL_CARD.md
```

Déploiement (VPS) : voir docs/DEPLOY.md — en résumé `scripts/fetch-model.sh
cv-model-v1` puis `docker compose -f docker-compose.prod.yml build cv-service
&& up -d cv-service`, contrôle `GET /health` → `"yolo": true`.

## Critères d'acceptation

« Assez bon pour remplacer l'heuristique » (vérifiés par `evaluate.py`) :

- mAP50 ≥ **0,65 par classe** (door ET window) sur le split test ;
- mAP50-95 global ≥ **0,40** ;
- précision ≥ **0,6 par classe** au seuil runtime conf=0,3 ;
- passe qualitative sur ~10 vraies photos d'intérieur (`--images`) : aucun
  échec grossier (ex. chaque pan de mur détecté comme porte).

Si FAIL, échelle d'itération dans l'ordre : plus d'epochs (150-200) →
`--include-paul-yi` → `--imgsz 960` → (dernier recours) `--include-open-images`
avec ré-inspection de la mosaïque.

## Dry-run CPU (validation du pipeline sans GPU)

```bash
python training/prepare_dataset.py --out datasets/dry-run --limit 20 --preview 12
python training/train.py --data datasets/dry-run/data.yaml --epochs 1 --batch 4
python training/evaluate.py --weights models/door-window-yolov8n.pt \
    --data datasets/dry-run/data.yaml --sweep 0.3
python training/smoke_test.py --make-dummy   # sans dataset ni entraînement
```

Les métriques d'un dry-run n'ont aucune valeur — il prouve seulement que le
pipeline tourne de bout en bout.

## Boucle de ré-entraînement (BACKLOG CV-6)

> **HORS SERVICE depuis E4-2.** Les deux seuls endpoints Toisé que cette
> boucle appelle — `GET /admin/cv-retraining/export` et
> `GET /admin/cv-retraining/photo?path=…` — ont été supprimés de l'API : aucun
> écran n'y menait, et la vision par ordinateur est débranchée (ADR 0001 D2),
> donc `cv_correction_logs` ne reçoit plus de valeur calculée à comparer.
>
> **Pour la remettre en service** : restaurer `apps/api/src/analysis/`
> `cv-retraining.{controller,service}.ts`, `dto/cv-retraining-query.dto.ts`,
> `PhotosService.findByStorageUrl` et `test/cv-retraining.e2e-spec.ts` depuis
> git (`git log -- apps/api/src/analysis/cv-retraining.service.ts`), puis
> réenregistrer le contrôleur dans `analysis.module.ts`. Le code Python
> ci-dessous n'a pas été touché et fonctionne tel quel une fois les routes
> rétablies.
>
> Ce retrait **ne touche pas** la condition de réouverture de D2 (ADR 0001
> §5.2) : elle porte sur 50 à 100 photos relevées au télémètre et gelées
> *avant* mesure, avec une erreur médiane sous 5 % — un protocole hors ligne,
> pas cette boucle d'apprentissage sur corrections de production. Le service
> qui calcule cette erreur médiane, `CvAccuracyService`, est **conservé**.

`training/retrain.py` automatise le cycle sur les **données réelles** :
corrections utilisateur (`cv_correction_logs`) + photos → dataset → fine-tuning
→ éval → publication. Elle tourne sur la machine d'entraînement (jamais le
VPS), typiquement en cron hebdomadaire.

### Prérequis (en plus du venv ci-dessus)

- `gh` authentifié (baseline + cutoff + release) ;
- une release `cv-model-vN` existante (la boucle exige une baseline — publier
  `cv-model-v1` via le cycle CV-1 d'abord) ;
- le dataset public préparé (`prepare_dataset.py`) ;
- un compte **admin dédié** à la boucle (rôle `admin` en base) et l'env :

```bash
export TOISE_API_URL=https://api.toise.fr/api/v1
export FIREBASE_WEB_API_KEY=...          # clé Web du projet Firebase
export TOISE_ADMIN_EMAIL=cv-retrain@toise.fr
export TOISE_ADMIN_PASSWORD=...
```

### Cycle

```bash
# Cron (ex. lundi 3h) — prépare, entraîne, évalue, puis S'ARRÊTE :
# 0 3 * * 1 cd /opt/toise/apps/cv-service && .venv/bin/python training/retrain.py --public-data datasets/door-window/data.yaml >> retrain.log 2>&1
python training/retrain.py --public-data datasets/door-window/data.yaml

# Revue humaine OBLIGATOIRE avant publication :
#   training/retrain/user-dataset/preview.jpg   — labels corrects ?
#   training/retrain/reports/comparison.json    — gains réels ?
#   USER_DATASET_MANIFEST.json (triage)         — suppressions à arbitrer ?
python training/retrain.py --public-data datasets/door-window/data.yaml --release
```

Déploiement ensuite : runbook docs/DEPLOY.md, inchangé.

### Garde-fous (dans l'ordre)

1. **Gate volume** : `< --min-new-images` (20) nouvelles images labellisées
   depuis la dernière release → cycle sauté (exit 0).
2. **Labels prudents** (`build_user_dataset.py`) : seuls les jobs
   `opening_detector == "yolo"` fournissent des labels ; validation implicite
   gated (job ≥ 7 jours, projet engagé, conf ≥ 0,5 pour les boîtes non
   corrigées) ; correction de type → classe réécrite ; **suppression → jamais
   un négatif** (images écartées + triage humain) ; appariement ambigu → job
   écarté ; ajouts manuels = report-only.
3. **Critères absolus** (`evaluate.py`, exit 2) sur le test public.
4. **Non-régression** (`compare_models.py`, exit 2) : candidat ≥ baseline
   − 0,02 mAP50 **par classe** + mAP50-95 global sur le test public ;
   candidat ≥ baseline sur user-val (gate actif si ≥ 30 images).
5. **Smoke test** runtime (`smoke_test.py`).
6. **Release jamais automatique** : `--release` seulement après revue humaine
   de `preview.jpg` (le cron tourne sans).

### Données personnelles (RGPD)

Le bundle (photos utilisateur) est transitoire : purgé par `retrain.py` en fin
de cycle (`--keep-data` pour déboguer, purge manuelle ensuite). La release ne
contient que poids + métriques + `USER_DATASET_MANIFEST.json` (ids de
projets/jobs, **aucune photo**). Le dataset est reconstruit à chaque cycle
depuis la base vivante : une suppression de projet (CASCADE) sort
naturellement des cycles suivants.

## Reproductibilité

- Versions Roboflow épinglées dans `prepare_dataset.py` (version **brute**, non
  augmentée — les augmentations Roboflow créeraient des quasi-doublons qui
  fuiteraient entre splits) ; dédoublonnage inter-sources par SHA-256.
- `data.yaml` contient un chemin **absolu** (évite la résolution via le
  `datasets_dir` global d'ultralytics) : régénérer si le dossier bouge.
- Seed déterministe (`--seed 42`, `deterministic=True`) ; versions
  ultralytics/torch consignées dans `training_summary.json` et `metrics.json`.
- `train.py` refuse d'exporter un checkpoint dont les classes ne matchent pas
  le contrat `{0: door, 1: window}`.
