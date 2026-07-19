#!/usr/bin/env python3
"""Fine-tune YOLOv8n sur le dataset portes/fenêtres.

Part du checkpoint COCO `yolov8n.pt` (téléchargé automatiquement par
ultralytics au premier appel), entraîne sur le data.yaml produit par
prepare_dataset.py, puis copie le meilleur checkpoint vers --out et écrit un
`training_summary.json` à côté (args, métriques, versions).

Exemples :
  python training/train.py --data datasets/door-window/data.yaml
  python training/train.py --data datasets/door-window/data.yaml \
      --epochs 100 --imgsz 640 --batch 16 --device auto --seed 42 \
      --out models/door-window-yolov8n.pt
  # Dry-run CPU (pipeline seulement, chiffres sans valeur) :
  python training/train.py --data datasets/dry-run/data.yaml --epochs 1 --batch 4
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

EXPECTED_NAMES = {0: "door", 1: "window"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="chemin du data.yaml")
    parser.add_argument("--base", default="yolov8n.pt",
                        help="checkpoint de départ (défaut : yolov8n.pt COCO)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="auto",
                        help="auto | cpu | 0 | 0,1 … (auto = choix ultralytics)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--name", default=None,
                        help="nom du run ultralytics (défaut : door-window-<horodatage>)")
    parser.add_argument("--project", default="runs/detect",
                        help="dossier des runs (explicite pour neutraliser le "
                             "runs_dir global des settings ultralytics)")
    parser.add_argument("--out", default="models/door-window-yolov8n.pt",
                        help="destination du meilleur checkpoint")
    args = parser.parse_args()

    data = Path(args.data).resolve()
    if not data.exists():
        print(f"ERREUR : {data} introuvable — lancer prepare_dataset.py d'abord",
              file=sys.stderr)
        sys.exit(1)

    import torch
    import ultralytics
    from ultralytics import YOLO

    run_name = args.name or f"door-window-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    device = None if args.device == "auto" else args.device

    model = YOLO(args.base)
    results = model.train(
        data=str(data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        seed=args.seed,
        deterministic=True,
        project=str(Path(args.project).resolve()),
        name=run_name,
        verbose=True,
    )

    save_dir = Path(model.trainer.save_dir)
    best = save_dir / "weights" / "best.pt"
    if not best.exists():
        print(f"ERREUR : {best} absent après l'entraînement", file=sys.stderr)
        sys.exit(1)

    # Garde-fou contrat runtime : les noms de classes viennent du data.yaml et
    # doivent matcher CLASS_NAMES de opening_detector.py.
    trained_names = {int(k): str(v) for k, v in YOLO(str(best)).names.items()}
    if trained_names != EXPECTED_NAMES:
        print(f"ERREUR : classes du checkpoint {trained_names} != {EXPECTED_NAMES} "
              "— data.yaml non conforme au contrat runtime", file=sys.stderr)
        sys.exit(1)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, out)

    metrics = {}
    results_dict = getattr(results, "results_dict", None)
    if results_dict:
        metrics = {k: float(v) for k, v in results_dict.items()
                   if isinstance(v, (int, float))}

    summary = {
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "args": vars(args),
        "run_dir": str(save_dir),
        "best_checkpoint": str(out.resolve()),
        "metrics": metrics,
        "versions": {
            "ultralytics": ultralytics.__version__,
            "torch": torch.__version__,
            "python": sys.version.split()[0],
        },
    }
    summary_path = out.with_name(out.stem + ".training_summary.json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                            encoding="utf-8")

    print(f"\nCheckpoint : {out}")
    print(f"Résumé     : {summary_path}")
    print("Prochaine étape : training/evaluate.py puis, si critères OK, "
          "scripts/release-model.sh")


if __name__ == "__main__":
    main()
