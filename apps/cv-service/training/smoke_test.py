#!/usr/bin/env python3
"""Smoke test du chemin runtime réel du détecteur portes/fenêtres.

Vérifie, sans dépendre d'un entraînement : OpeningDetector.load_model(<poids>)
→ detect(image, depth_map, px_per_cm) → schéma de sortie conforme
(list[DetectedOpening], type ∈ {door, window}, 30 ≤ cm ≤ 300, 0 ≤ conf ≤ 1).
Aucune fixture binaire : les images sont générées en mémoire.

Modes :
  --weights <pt>   valide un artefact réel (post-entraînement ou post-fetch) ;
                   vérifie aussi model.names == {0: door, 1: window}
  --make-dummy     construit un YOLOv8n 2 classes à poids aléatoires (offline,
                   depuis le yolov8n.yaml du package) et le valide — chemin
                   CI/dev sans poids entraînés
  --allow-coco-names  repli : accepte un checkpoint aux classes ≠ contrat
                   (ex. yolov8n.pt COCO) et saute l'assertion sur les noms

Code retour : 0 = OK, 1 = échec. Importable par pytest plus tard (CV-7).

Exemples :
  python training/smoke_test.py --make-dummy
  python training/smoke_test.py --weights models/door-window-yolov8n.pt
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

import numpy as np

# Le script vit dans training/ ; rendre app/ importable comme depuis la racine
# du service (même convention que uvicorn app.main:app).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.opening_detector import (  # noqa: E402
    CLASS_NAMES,
    DetectedOpening,
    OpeningDetector,
)

EXPECTED_NAMES = {0: "door", 1: "window"}


def make_dummy_checkpoint(path: Path) -> None:
    """Construit un checkpoint YOLOv8n 2 classes à poids aléatoires.

    Reproduit la forme des checkpoints ultralytics ({"model": DetectionModel})
    pour que YOLO(path) le recharge. Si un bump d'ultralytics casse ce
    format : utiliser le repli `--weights yolov8n.pt --allow-coco-names`.
    """
    import torch
    from ultralytics.nn.tasks import DetectionModel

    model = DetectionModel(cfg="yolov8n.yaml", nc=2, verbose=False)
    model.names = dict(EXPECTED_NAMES)
    torch.save({"model": model, "train_args": {}}, path)
    print(f"[dummy] checkpoint 2 classes à poids aléatoires : {path}")


def make_synthetic_image() -> np.ndarray:
    """Image BGR synthétique : un mur clair avec deux rectangles contrastés."""
    rng = np.random.default_rng(42)
    image = np.full((480, 640, 3), 210, dtype=np.uint8)
    image += rng.integers(0, 12, size=image.shape, dtype=np.uint8)
    image[120:460, 80:220] = (60, 70, 80)     # forme verticale type porte
    image[100:260, 360:600] = (140, 160, 170)  # forme horizontale type fenêtre
    return image


def run_checks(weights: Path, check_names: bool) -> None:
    detector = OpeningDetector()
    detector.load_model(str(weights))
    assert detector.model is not None, (
        f"load_model({weights}) a basculé sur l'heuristique — le smoke test "
        "exige un chargement YOLO réussi (voir le warning loggué ci-dessus)"
    )

    if check_names:
        names = {int(k): str(v) for k, v in detector.model.names.items()}
        assert names == EXPECTED_NAMES, (
            f"classes du checkpoint {names} != contrat runtime {EXPECTED_NAMES}"
        )

    image = make_synthetic_image()
    depth_map = np.random.default_rng(42).random((480, 640), dtype=np.float32)
    openings = detector.detect(image, depth_map, px_per_cm=5.0)

    assert isinstance(openings, list), f"detect() doit renvoyer une liste, reçu {type(openings)}"
    for o in openings:
        assert isinstance(o, DetectedOpening), f"élément inattendu : {type(o)}"
        assert o.type in CLASS_NAMES.values(), f"type inattendu : {o.type}"
        assert len(o.bbox) == 4, f"bbox invalide : {o.bbox}"
        assert 30 <= o.width_cm <= 300, f"width_cm hors bornes : {o.width_cm}"
        assert 30 <= o.height_cm <= 300, f"height_cm hors bornes : {o.height_cm}"
        assert 0.0 <= o.confidence <= 1.0, f"confidence hors bornes : {o.confidence}"
    print(f"detect() OK — {len(openings)} ouverture(s) (0 est normal pour des "
          "poids aléatoires ou une image synthétique)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--weights", help="checkpoint à valider")
    group.add_argument("--make-dummy", action="store_true",
                       help="génère et valide un checkpoint 2 classes aléatoire")
    parser.add_argument("--allow-coco-names", action="store_true",
                        help="saute l'assertion sur les noms de classes")
    args = parser.parse_args()

    try:
        if args.make_dummy:
            with tempfile.TemporaryDirectory() as tmp:
                dummy = Path(tmp) / "dummy-door-window-yolov8n.pt"
                make_dummy_checkpoint(dummy)
                run_checks(dummy, check_names=not args.allow_coco_names)
        else:
            weights = Path(args.weights)
            if not weights.exists():
                print(f"ERREUR : {weights} introuvable (scripts/fetch-model.sh "
                      "ou training/train.py d'abord)", file=sys.stderr)
                sys.exit(1)
            run_checks(weights, check_names=not args.allow_coco_names)
    except AssertionError as exc:
        print(f"SMOKE TEST ÉCHOUÉ : {exc}", file=sys.stderr)
        sys.exit(1)

    print("SMOKE TEST OK")


if __name__ == "__main__":
    main()
