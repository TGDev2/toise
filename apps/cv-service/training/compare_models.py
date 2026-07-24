#!/usr/bin/env python3
"""Garde-fou comparatif CV-6 : le candidat ne doit pas régresser vs la prod.

Évalue baseline (poids en prod, cf. scripts/fetch-model.sh) et candidat sur :
  - le split test du dataset PUBLIC : mAP50 par classe (candidat ≥ baseline
    − --eps, par classe — un epsilon global masquerait l'effondrement d'une
    classe) et mAP50-95 global (même règle) ;
  - le split val du dataset UTILISATEUR (--user-data, optionnel) : mAP50
    global candidat ≥ baseline, gate actif seulement si ≥ --min-user-val
    images (en dessous, la métrique est du bruit — gate consigné « inactif »).

Écrit comparison.json dans --report ; exit 2 si un gate échoue.

Exemple :
  python training/compare_models.py \
      --baseline models/door-window-yolov8n.pt \
      --candidate training/retrain/candidate.pt \
      --public-data datasets/door-window/data.yaml \
      --user-data training/retrain/user-dataset/data.yaml \
      --report training/retrain/reports
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ─── Logique de gates pure (testée en CI sans torch) ─────────────────────


def evaluate_gates(
    baseline: dict,
    candidate: dict,
    eps: float,
    user: dict | None,
    min_user_val: int,
) -> tuple[dict, str]:
    """Applique les gates comparatifs.

    baseline / candidate : {"classes": {"door": {"map50": …}, "window": …},
    "map50_95": float}. user : None ou {"baseline_map50", "candidate_map50",
    "val_images"}. Renvoie (checks, verdict) ; un gate user inactif vaut None
    dans checks (non bloquant).
    """
    checks: dict = {}
    for cls in ("door", "window"):
        checks[f"map50_{cls}"] = (
            candidate["classes"][cls]["map50"]
            >= baseline["classes"][cls]["map50"] - eps
        )
    checks["map50_95_overall"] = (
        candidate["map50_95"] >= baseline["map50_95"] - eps
    )
    if user is not None and user["val_images"] >= min_user_val:
        checks["user_val_map50"] = (
            user["candidate_map50"] >= user["baseline_map50"]
        )
    else:
        checks["user_val_map50"] = None  # gate inactif (pas assez d'images)
    verdict = "PASS" if all(v is not False for v in checks.values()) else "FAIL"
    return checks, verdict


def count_val_images(data_yaml: Path) -> int:
    """Compte les images du split val d'un data.yaml (sans charger torch)."""
    import yaml

    with open(data_yaml, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    root = Path(data.get("path", data_yaml.parent))
    val_dir = root / data.get("val", "valid/images")
    if not val_dir.is_dir():
        return 0
    return sum(1 for p in val_dir.iterdir() if p.suffix.lower() in IMG_EXTS)


# ─── Évaluation (torch) ──────────────────────────────────────────────────


def val_metrics(weights: Path, data: Path, split: str, device, project: str) -> dict:
    from ultralytics import YOLO

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from evaluate import per_class

    model = YOLO(str(weights))
    m = model.val(data=str(data), split=split, device=device,
                  project=project, plots=False, verbose=False)
    return {
        "classes": per_class(m),
        "map50": float(m.box.map50),
        "map50_95": float(m.box.map),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--baseline", required=True,
                        help="poids actuellement en prod (fetch-model.sh)")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--public-data", required=True,
                        help="data.yaml du dataset public (split test)")
    parser.add_argument("--user-data", default=None,
                        help="data.yaml du dataset utilisateur (split val)")
    parser.add_argument("--report", default="training/retrain/reports")
    parser.add_argument("--eps", type=float, default=0.02,
                        help="régression tolérée sur le test public")
    parser.add_argument("--min-user-val", type=int, default=30)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--project", default="runs/detect")
    args = parser.parse_args()

    baseline_w = Path(args.baseline)
    candidate_w = Path(args.candidate)
    public_data = Path(args.public_data).resolve()
    for path, hint in ((baseline_w, "scripts/fetch-model.sh d'abord"),
                       (candidate_w, "training/train.py d'abord"),
                       (public_data, "training/prepare_dataset.py d'abord")):
        if not path.exists():
            print(f"ERREUR : {path} introuvable — {hint}", file=sys.stderr)
            sys.exit(1)

    device = None if args.device == "auto" else args.device
    project = str(Path(args.project).resolve())
    report_dir = Path(args.report)
    report_dir.mkdir(parents=True, exist_ok=True)

    print(f"Baseline  {baseline_w} — éval test public…")
    base_public = val_metrics(baseline_w, public_data, "test", device, project)
    print(f"Candidat  {candidate_w} — éval test public…")
    cand_public = val_metrics(candidate_w, public_data, "test", device, project)

    user = None
    if args.user_data:
        user_data = Path(args.user_data).resolve()
        n_val = count_val_images(user_data) if user_data.exists() else 0
        if n_val > 0:
            print(f"Éval user-val ({n_val} images)…")
            user = {
                "val_images": n_val,
                "baseline_map50": val_metrics(
                    baseline_w, user_data, "val", device, project)["map50"],
                "candidate_map50": val_metrics(
                    candidate_w, user_data, "val", device, project)["map50"],
            }
        else:
            print("user-val vide — gate user inactif")

    checks, verdict = evaluate_gates(
        base_public, cand_public, args.eps, user, args.min_user_val)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "baseline": {"weights": str(baseline_w.resolve()), **base_public},
        "candidate": {"weights": str(candidate_w.resolve()), **cand_public},
        "user_val": user,
        "eps": args.eps,
        "min_user_val": args.min_user_val,
        "checks": checks,
        "verdict": verdict,
    }
    out = report_dir / "comparison.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                   encoding="utf-8")

    print(f"\nVerdict comparatif : {verdict} ({out})")
    for name, ok in checks.items():
        state = "inactif" if ok is None else ("✅" if ok else "❌")
        print(f"  {name}: {state}")
    if verdict == "FAIL":
        sys.exit(2)


if __name__ == "__main__":
    main()
