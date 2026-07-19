#!/usr/bin/env python3
"""Évalue le modèle portes/fenêtres sur le split test et produit les rapports.

Sorties dans --report (défaut training/reports/) :
  metrics.json   — mAP50/mAP50-95 + P/R par classe, balayage de seuil de
                   confiance, verdict vs critères d'acceptation, versions
  report.md      — le même contenu, lisible
  MODEL_CARD.md  — carte de modèle : base, données + attributions CC BY
                   (repris de DATASET_MANIFEST.json), métriques, usage, limites
  qualitative/   — (option --images) inférences annotées sur de vraies photos

Critères d'acceptation (« assez bon pour remplacer l'heuristique ») :
  mAP50 ≥ 0,65 PAR classe ; mAP50-95 global ≥ 0,40 ;
  précision ≥ 0,6 par classe au seuil runtime conf=0,3.

Exemples :
  python training/evaluate.py --weights models/door-window-yolov8n.pt \
      --data datasets/door-window/data.yaml
  python training/evaluate.py --weights models/door-window-yolov8n.pt \
      --data datasets/door-window/data.yaml --images ~/photos-chantier/
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

EXPECTED_NAMES = {0: "door", 1: "window"}
RUNTIME_CONF = 0.3  # CONFIDENCE_THRESHOLD de app/services/opening_detector.py

CRITERIA = {
    "map50_per_class_min": 0.65,
    "map50_95_overall_min": 0.40,
    "precision_per_class_min_at_runtime_conf": 0.60,
}


def per_class(metrics) -> dict[str, dict[str, float]]:
    """Extrait P/R/mAP par classe d'un résultat de model.val()."""
    out: dict[str, dict[str, float]] = {}
    for pos, cls_id in enumerate(metrics.box.ap_class_index):
        p, r, ap50, ap = metrics.box.class_result(pos)
        out[EXPECTED_NAMES[int(cls_id)]] = {
            "precision": float(p),
            "recall": float(r),
            "map50": float(ap50),
            "map50_95": float(ap),
        }
    for name in EXPECTED_NAMES.values():
        # Classe absente du split (aucune vérité terrain) → non évaluable.
        out.setdefault(name, {"precision": 0.0, "recall": 0.0,
                              "map50": 0.0, "map50_95": 0.0})
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--weights", default="models/door-window-yolov8n.pt")
    parser.add_argument("--data", required=True, help="chemin du data.yaml")
    parser.add_argument("--split", default="test", choices=("train", "val", "test"))
    parser.add_argument("--report", default="training/reports", help="dossier de sortie")
    parser.add_argument("--sweep", default="0.1,0.3,0.5,0.7",
                        help="seuils de confiance à balayer (vide = pas de balayage)")
    parser.add_argument("--images", default=None,
                        help="dossier de vraies photos d'intérieur pour la revue qualitative")
    parser.add_argument("--project", default="runs/detect",
                        help="dossier des runs de validation (explicite pour "
                             "neutraliser le runs_dir global d'ultralytics)")
    parser.add_argument("--device", default="auto")
    args = parser.parse_args()

    weights = Path(args.weights)
    data = Path(args.data).resolve()
    for path, hint in ((weights, "lancer training/train.py d'abord"),
                       (data, "lancer training/prepare_dataset.py d'abord")):
        if not path.exists():
            print(f"ERREUR : {path} introuvable — {hint}", file=sys.stderr)
            sys.exit(1)

    import torch
    import ultralytics
    from ultralytics import YOLO

    report_dir = Path(args.report)
    report_dir.mkdir(parents=True, exist_ok=True)
    device = None if args.device == "auto" else args.device
    project = str(Path(args.project).resolve())

    model = YOLO(str(weights))
    names = {int(k): str(v) for k, v in model.names.items()}
    if names != EXPECTED_NAMES:
        print(f"ERREUR : classes du checkpoint {names} != {EXPECTED_NAMES}",
              file=sys.stderr)
        sys.exit(1)

    print(f"Évaluation de {weights} sur split '{args.split}'…")
    base = model.val(data=str(data), split=args.split, device=device,
                     project=project, plots=False, verbose=False)
    classes = per_class(base)
    overall = {"map50": float(base.box.map50), "map50_95": float(base.box.map)}

    sweep_results = []
    sweep_confs = [float(c) for c in args.sweep.split(",") if c.strip()]
    for conf in sweep_confs:
        print(f"  balayage conf={conf}…")
        m = model.val(data=str(data), split=args.split, conf=conf, device=device,
                      project=project, plots=False, verbose=False)
        sweep_results.append({"conf": conf, "classes": per_class(m)})

    at_runtime = next((s["classes"] for s in sweep_results
                       if abs(s["conf"] - RUNTIME_CONF) < 1e-9), None)
    checks = {
        "map50_door": classes["door"]["map50"] >= CRITERIA["map50_per_class_min"],
        "map50_window": classes["window"]["map50"] >= CRITERIA["map50_per_class_min"],
        "map50_95_overall": overall["map50_95"] >= CRITERIA["map50_95_overall_min"],
    }
    if at_runtime is not None:
        threshold = CRITERIA["precision_per_class_min_at_runtime_conf"]
        checks["precision_door_at_conf03"] = at_runtime["door"]["precision"] >= threshold
        checks["precision_window_at_conf03"] = at_runtime["window"]["precision"] >= threshold
    verdict = "PASS" if all(checks.values()) else "FAIL"

    qualitative_dir = None
    if args.images:
        qualitative_dir = report_dir / "qualitative"
        print(f"Revue qualitative sur {args.images}…")
        model.predict(source=args.images, conf=RUNTIME_CONF, save=True,
                      project=str(report_dir), name="qualitative",
                      exist_ok=True, verbose=False, device=device)

    manifest = {}
    manifest_path = data.parent / "DATASET_MANIFEST.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    training_summary = {}
    summary_path = weights.with_name(weights.stem + ".training_summary.json")
    if summary_path.exists():
        training_summary = json.loads(summary_path.read_text(encoding="utf-8"))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "weights": str(weights.resolve()),
        "data": str(data),
        "split": args.split,
        "overall": overall,
        "classes": classes,
        "confidence_sweep": sweep_results,
        "runtime_conf": RUNTIME_CONF,
        "criteria": CRITERIA,
        "checks": checks,
        "verdict": verdict,
        "versions": {"ultralytics": ultralytics.__version__,
                     "torch": torch.__version__},
    }
    (report_dir / "metrics.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def pct(v: float) -> str:
        return f"{v:.3f}"

    lines = [
        "# Évaluation — détecteur portes/fenêtres",
        "",
        f"- Poids : `{weights}`",
        f"- Données : `{data}` (split `{args.split}`)",
        f"- Date : {payload['generated_at']}",
        "",
        f"## Verdict : **{verdict}**",
        "",
        "| Critère | Seuil | Mesuré | OK |",
        "|---|---|---|---|",
        f"| mAP50 door | ≥ {CRITERIA['map50_per_class_min']} | {pct(classes['door']['map50'])} | {'✅' if checks['map50_door'] else '❌'} |",
        f"| mAP50 window | ≥ {CRITERIA['map50_per_class_min']} | {pct(classes['window']['map50'])} | {'✅' if checks['map50_window'] else '❌'} |",
        f"| mAP50-95 global | ≥ {CRITERIA['map50_95_overall_min']} | {pct(overall['map50_95'])} | {'✅' if checks['map50_95_overall'] else '❌'} |",
    ]
    if at_runtime is not None:
        lines += [
            f"| Précision door @conf={RUNTIME_CONF} | ≥ {CRITERIA['precision_per_class_min_at_runtime_conf']} | {pct(at_runtime['door']['precision'])} | {'✅' if checks['precision_door_at_conf03'] else '❌'} |",
            f"| Précision window @conf={RUNTIME_CONF} | ≥ {CRITERIA['precision_per_class_min_at_runtime_conf']} | {pct(at_runtime['window']['precision'])} | {'✅' if checks['precision_window_at_conf03'] else '❌'} |",
        ]
    lines += ["", "## Balayage du seuil de confiance", "",
              "| conf | P door | R door | P window | R window |", "|---|---|---|---|---|"]
    for s in sweep_results:
        c = s["classes"]
        lines.append(f"| {s['conf']} | {pct(c['door']['precision'])} | {pct(c['door']['recall'])} "
                     f"| {pct(c['window']['precision'])} | {pct(c['window']['recall'])} |")
    lines += ["",
              f"Le seuil runtime codé en dur est `conf={RUNTIME_CONF}` "
              "(`CONFIDENCE_THRESHOLD`, app/services/opening_detector.py) : vérifier "
              "qu'il reste un bon compromis P/R dans le tableau ci-dessus. Changer ce "
              "seuil est hors périmètre CV-1 (recommandation seulement).", ""]
    if qualitative_dir is not None:
        lines += [f"Revue qualitative : `{qualitative_dir}/` — vérifier ~10 photos, "
                  "aucun échec grossier attendu (ex. chaque pan de mur détecté porte).", ""]
    (report_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")

    attributions = "\n".join(
        f"- {src.get('attribution', key)} — {src.get('url', '')} ({src.get('license', '?')})"
        for key, src in manifest.get("sources", {}).items()
    ) or "- (DATASET_MANIFEST.json introuvable — régénérer avec prepare_dataset.py)"
    train_args = training_summary.get("args", {})
    card = f"""# Model card — door-window-yolov8n

## Modèle

- Architecture : YOLOv8n (détection), fine-tuné depuis `{train_args.get('base', 'yolov8n.pt')}` (COCO)
- Classes : `0: door`, `1: window` (contrat de `app/services/opening_detector.py`)
- Entraînement : epochs={train_args.get('epochs', '?')}, imgsz={train_args.get('imgsz', '?')}, batch={train_args.get('batch', '?')}, seed={train_args.get('seed', '?')}
- Versions : ultralytics {ultralytics.__version__}, torch {torch.__version__}
- Licence du framework : ultralytics est sous AGPL-3.0

## Données d'entraînement

{attributions}

Détails (comptes par split/classe, dédoublonnage) : DATASET_MANIFEST.json.

## Métriques (split {args.split})

- mAP50 : door {pct(classes['door']['map50'])}, window {pct(classes['window']['map50'])}
- mAP50-95 global : {pct(overall['map50_95'])}
- Verdict vs critères d'acceptation : **{verdict}** (détail : report.md)

## Usage prévu et limites

Détection de portes et fenêtres sur des photos d'intérieur uploadées par les
utilisateurs de Chiffréo (estimation de travaux de rénovation), inférence CPU,
seuil de confiance runtime {RUNTIME_CONF}. Non prévu pour : façades
extérieures, plans 2D, véhicules. Les dimensions cm en aval dépendent de la
calibration par porte de référence (~204 cm), pas du modèle.
"""
    (report_dir / "MODEL_CARD.md").write_text(card, encoding="utf-8")

    print(f"\nVerdict : {verdict}")
    print(f"Rapports : {report_dir / 'metrics.json'}, {report_dir / 'report.md'}, "
          f"{report_dir / 'MODEL_CARD.md'}")
    if verdict == "FAIL":
        print("Échelle d'itération : plus d'epochs → --include-paul-yi → imgsz 960 "
              "→ sous-ensemble Open Images filtré (voir training/README.md)")
        sys.exit(2)


if __name__ == "__main__":
    main()
