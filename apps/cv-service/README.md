# Chiffréo — CV Service

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
- Le modèle YOLOv8n entraîné dans `models/door-window-yolov8n.pt`

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

## Endpoints

### `GET /health`

Health check.

**Réponse :**
```json
{
  "status": "ok",
  "service": "cv-service"
}
```

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
| `reference_object` | object | non | Objet de référence pour la calibration |
| `reference_object.type` | string | non | Type d'objet (`door`) |
| `reference_object.height_cm` | float | non | Hauteur connue en cm (défaut: 204.0 pour une porte standard) |

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
  "raw_output": { ... },
  "error": null
}
```

**Statuts possibles :** `success`, `no_reference`, `error`

**Niveaux de confiance :** `high` (>= 0.7), `medium` (>= 0.4), `low` (< 0.4)

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
