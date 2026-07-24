#!/usr/bin/env python3
"""Boucle de ré-entraînement CV-6 — orchestrateur.

Enchaîne, depuis la machine d'entraînement (jamais le VPS) :

  1. baseline : scripts/fetch-model.sh (dernière release cv-model-vN) +
     USER_DATASET_MANIFEST.json de cette release (cutoff du cycle précédent)
  2. export_client.py     → bundle corrections + photos (transitoire)
  3. build_user_dataset.py → labels YOLO + split + preview.jpg
  4. gate volume : < --min-new-images nouvelles images depuis la dernière
     release → exit 0 (skip propre)
  5. train.py (base COCO, data.yaml combiné public + utilisateur)
  6. evaluate.py          — critères absolus sur le test public (exit 2)
  7. compare_models.py    — non-régression vs baseline (exit 2)
  8. smoke_test.py        — chemin runtime réel
  9. sans --release : STOP (candidat + rapports conservés, photos purgées).
     Un humain inspecte preview.jpg et comparison.json, puis relance avec
     --release : publication cv-model-v(N+1) (release-model.sh) et purge.

La release n'est JAMAIS automatique en cron : lancer le cron sans --release.
Le déploiement VPS reste le runbook docs/DEPLOY.md (fetch → build → up).

Prérequis : gh authentifié, env de export_client.py, dataset public préparé
(prepare_dataset.py), venv d'entraînement (README § Prérequis).

Exemples :
  python training/retrain.py --public-data datasets/door-window/data.yaml
  python training/retrain.py --public-data datasets/door-window/data.yaml --release
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

CV_ROOT = Path(__file__).resolve().parents[1]
TAG_RE = re.compile(r"^cv-model-v(\d+)$")


def fail(msg: str, code: int = 1) -> None:
    print(f"ERREUR : {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd: list[str], **kwargs) -> None:
    print(f"\n$ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=CV_ROOT, **kwargs)
    if result.returncode != 0:
        sys.exit(result.returncode)


def run_step(script: str, *args: str) -> None:
    run([sys.executable, str(CV_ROOT / "training" / script), *args])


def latest_model_tag() -> str | None:
    result = subprocess.run(
        ["gh", "release", "list", "--limit", "100", "--json", "tagName",
         "--jq",
         '[.[] | select(.tagName | startswith("cv-model-"))][0].tagName // empty'],
        cwd=CV_ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        fail("gh indisponible ou non authentifié (gh auth login) — requis "
             "pour la baseline et le cutoff")
    tag = result.stdout.strip()
    return tag or None


def next_model_tag(latest: str) -> str:
    match = TAG_RE.match(latest)
    if not match:
        fail(f"tag inattendu '{latest}' (attendu cv-model-vN)")
    return f"cv-model-v{int(match.group(1)) + 1}"


def previous_cutoff(tag: str, workdir: Path) -> str | None:
    """Cutoff du dataset de la release précédente (None si asset absent)."""
    dest = workdir / "prev_manifest.json"
    dest.unlink(missing_ok=True)
    result = subprocess.run(
        ["gh", "release", "download", tag,
         "--pattern", "USER_DATASET_MANIFEST.json",
         "--output", str(dest)],
        cwd=CV_ROOT, capture_output=True, text=True)
    if result.returncode != 0 or not dest.exists():
        print(f"  pas de USER_DATASET_MANIFEST.json sur {tag} "
              "(premier cycle) — cutoff = origine")
        return None
    return json.loads(dest.read_text(encoding="utf-8")).get("cutoff")


def count_new_images(manifest: dict, prev_cutoff: str | None) -> int:
    images = manifest.get("images", [])
    if prev_cutoff is None:
        return len(images)
    return sum(1 for img in images if img["job_completed_at"] > prev_cutoff)


def purge_photos(workdir: Path, keep: bool) -> None:
    """Purge RGPD : photos du bundle et du dataset (manifests conservés)."""
    if keep:
        print("--keep-data : photos conservées (purger manuellement)")
        return
    for target in (workdir / "bundle" / "images",
                   workdir / "user-dataset" / "train" / "images",
                   workdir / "user-dataset" / "valid" / "images"):
        if target.exists():
            shutil.rmtree(target)
    print("Photos purgées (bundle + dataset) — manifests et rapports conservés")


def release(workdir: Path, tag: str, keep_data: bool) -> None:
    candidate = workdir / "candidate.pt"
    metrics = workdir / "reports" / "metrics.json"
    card = workdir / "reports" / "MODEL_CARD.md"
    manifest = workdir / "user-dataset" / "USER_DATASET_MANIFEST.json"
    for f in (candidate, metrics, card, manifest):
        if not f.exists():
            fail(f"{f} absent — relancer le cycle complet avant --release")
    run(["bash", str(CV_ROOT / "scripts" / "release-model.sh"), tag,
         str(candidate), str(metrics), str(card), str(manifest)])
    purge_photos(workdir, keep_data)
    (workdir / "verdict.json").unlink(missing_ok=True)
    print(f"\nRelease {tag} publiée. Déploiement : docs/DEPLOY.md "
          f"(fetch-model.sh {tag} → build cv-service → up → /health)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--public-data", required=True,
                        help="data.yaml du dataset public (prepare_dataset.py)")
    parser.add_argument("--workdir", default="training/retrain")
    parser.add_argument("--min-new-images", type=int, default=20,
                        help="gate volume : skip en dessous")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--eps", type=float, default=0.02)
    parser.add_argument("--min-age-days", type=int, default=7)
    parser.add_argument("--min-conf", type=float, default=0.5)
    parser.add_argument("--min-val-images", type=int, default=30)
    parser.add_argument("--release", action="store_true",
                        help="publie cv-model-v(N+1) si tous les gates passent")
    parser.add_argument("--keep-data", action="store_true",
                        help="ne pas purger les photos (debug)")
    args = parser.parse_args()

    public_data = Path(args.public_data).resolve()
    if not public_data.exists():
        fail(f"{public_data} introuvable — lancer prepare_dataset.py d'abord")

    workdir = (CV_ROOT / args.workdir).resolve() \
        if not Path(args.workdir).is_absolute() else Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    # ── Baseline + tags ──────────────────────────────────────────────
    latest = latest_model_tag()
    if latest is None:
        fail("aucune release cv-model-* : la boucle exige une baseline "
             "(publier cv-model-v1 via le runbook CV-1 d'abord)")
    tag_next = next_model_tag(latest)
    print(f"Baseline : {latest} → candidat pour {tag_next}")

    # ── Reprise --release sur un cycle déjà validé ───────────────────
    verdict_path = workdir / "verdict.json"
    if args.release and verdict_path.exists():
        verdict = json.loads(verdict_path.read_text(encoding="utf-8"))
        if verdict.get("verdict") == "PASS" and verdict.get("baseline") == latest:
            print(f"Cycle validé le {verdict['generated_at']} "
                  f"({verdict['new_images']} nouvelles images) — publication")
            release(workdir, tag_next, args.keep_data)
            return
        print("verdict.json obsolète (baseline différente ou FAIL) — "
              "cycle complet relancé")

    run(["bash", str(CV_ROOT / "scripts" / "fetch-model.sh"), latest])
    baseline_weights = CV_ROOT / "models" / "door-window-yolov8n.pt"
    prev_cutoff = previous_cutoff(latest, workdir)

    # ── Export + dataset utilisateur ─────────────────────────────────
    bundle = workdir / "bundle"
    user_dataset = workdir / "user-dataset"
    run_step("export_client.py", "--out", str(bundle))
    run_step("build_user_dataset.py",
             "--bundle", str(bundle), "--out", str(user_dataset),
             "--min-age-days", str(args.min_age_days),
             "--min-conf", str(args.min_conf),
             "--val-fraction", "0.2",
             "--min-val-images", str(args.min_val_images),
             "--seed", str(args.seed))

    manifest = json.loads(
        (user_dataset / "USER_DATASET_MANIFEST.json")
        .read_text(encoding="utf-8"))
    new_images = count_new_images(manifest, prev_cutoff)
    train_images = manifest["counts"]["images"]["train"]
    print(f"\nImages : {train_images} train, "
          f"{new_images} nouvelles depuis {latest} "
          f"(cutoff précédent : {prev_cutoff or 'origine'})")
    if train_images == 0 or new_images < args.min_new_images:
        print(f"Gate volume : < {args.min_new_images} nouvelles images — "
              "cycle sauté (rien à ré-entraîner)")
        purge_photos(workdir, args.keep_data)
        return

    # ── data.yaml combiné public + utilisateur ───────────────────────
    import yaml
    with open(public_data, encoding="utf-8") as f:
        public_cfg = yaml.safe_load(f)
    public_root = Path(public_cfg["path"])
    combined = {
        "train": [str(public_root / "train" / "images"),
                  str(user_dataset / "train" / "images")],
        "val": str(public_root / "valid" / "images"),
        "test": str(public_root / "test" / "images"),
        "nc": 2,
        "names": ["door", "window"],
    }
    combined_path = workdir / "combined-data.yaml"
    with open(combined_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(combined, f, sort_keys=False, allow_unicode=True)

    # ── Entraînement + garde-fous ────────────────────────────────────
    candidate = workdir / "candidate.pt"
    reports = workdir / "reports"
    run_name = f"retrain-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    run_step("train.py", "--data", str(combined_path),
             "--epochs", str(args.epochs), "--imgsz", str(args.imgsz),
             "--batch", str(args.batch), "--device", args.device,
             "--seed", str(args.seed), "--name", run_name,
             "--out", str(candidate))
    run_step("evaluate.py", "--weights", str(candidate),
             "--data", str(public_data), "--report", str(reports),
             "--device", args.device)
    run_step("compare_models.py", "--baseline", str(baseline_weights),
             "--candidate", str(candidate),
             "--public-data", str(public_data),
             "--user-data", str(user_dataset / "data.yaml"),
             "--report", str(reports), "--eps", str(args.eps),
             "--min-user-val", str(args.min_val_images),
             "--device", args.device)
    run_step("smoke_test.py", "--weights", str(candidate))

    verdict_path.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "verdict": "PASS",
        "baseline": latest,
        "candidate_for": tag_next,
        "new_images": new_images,
        "train_images": train_images,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.release:
        release(workdir, tag_next, args.keep_data)
        return

    purge_photos(workdir, args.keep_data)
    print(f"""
Candidat {tag_next} validé par tous les gates automatiques.
AVANT publication, revue humaine obligatoire :
  1. {user_dataset / 'preview.jpg'} — labels corrects ? (seul contrôle de
     localisation existant)
  2. {reports / 'comparison.json'} — gains réels ?
  3. {user_dataset / 'USER_DATASET_MANIFEST.json'} — triage à traiter ?
Puis : python training/retrain.py --public-data {public_data} --release""")


if __name__ == "__main__":
    main()
