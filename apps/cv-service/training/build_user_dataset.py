#!/usr/bin/env python3
"""Construit le dataset YOLO « données réelles » depuis un bundle d'export CV-6.

Convertit les détections persistées (bbox par image) et les corrections
utilisateur (`cv_correction_logs`) en labels YOLO, avec des règles prudentes :

  - seuls les jobs `opening_detector == "yolo"` fournissent des labels (les
    boîtes heuristiques sont du bruit) ;
  - validation implicite gated : job ≥ --min-age-days ET projet engagé (≥ 1
    correction toute catégorie) ; boîtes non corrigées gardées si confiance
    ≥ --min-conf ; boîtes d'un groupe corrigé (type/dimensions/count) gardées
    telles quelles (un humain a regardé cette ouverture) ;
  - correction de type → classe réécrite sur toutes les boîtes du groupe ;
  - suppression (ou baisse de count) → **jamais** un négatif : toutes les
    images du job sont écartées et listées en triage humain ;
  - appariement correction ↔ groupe strict (snapshot exact) : tout cas
    ambigu écarte le job entier (triage) ;
  - ajouts manuels (`field='added'`) : report-only (pas de bbox).

Split temporel par projet (pas d'image d'un même projet dans les deux splits) :
les projets les plus récents vont en valid jusqu'à --val-fraction, split
activé seulement si ≥ --min-val-images images (sinon tout en train).

Sorties dans --out :
  {train,valid}/{images,labels}   — format YOLO, images renommées user_<sha12>
  data.yaml                       — pour l'éval user-val (compare_models.py)
  USER_DATASET_MANIFEST.json      — cutoff, comptes, provenance, triage
  preview.jpg                     — mosaïque à inspecter AVANT toute release

Exemple :
  python training/build_user_dataset.py \
      --bundle training/retrain/bundle --out training/retrain/user-dataset
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

CLASS_IDS = {"door": 0, "window": 1}
SNAPSHOT_KEYS = ("type", "width_cm", "height_cm", "count")


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ─── Logique pure (testée en CI sans torch) ──────────────────────────────


def collate_corrections(corrections: list[dict]) -> tuple[dict | None, int]:
    """Regroupe les logs 'opening' d'un job par opening_id.

    Renvoie ({opening_id: {"first_cv", "removed", "final"}}, nb_added), ou
    (None, nb_added) si un log est inexploitable (pas de snapshot opening_id)
    — le job entier part alors en triage.
    """
    by_opening: dict[str, dict] = {}
    added = 0
    for log in sorted(corrections, key=lambda entry: entry["created_at"]):
        field = log.get("field")
        if field == "added":
            added += 1
            continue
        cv = log.get("cv_value")
        if not isinstance(cv, dict) or not isinstance(cv.get("opening_id"), str):
            return None, added
        oid = cv["opening_id"]
        entry = by_opening.setdefault(
            oid, {"first_cv": cv, "removed": False, "final": {}}
        )
        if field == "removed":
            entry["removed"] = True
        elif field in ("type", "width_cm", "height_cm", "count"):
            uv = log.get("user_value")
            if not isinstance(uv, dict):
                return None, added
            entry["final"][field] = uv.get(field)
            # Baisse du count = suppression partielle d'un groupe : impossible
            # de savoir quelles boîtes disparaissent → prudence maximale.
            if field == "count":
                before, after = cv.get("count"), uv.get("count")
                if (isinstance(before, int) and isinstance(after, int)
                        and after < before):
                    entry["removed"] = True
        # tout autre field ('removed' géré, inconnus ignorés) : rien
    return by_opening, added


def match_group(first_cv: dict, groups: list[dict]) -> int | None:
    """Apparie un snapshot de correction au groupe de détections d'origine.

    Match strict sur (type, width_cm, height_cm, count) : le snapshot du
    premier log d'une ouverture porte ses valeurs d'origine, identiques au
    groupe qui l'a créée. 0 ou ≥ 2 candidats → None (ambigu).
    """
    candidates = [
        idx for idx, g in enumerate(groups)
        if all(g.get(k) == first_cv.get(k) for k in SNAPSHOT_KEYS)
    ]
    return candidates[0] if len(candidates) == 1 else None


def build_job_labels(
    job: dict, min_conf: float
) -> tuple[dict[str, list[tuple[int, list]]], list[dict], dict]:
    """Labels {image_path: [(classe, bbox_xywh)]} d'un job, + triage + stats.

    Suppose les gates amont (detector yolo, âge, engagement) déjà passés.
    """
    stats = {"boxes_kept": 0, "boxes_low_conf": 0, "added_reports": 0}
    triage: list[dict] = []

    def exclude_all(reason: str):
        triage.append({
            "job_id": job["job_id"],
            "project_id": job["project_id"],
            "reason": reason,
        })
        return {}, triage, stats

    groups = job.get("openings_detail") or []
    collated, added = collate_corrections(job.get("corrections") or [])
    stats["added_reports"] = added
    if collated is None:
        return exclude_all("correction_inexploitable")

    matches: dict[int, dict] = {}
    for entry in collated.values():
        idx = match_group(entry["first_cv"], groups)
        if idx is None or idx in matches:
            return exclude_all("appariement_ambigu")
        matches[idx] = entry

    labels: dict[str, list[tuple[int, list]]] = {}
    excluded_images: set[str] = set()
    for idx, group in enumerate(groups):
        entry = matches.get(idx)
        if entry and entry["removed"]:
            # Jamais un négatif (cf. docstring) : images écartées + triage.
            for box in group.get("boxes") or []:
                excluded_images.add(box["image_path"])
            triage.append({
                "job_id": job["job_id"],
                "project_id": job["project_id"],
                "reason": "ouverture_supprimee",
                "group": {k: group.get(k) for k in SNAPSHOT_KEYS},
            })
            continue
        gtype = group.get("type")
        if entry and entry["final"].get("type") in CLASS_IDS:
            gtype = entry["final"]["type"]
        cls = CLASS_IDS.get(gtype)
        if cls is None:
            continue
        for box in group.get("boxes") or []:
            if entry is None and box.get("confidence", 0.0) < min_conf:
                stats["boxes_low_conf"] += 1
                continue
            labels.setdefault(box["image_path"], []).append(
                (cls, box["bbox_xywh"])
            )
            stats["boxes_kept"] += 1

    for path in excluded_images:
        labels.pop(path, None)
    return {p: b for p, b in labels.items() if b}, triage, stats


def to_yolo_line(cls: int, bbox_xywh: list, img_w: int, img_h: int) -> str | None:
    """Bbox pixels (x, y, w, h) → ligne YOLO normalisée, None si dégénérée."""
    if img_w <= 0 or img_h <= 0:
        return None
    x, y, w, h = (float(v) for v in bbox_xywh)
    x1 = min(max(x, 0.0), img_w)
    y1 = min(max(y, 0.0), img_h)
    x2 = min(max(x + w, 0.0), img_w)
    y2 = min(max(y + h, 0.0), img_h)
    bw, bh = x2 - x1, y2 - y1
    if bw < 2 or bh < 2:
        return None
    cx, cy = x1 + bw / 2, y1 + bh / 2
    return (f"{cls} {cx / img_w:.6f} {cy / img_h:.6f} "
            f"{bw / img_w:.6f} {bh / img_h:.6f}")


def split_projects(
    projects: list[tuple[str, str, int]],
    val_fraction: float,
    min_val_images: int,
) -> set[str]:
    """Projets → valid : (project_id, dernier completed_at, nb images).

    Les plus récents d'abord jusqu'à val_fraction du total. Split désactivé
    (retour vide) si le valid n'atteint pas min_val_images ou engloutirait
    tous les projets.
    """
    total = sum(count for _, _, count in projects)
    target = round(total * val_fraction)
    val: set[str] = set()
    val_count = 0
    for project_id, _, count in sorted(
        projects, key=lambda p: p[1], reverse=True
    ):
        if val_count >= target:
            break
        val.add(project_id)
        val_count += count
    if val_count < min_val_images or len(val) >= len(projects):
        return set()
    return val


# ─── Assemblage (I/O) ────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bundle", required=True,
                        help="dossier produit par export_client.py")
    parser.add_argument("--out", required=True, help="dossier du dataset")
    parser.add_argument("--min-age-days", type=int, default=7,
                        help="âge minimal d'un job pour la validation implicite")
    parser.add_argument("--min-conf", type=float, default=0.5,
                        help="confiance minimale des boîtes non corrigées")
    parser.add_argument("--val-fraction", type=float, default=0.2)
    parser.add_argument("--min-val-images", type=int, default=30,
                        help="en dessous, split valid désactivé (tout en train)")
    parser.add_argument("--preview", type=int, default=24)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--now", default=None, help=argparse.SUPPRESS)
    args = parser.parse_args()

    import cv2  # dispo partout (dépendance runtime du service)

    # Les photos utilisateur peuvent être en HEIC (défaut iOS, accepté à
    # l'ingestion) : `cv2.imread` rend None dessus, et chaque label associé
    # partait silencieusement en `image_unreadable`.
    from app.services.image_loader import is_heif, load_bgr

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from prepare_dataset import build_preview

    bundle = Path(args.bundle)
    export_path = bundle / "export.json"
    if not export_path.exists():
        print(f"ERREUR : {export_path} introuvable — lancer export_client.py "
              "d'abord", file=sys.stderr)
        sys.exit(1)
    export = json.loads(export_path.read_text(encoding="utf-8"))
    now = parse_iso(args.now) if args.now else datetime.now(timezone.utc)
    age_limit = now - timedelta(days=args.min_age_days)

    skipped = {"detector": 0, "too_recent": 0, "no_engagement": 0,
               "no_labels": 0, "image_missing": 0, "image_unreadable": 0,
               "degenerate_boxes": 0}
    triage: list[dict] = []
    added_reports = 0
    boxes_low_conf = 0
    cutoff: datetime | None = None

    # digest d'image → retenue (le job le plus récent gagne : une re-analyse
    # des mêmes photos remplace les labels de la précédente)
    selected: dict[str, dict] = {}

    for job in sorted(export["jobs"], key=lambda j: j["completed_at"]):
        completed_at = parse_iso(job["completed_at"])
        if cutoff is None or completed_at > cutoff:
            cutoff = completed_at
        if job.get("opening_detector") != "yolo":
            skipped["detector"] += 1
            continue
        if completed_at > age_limit:
            skipped["too_recent"] += 1
            continue
        counts = job.get("project_correction_counts") or {}
        if (counts.get("dimension", 0) + counts.get("opening", 0)) < 1:
            skipped["no_engagement"] += 1
            continue

        labels, job_triage, stats = build_job_labels(job, args.min_conf)
        triage.extend(job_triage)
        added_reports += stats["added_reports"]
        boxes_low_conf += stats["boxes_low_conf"]
        if not labels:
            skipped["no_labels"] += 1
            continue

        for image_path, boxes in labels.items():
            src = bundle / "images" / image_path
            if not src.exists():
                skipped["image_missing"] += 1
                continue
            digest = hashlib.sha256(src.read_bytes()).hexdigest()
            selected[digest] = {
                "src": src,
                "image_path": image_path,
                "boxes": boxes,
                "job_id": job["job_id"],
                "project_id": job["project_id"],
                "completed_at": job["completed_at"],
            }

    out = Path(args.out).resolve()
    for split in ("train", "valid"):
        (out / split / "images").mkdir(parents=True, exist_ok=True)
        (out / split / "labels").mkdir(parents=True, exist_ok=True)

    project_latest: dict[str, str] = {}
    project_counts: dict[str, int] = {}
    for item in selected.values():
        pid = item["project_id"]
        project_counts[pid] = project_counts.get(pid, 0) + 1
        if item["completed_at"] > project_latest.get(pid, ""):
            project_latest[pid] = item["completed_at"]
    val_projects = split_projects(
        [(pid, project_latest[pid], project_counts[pid])
         for pid in project_counts],
        args.val_fraction, args.min_val_images,
    )

    images_manifest: list[dict] = []
    class_counts = {"door": 0, "window": 0}
    for digest, item in sorted(selected.items()):
        img = load_bgr(item["src"])
        if img is None:
            skipped["image_unreadable"] += 1
            continue
        img_h, img_w = img.shape[:2]
        lines = []
        for cls, bbox in item["boxes"]:
            line = to_yolo_line(cls, bbox, img_w, img_h)
            if line is None:
                skipped["degenerate_boxes"] += 1
                continue
            lines.append(line)
            class_counts["door" if cls == CLASS_IDS["door"] else "window"] += 1
        if not lines:
            skipped["no_labels"] += 1
            continue
        split = "valid" if item["project_id"] in val_projects else "train"
        stem = f"user_{digest[:12]}"
        # Recopie des octets d'origine par défaut (aucune perte de qualité) —
        # sauf en HEIC/HEIF, qu'ultralytics ne sait pas lire davantage : le
        # dataset contiendrait des images mortes. Transcodage JPEG dans ce cas.
        if is_heif(item["src"]):
            suffix = ".jpg"
            dest = out / split / "images" / (stem + suffix)
            cv2.imwrite(str(dest), img)
        else:
            suffix = item["src"].suffix.lower() or ".jpg"
            dest = out / split / "images" / (stem + suffix)
            dest.write_bytes(item["src"].read_bytes())
        (out / split / "labels" / (stem + ".txt")).write_text(
            "\n".join(lines) + "\n", encoding="utf-8")
        images_manifest.append({
            "file": f"{split}/images/{stem}{suffix}",
            "source_path": item["image_path"],
            "project_id": item["project_id"],
            "job_id": item["job_id"],
            "job_completed_at": item["completed_at"],
            "split": split,
            "boxes": len(lines),
        })

    split_counts = {
        s: sum(1 for i in images_manifest if i["split"] == s)
        for s in ("train", "valid")
    }

    import yaml
    data_yaml = {
        "path": str(out),
        "train": "train/images",
        "val": "valid/images",
        "nc": 2,
        "names": ["door", "window"],
    }
    with open(out / "data.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(data_yaml, f, sort_keys=False, allow_unicode=True)

    manifest = {
        "generated_at": now.isoformat(),
        # cutoff = dernier job VU dans l'export (inclus ou non) : la
        # prochaine itération mesure « nouveau depuis » contre cette borne.
        "cutoff": cutoff.isoformat() if cutoff else None,
        "params": {
            "min_age_days": args.min_age_days,
            "min_conf": args.min_conf,
            "val_fraction": args.val_fraction,
            "min_val_images": args.min_val_images,
        },
        "counts": {
            "images": split_counts,
            "boxes_by_class": class_counts,
            "boxes_dropped_low_conf": boxes_low_conf,
            "added_reports": added_reports,
            "skipped": skipped,
        },
        "val_split_active": bool(val_projects),
        "triage": triage,
        "images": images_manifest,
        "privacy_notice": (
            "Photos utilisateur : usage interne, transitoire (purge en fin "
            "de cycle par retrain.py), jamais redistribuées avec le modèle."
        ),
    }
    (out / "USER_DATASET_MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.preview and split_counts["train"]:
        build_preview(out, args.preview, args.seed)

    print(f"\nDataset utilisateur : {out}")
    print(f"  images : {split_counts} | boîtes : {class_counts} | "
          f"triage : {len(triage)}")
    print(f"  écartés : {skipped}")
    if not images_manifest:
        print("  (aucune image exploitable — la boucle skippera ce cycle)")


if __name__ == "__main__":
    main()
