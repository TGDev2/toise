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
