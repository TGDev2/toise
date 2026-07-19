# models/ — poids du détecteur portes/fenêtres

Ce dossier reçoit `door-window-yolov8n.pt`, le modèle YOLOv8n fine-tuné qui
détecte les portes (`0: door`) et fenêtres (`1: window`) sur les photos de
pièces. **Les poids ne sont jamais committés** (`.gitignore` racine) : ils sont
versionnés comme artefacts de GitHub Release, tags `cv-model-vN`.

## Récupérer les poids

```bash
# Dernière release cv-model-* (ou passer un tag précis : cv-model-v1)
./scripts/fetch-model.sh
```

Le script télécharge les assets dans ce dossier et vérifie leur SHA-256.
Prérequis : `gh` authentifié, ou `GITHUB_TOKEN` + `GITHUB_REPOSITORY` en
environnement (repli curl). Voir [scripts/fetch-model.sh](../scripts/fetch-model.sh).

## En l'absence des poids

Le service démarre quand même : `OpeningDetector` loggue un warning et bascule
sur l'heuristique OpenCV (Canny/contours), moins précise. `GET /health` expose
l'état réel via `"yolo": true|false`. Le chemin est configurable par la
variable d'environnement `OPENING_MODEL_PATH` (défaut :
`models/door-window-yolov8n.pt`).

## Produire une nouvelle version

Entraînement, évaluation et publication : voir [training/README.md](../training/README.md).
