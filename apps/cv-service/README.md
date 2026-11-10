# Toisé — CV Service

Microservice de vision par ordinateur construit avec **Python FastAPI**. Analyse des photos de pièces pour extraire automatiquement les dimensions et détecter les ouvertures (portes, fenêtres).

## Modèles ML utilisés

| Modèle | Usage | Framework |
|--------|-------|-----------|
| **Depth Anything V2 Small** | Estimation de profondeur à partir d'une image | HuggingFace Transformers + PyTorch |
| **YOLOv8n** (custom) | Détection de portes et fenêtres | Ultralytics |

## Setup local

### Prérequis

- Python >= 3.11
- pip ou uv
- Optionnel : les poids YOLOv8n dans `models/door-window-yolov8n.pt` (voir
  [Modèle portes/fenêtres](#modèle-portesfenêtres) — sans eux, repli sur
  l'heuristique OpenCV)

### Installation

```bash
cd apps/cv-service

# Créer un environnement virtuel
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

Le service sera disponible sur `http://localhost:8000`.

### Via Docker

```bash
# Depuis la racine du monorepo
docker compose up cv-service
```

Le container est configuré avec une limite de 2 GB de mémoire et un volume partagé pour les uploads.

### Via pnpm (depuis la racine)

```bash
pnpm dev:cv
```

## Configuration

Variables d'environnement (ou `app/config.py` par défaut) :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `UPLOADS_PATH` | Répertoire des images uploadées | `./uploads` |
| `MODEL_NAME` | ID du modèle de profondeur | `depth-anything-v2-small` |
| `OPENING_MODEL_PATH` | Chemin du modèle YOLOv8 | `models/door-window-yolov8n.pt` |
| `HOST` | Adresse d'écoute | `0.0.0.0` |
| `PORT` | Port d'écoute | `8000` |
| `CV_SERVICE_TOKEN` | Secret partagé avec l'API (requis hors développement) | — |
| `MAX_IMAGES_PER_REQUEST` | Images acceptées par appel à `/analyze` | `8` |
| `MAX_IMAGE_PIXELS` | Surface décodée par image ; au-delà l'image est **réduite** | `50000000` |
| `MAX_CONCURRENT_ANALYSES` | Analyses simultanées ; au-delà → `429` | `1` |

### Contrat d'admission

Le service tient dans un seul processus uvicorn sous 4 Go (cf. `Dockerfile` et
`docker-compose.prod.yml`). Les trois dernières variables ci-dessus sont ce qui
empêche une requête unique de le saturer :

- au-delà de `MAX_IMAGES_PER_REQUEST`, la requête est refusée en `422` **avant**
  tout travail ;
- au-delà de `MAX_IMAGE_PIXELS`, l'image est réduite à ce budget, jamais
  rejetée : toutes les mesures sont des rapports entre une longueur en pixels et
  un `px_per_cm` mesuré dans la même image, donc invariantes par mise à
  l'échelle. Un JPEG très compressé de 100 Mpx ne monte jamais en mémoire en
  pleine résolution (`Image.thumbnail` passe par `draft()`) ;
- au-delà de `MAX_CONCURRENT_ANALYSES`, la requête est refusée en `429` avec
  `Retry-After`. Refuser plutôt que mettre en file : une file invisible déplace
  la saturation vers des timeouts côté appelant pendant que le travail continue
  sans destinataire.

Le pipeline lui-même s'exécute dans un thread (`asyncio.to_thread`) : la boucle
d'événements reste libre, donc `/health` répond pendant une analyse — sans quoi
le healthcheck Docker finit par déclarer malsain un service qui travaille.

## Endpoints

### `GET /health`

Health check.

**Réponse :**
```json
{
  "status": "ok",
  "service": "cv-service",
  "models": {
    "depth": true,
    "yolo": true
  }
}
```

`models.yolo` vaut `false` quand les poids portes/fenêtres sont absents (repli
heuristique actif) — c'est le signal à contrôler après un déploiement.

### `POST /analyze`

Analyser des photos pour extraire les dimensions d'une pièce.

**Requête :**
```json
{
  "image_paths": ["uploads/photo1.jpg", "uploads/photo2.jpg"],
  "reference_object": {
    "type": "door",
    "height_cm": 204.0
  }
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `image_paths` | string[] | oui | Chemins relatifs des images (validés contre le path traversal) |
| `reference_object` | object | non | Objet de référence pour la calibration (absent → porte auto-détectée) |
| `reference_object.type` | string | non | `door` (défaut) · `a4` · `card` |
| `reference_object.height_cm` | float | non | Hauteur connue en cm (défaut 204.0). Utile pour `door` uniquement |

**Objet étalon universel (CV-3).** Sans porte visible, l'utilisateur pose un
**étalon** au mur et l'indique via `reference_object.type` :

| Type | Objet | Dimensions réelles |
|------|-------|--------------------|
| `door` | Porte standard | 204 cm de haut (défaut) |
| `a4` | Feuille A4 | 29,7 × 21,0 cm |
| `card` | Carte bancaire (ISO/IEC 7810 ID-1) | 8,56 × 5,398 cm |

Pour `a4`/`card`, l'échelle (`px_per_cm`) est dérivée des dimensions réelles fixes
du marqueur (le `height_cm` fourni est ignoré). La géométrie de la pièce est
inchangée : seule la **source de l'échelle** diffère. Si le marqueur demandé
n'est pas trouvé, la réponse reste `status="no_reference"`.

**Réponse (succès) :**
```json
{
  "status": "success",
  "dimensions": {
    "length_cm": 450,
    "width_cm": 350,
    "height_cm": 250
  },
  "confidence": "high",
  "confidence_score": 0.92,
  "reference_detected": true,
  "reference_type": "door",
  "openings": [
    {
      "type": "door",
      "width_cm": 90,
      "height_cm": 204,
      "confidence": 0.95,
      "count": 1
    },
    {
      "type": "window",
      "width_cm": 120,
      "height_cm": 100,
      "confidence": 0.88,
      "count": 2
    }
  ],
  "num_images_processed": 2,
  "opening_detector": "yolo",
  "raw_output": { ... },
  "error": null
}
```

**Statuts possibles :** `success`, `no_reference`, `error`

**Niveaux de confiance :** `high` (>= 0.95), `medium` (>= 0.85), `low` (< 0.85)
— cf. `DimensionCalculator._score_to_level`.

**`opening_detector` :** `yolo` (modèle entraîné), `heuristic` (repli OpenCV, dimensions approximatives), `none` (aucun détecteur monté). Le `confidence` de chaque ouverture est sur la même échelle 0-1 dans les deux modes : c'est ce champ, et lui seul, qui dit ce qui a produit les boîtes.

## Pipeline d'analyse

Le `DimensionCalculator` orchestre le pipeline complet pour chaque image, puis fusionne les résultats :

```
Pour chaque image :
┌─────────────────────────────────────────────────────────┐
│ 1. Chargement de l'image (PIL)                          │
│    ↓                                                    │
│ 2. Estimation de profondeur (Depth Anything V2)         │
│    → Carte de profondeur (H × W, valeurs relatives)     │
│    ↓                                                    │
│ 3. Détection de contours (OpenCV)                       │
│    → Lignes de murs + région du sol                     │
│    ↓                                                    │
│ 4. Détection de l'objet de référence                    │
│    → Position et taille en pixels de la porte           │
│    ↓                                                    │
│ 5. Calibration de l'échelle                             │
│    → Facteur pixels → cm                                │
│    ↓                                                    │
│ 6. Calcul des dimensions                                │
│    → longueur, largeur, hauteur en cm                   │
│    ↓                                                    │
│ 7. Détection des ouvertures (YOLOv8n)                   │
│    → Portes et fenêtres avec dimensions et confiance    │
└─────────────────────────────────────────────────────────┘

Fusion multi-images :
┌─────────────────────────────────────────────────────────┐
│ 8. Fusion par médiane des dimensions                    │
│    → Réduit l'impact des outliers                       │
│    ↓                                                    │
│ 9. Dédoublonnage des ouvertures (IoU)                   │
│    → Regroupement par comptage                          │
│    ↓                                                    │
│ 10. Score de confiance amélioré                         │
│     ├── Cohérence multi-images (30%)                    │
│     │   → Coefficient de variation entre images         │
│     ├── Qualité de la référence (30%)                   │
│     │   → Confiance de détection de l'objet             │
│     ├── Plausibilité des dimensions (20%)               │
│     │   → Vérifications de bon sens                     │
│     └── Couverture de détection (20%)                   │
│         → Nombre de lignes de mur + surface au sol      │
└─────────────────────────────────────────────────────────┘
```

## Modèle portes/fenêtres

Les poids `models/door-window-yolov8n.pt` (YOLOv8n fine-tuné, classes
`{0: door, 1: window}`) ne sont **jamais committés** : ils sont versionnés en
artefacts de GitHub Release, tags `cv-model-vN`.

```bash
# Récupérer la dernière version (dev comme VPS, AVANT docker build)
./scripts/fetch-model.sh            # ou ./scripts/fetch-model.sh cv-model-v1
```

- **Absents** : le service démarre quand même, `OpeningDetector` bascule sur
  l'heuristique OpenCV (moins précise) et `GET /health` expose `"yolo": false`.
- **Chemin configurable** : `OPENING_MODEL_PATH` (défaut
  `models/door-window-yolov8n.pt`).
- **Produire/publier une nouvelle version** (datasets, entraînement,
  évaluation, critères d'acceptation) : [training/README.md](training/README.md),
  puis `./scripts/release-model.sh`.

## Sécurité

### Protection contre le path traversal

Les chemins d'images sont validés avant traitement :
- Rejet des chemins absolus
- Rejet des segments `..`
- Rejet des backslashes et octets nuls
- Vérification `Path.relative_to()` pour s'assurer que le fichier résolu est bien dans `UPLOADS_PATH`

## Structure des fichiers

```
app/
├── main.py                          # Point d'entrée FastAPI (lifespan, routes)
├── config.py                        # Configuration (Pydantic Settings)
├── api/
│   ├── health.py                    # GET /health
│   └── routes.py                    # POST /analyze
├── models/
│   └── schemas.py                   # Modèles Pydantic (Request/Response)
└── services/
    ├── depth_estimator.py           # Depth Anything V2 (HuggingFace)
    ├── contour_detector.py          # Détection de contours (OpenCV)
    ├── reference_detector.py        # Détection d'objet de référence
    ├── opening_detector.py          # YOLOv8n (portes/fenêtres)
    └── dimension_calculator.py      # Orchestration du pipeline complet
models/                              # Poids YOLO (artefact de release, hors git)
scripts/
├── release-model.sh                 # Publie les poids (GitHub Release cv-model-vN)
└── fetch-model.sh                   # Récupère + vérifie les poids (SHA-256)
training/
├── prepare_dataset.py               # Assemble le dataset portes/fenêtres (CC BY 4.0)
├── train.py                         # Fine-tuning YOLOv8n
├── evaluate.py                      # mAP/PR + verdict vs critères + MODEL_CARD
└── smoke_test.py                    # Valide le chemin runtime réel (CI/dev)
```

## Dépendances principales

| Package | Usage |
|---------|-------|
| `fastapi` | Framework web |
| `uvicorn` | Serveur ASGI |
| `torch` | Runtime PyTorch (CPU) |
| `transformers` | Modèle Depth Anything V2 |
| `ultralytics` | YOLOv8 |
| `opencv-python-headless` | Traitement d'images |
| `Pillow` | Chargement d'images |
| `numpy` | Calcul numérique |
| `pydantic` | Validation des données |

## Liens

- [Architecture technique](../../docs/ARCHITECTURE.md)
- [Référence API backend](../../docs/API.md) (section Analysis)
- [Backend API](../api/README.md)
