#!/usr/bin/env python3
"""Assemble le dataset portes/fenêtres au format YOLOv8.

Télécharge les sources publiques (Roboflow, option Open Images V7), remappe
toutes les classes vers le contrat runtime {0: door, 1: window} (voir
app/services/opening_detector.py), dédoublonne les images entre sources par
hash de contenu, préserve les splits train/valid/test des sources, puis émet :

  <out>/data.yaml               — config ultralytics (nc: 2, chemin absolu)
  <out>/DATASET_MANIFEST.json   — sources, versions, licences (attribution
                                  CC BY 4.0), comptes par split/classe
  <out>/preview.jpg             — mosaïque de contrôle qualité des labels
                                  (--preview N, à inspecter AVANT d'entraîner)

Prérequis : ROBOFLOW_API_KEY dans l'environnement (compte gratuit,
https://app.roboflow.com → Settings → API Key).

Exemples :
  python training/prepare_dataset.py --out datasets/door-window --preview 24
  python training/prepare_dataset.py --out datasets/door-window --include-paul-yi
  python training/prepare_dataset.py --out datasets/dry-run --limit 20 --preview 12
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

CLASS_DOOR = 0
CLASS_WINDOW = 1
TARGET_NAMES = ["door", "window"]

# Alias (minuscules) → classe cible. Tout nom absent de cette table est
# supprimé (comptabilisé dans le manifest, ex. "stairs" chez Paul Yi).
NAME_TO_TARGET = {
    "door": CLASS_DOOR,
    "doors": CLASS_DOOR,
    "porte": CLASS_DOOR,
    "window": CLASS_WINDOW,
    "windows": CLASS_WINDOW,
    "fenetre": CLASS_WINDOW,
    "fenêtre": CLASS_WINDOW,
}

SPLITS = ("train", "valid", "test")

# Versions de projet Roboflow épinglées pour la reproductibilité. Utiliser la
# version BRUTE (non augmentée) : les augmentations Roboflow créent des
# quasi-doublons qui fuiteraient entre train et test après fusion. Si la
# version n'existe plus, l'API liste les versions disponibles dans son erreur ;
# ajuster ici ou via --core-version / --paul-yi-version.
SOURCES = {
    "core": {
        "workspace": "windowsdoors-f281v",
        "project": "doors-windows-iliyz",
        "version": 1,
        "license": "CC BY 4.0",
        "url": "https://universe.roboflow.com/windowsdoors-f281v/doors-windows-iliyz",
        "attribution": "« doors-windows » par windowsdoors (Roboflow Universe), CC BY 4.0",
    },
    "paul-yi": {
        "workspace": "paul-yi-dyfev",
        "project": "doors-and-windows-ca836",
        "version": 1,
        "license": "CC BY 4.0",
        "url": "https://universe.roboflow.com/paul-yi-dyfev/doors-and-windows-ca836",
        "attribution": "« Doors and Windows » par Paul Yi (Roboflow Universe), CC BY 4.0",
    },
}

OPEN_IMAGES_SOURCE = {
    "license": "annotations CC BY 4.0, images CC BY 2.0 (Flickr)",
    "url": "https://storage.googleapis.com/openimages/web/index.html",
    "attribution": "Open Images Dataset V7 (Google LLC), annotations CC BY 4.0",
}

# Images Open Images contenant ces labels = probables portes/vitres de
# véhicules → exclues d'office (bruit de domaine).
OPEN_IMAGES_VEHICLE_LABELS = ["Car", "Truck", "Bus", "Van", "Motorcycle", "Vehicle"]

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def fail(msg: str) -> None:
    print(f"ERREUR : {msg}", file=sys.stderr)
    sys.exit(1)


def download_roboflow(key: str, spec: dict, downloads_dir: Path, api_key: str) -> Path:
    """Télécharge une source Roboflow au format yolov8 ; renvoie sa racine."""
    dest = downloads_dir / key
    if (dest / "data.yaml").exists():
        print(f"[{key}] déjà téléchargé ({dest}), réutilisation")
        return dest
    from roboflow import Roboflow

    print(f"[{key}] téléchargement {spec['workspace']}/{spec['project']} v{spec['version']}…")
    project = Roboflow(api_key=api_key).workspace(spec["workspace"]).project(spec["project"])
    project.version(spec["version"]).download("yolov8", location=str(dest), overwrite=True)
    if not (dest / "data.yaml").exists():
        fail(f"[{key}] data.yaml absent après téléchargement dans {dest}")
    return dest


def download_open_images(downloads_dir: Path, max_samples: int) -> Path:
    """Exporte un sous-ensemble Open Images V7 (Door/Window) au format YOLO.

    Dernier recours de l'échelle d'itération : nécessite `pip install fiftyone`
    et reste bruité malgré le filtre véhicules (portes d'extérieur, cadrages
    éloignés). Inspecter la mosaïque avant usage.
    """
    dest = downloads_dir / "open-images"
    if (dest / "data.yaml").exists():
        print(f"[open-images] déjà exporté ({dest}), réutilisation")
        return dest
    try:
        import fiftyone as fo
        import fiftyone.zoo as foz
        from fiftyone import ViewField as F
    except ImportError:
        fail("--include-open-images requiert fiftyone : pip install fiftyone")

    for fo_split, our_split in (("train", "train"), ("validation", "valid"), ("test", "test")):
        n = max_samples if fo_split == "train" else max(max_samples // 8, 50)
        print(f"[open-images] chargement split {fo_split} (max {n})…")
        ds = foz.load_zoo_dataset(
            "open-images-v7",
            split=fo_split,
            label_types=["detections"],
            classes=["Door", "Window"],
            only_matching=False,
            max_samples=n,
            shuffle=True,
            seed=42,
            dataset_name=f"oi-door-window-{fo_split}",
        )
        view = ds.match(
            ~F("ground_truth.detections").filter(
                F("label").is_in(OPEN_IMAGES_VEHICLE_LABELS)
            ).length()
        ).filter_labels("ground_truth", F("label").is_in(["Door", "Window"]))
        view.export(
            export_dir=str(dest),
            dataset_type=fo.types.YOLOv5Dataset,
            split=our_split,
            classes=["Door", "Window"],
        )
        fo.delete_dataset(f"oi-door-window-{fo_split}")
    return dest


def load_source_names(root: Path) -> dict[int, str]:
    """Lit les noms de classes du data.yaml d'une source (liste ou dict)."""
    with open(root / "data.yaml", encoding="utf-8") as f:
        names = yaml.safe_load(f)["names"]
    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}
    return dict(enumerate(str(n) for n in names))


def find_split_dir(root: Path, split: str) -> Path | None:
    """Trouve le dossier images d'un split (tolère valid/val, plat ou imbriqué)."""
    candidates = [split] + (["val"] if split == "valid" else [])
    for name in candidates:
        for images in (root / name / "images", root / "images" / name):
            if images.is_dir():
                return images
    return None


def remap_label_file(src: Path, names: dict[int, str], dropped: dict[str, int]) -> list[str]:
    """Remappe un fichier de labels YOLO vers {0: door, 1: window}."""
    lines: list[str] = []
    if not src.exists():
        return lines
    for raw in src.read_text(encoding="utf-8").splitlines():
        parts = raw.split()
        if len(parts) < 5:
            continue
        source_name = names.get(int(float(parts[0])), "?")
        target = NAME_TO_TARGET.get(source_name.strip().lower())
        if target is None:
            dropped[source_name] = dropped.get(source_name, 0) + 1
            continue
        lines.append(" ".join([str(target)] + parts[1:5]))
    return lines


def merge_source(
    key: str,
    root: Path,
    out: Path,
    seen_hashes: dict[str, str],
    limit: int | None,
    stats: dict,
) -> None:
    """Fusionne une source (déjà au format YOLO) dans l'arborescence cible."""
    names = load_source_names(root)
    src_stats = {
        "classes_source": [names[k] for k in sorted(names)],
        "splits": {},
        "boxes_dropped_by_class": {},
        "duplicates_skipped": 0,
    }
    for split in SPLITS:
        images_dir = find_split_dir(root, split)
        counts = {"images": 0, "backgrounds": 0, "door": 0, "window": 0}
        if images_dir is not None:
            image_paths = sorted(
                p for p in images_dir.iterdir() if p.suffix.lower() in IMG_EXTS
            )
            if limit is not None:
                image_paths = image_paths[:limit]
            for img in image_paths:
                digest = hashlib.sha256(img.read_bytes()).hexdigest()
                if digest in seen_hashes:
                    src_stats["duplicates_skipped"] += 1
                    continue
                seen_hashes[digest] = f"{key}/{split}/{img.name}"
                label = images_dir.parent / "labels" / (img.stem + ".txt")
                if not label.exists():  # variante plate images/<split> ↔ labels/<split>
                    label = root / "labels" / split / (img.stem + ".txt")
                lines = remap_label_file(label, names, src_stats["boxes_dropped_by_class"])
                new_stem = f"{key}_{digest[:12]}"
                shutil.copy2(img, out / split / "images" / (new_stem + img.suffix.lower()))
                (out / split / "labels" / (new_stem + ".txt")).write_text(
                    "\n".join(lines) + ("\n" if lines else ""), encoding="utf-8"
                )
                counts["images"] += 1
                if not lines:
                    # Image sans porte/fenêtre restante : conservée comme
                    # négatif (améliore la précision).
                    counts["backgrounds"] += 1
                for line in lines:
                    counts[TARGET_NAMES[int(line.split()[0])]] += 1
        src_stats["splits"][split] = counts
    stats[key] = src_stats
    print(f"[{key}] fusionné : {json.dumps(src_stats['splits'], ensure_ascii=False)}")


def build_preview(out: Path, n: int, seed: int) -> None:
    """Mosaïque d'images train annotées, pour inspection humaine des labels."""
    import cv2

    images = sorted((out / "train" / "images").iterdir())
    if not images:
        print("preview : aucune image train, mosaïque ignorée")
        return
    random.Random(seed).shuffle(images)
    tiles = []
    tile_size = 320
    colors = {CLASS_DOOR: (0, 200, 0), CLASS_WINDOW: (255, 128, 0)}  # BGR
    for img_path in images[:n]:
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]
        label = out / "train" / "labels" / (img_path.stem + ".txt")
        if label.exists():
            for raw in label.read_text(encoding="utf-8").splitlines():
                cls, cx, cy, bw, bh = raw.split()[:5]
                cls = int(cls)
                cx, cy, bw, bh = (float(v) for v in (cx, cy, bw, bh))
                x1, y1 = int((cx - bw / 2) * w), int((cy - bh / 2) * h)
                x2, y2 = int((cx + bw / 2) * w), int((cy + bh / 2) * h)
                cv2.rectangle(img, (x1, y1), (x2, y2), colors[cls], max(2, w // 320))
                cv2.putText(img, TARGET_NAMES[cls], (x1, max(y1 - 4, 12)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, colors[cls], 2)
        tiles.append(cv2.resize(img, (tile_size, tile_size)))
    if not tiles:
        return
    cols = max(int(len(tiles) ** 0.5), 1)
    rows = (len(tiles) + cols - 1) // cols
    blank = 255 * (tiles[0] * 0 + 1)
    tiles += [blank] * (rows * cols - len(tiles))
    mosaic = cv2.vconcat([cv2.hconcat(tiles[r * cols:(r + 1) * cols]) for r in range(rows)])
    cv2.imwrite(str(out / "preview.jpg"), mosaic)
    print(f"preview : {out / 'preview.jpg'} ({len(images[:n])} images) — À INSPECTER avant d'entraîner")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="datasets/door-window", help="dossier de sortie")
    parser.add_argument("--include-paul-yi", action="store_true",
                        help="ajoute le dataset Paul Yi (4,8k, classe stairs supprimée)")
    parser.add_argument("--include-open-images", action="store_true",
                        help="ajoute un sous-ensemble Open Images V7 filtré (requiert fiftyone)")
    parser.add_argument("--open-images-max", type=int, default=2000,
                        help="max d'images Open Images pour le split train (défaut 2000)")
    parser.add_argument("--limit", type=int, default=None,
                        help="max d'images par source et par split (dry-run CPU)")
    parser.add_argument("--preview", type=int, default=24,
                        help="taille de la mosaïque de contrôle (0 = désactivée)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--core-version", type=int, default=None,
                        help="surcharge la version Roboflow de la source core")
    parser.add_argument("--paul-yi-version", type=int, default=None,
                        help="surcharge la version Roboflow de la source paul-yi")
    args = parser.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        fail("ROBOFLOW_API_KEY manquante. Compte gratuit : https://app.roboflow.com "
             "→ Settings → API Key, puis `export ROBOFLOW_API_KEY=...`")

    if args.core_version is not None:
        SOURCES["core"]["version"] = args.core_version
    if args.paul_yi_version is not None:
        SOURCES["paul-yi"]["version"] = args.paul_yi_version

    out = Path(args.out).resolve()
    downloads = out / "_downloads"
    for split in SPLITS:
        (out / split / "images").mkdir(parents=True, exist_ok=True)
        (out / split / "labels").mkdir(parents=True, exist_ok=True)

    selected = ["core"] + (["paul-yi"] if args.include_paul_yi else [])
    seen_hashes: dict[str, str] = {}
    stats: dict = {}
    manifest_sources = {}

    for key in selected:
        spec = SOURCES[key]
        root = download_roboflow(key, spec, downloads, api_key)
        merge_source(key, root, out, seen_hashes, args.limit, stats)
        manifest_sources[key] = {k: spec[k] for k in ("workspace", "project", "version",
                                                      "license", "url", "attribution")}

    if args.include_open_images:
        root = download_open_images(downloads, args.open_images_max)
        merge_source("open-images", root, out, seen_hashes, args.limit, stats)
        manifest_sources["open-images"] = dict(OPEN_IMAGES_SOURCE)

    data_yaml = {
        # Chemin absolu : évite la résolution via le datasets_dir global
        # d'ultralytics (gotcha classique). data.yaml est donc lié à la machine
        # qui a exécuté prepare_dataset.py — régénérer si le dossier bouge.
        "path": str(out),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": 2,
        "names": TARGET_NAMES,
    }
    with open(out / "data.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(data_yaml, f, sort_keys=False, allow_unicode=True)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "args": {k: v for k, v in vars(args).items()},
        "target_classes": dict(enumerate(TARGET_NAMES)),
        "sources": manifest_sources,
        "stats": stats,
        "attribution_notice": (
            "Datasets sous licence CC BY 4.0 : l'attribution ci-dessus doit "
            "accompagner toute redistribution du modèle (reprise dans MODEL_CARD.md)."
        ),
    }
    with open(out / "DATASET_MANIFEST.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    if args.preview:
        build_preview(out, args.preview, args.seed)

    totals = {s: sum(stats[k]["splits"][s]["images"] for k in stats) for s in SPLITS}
    print(f"\nDataset prêt : {out}")
    print(f"  images : {totals} | data.yaml + DATASET_MANIFEST.json écrits")
    print("  Prochaine étape : inspecter preview.jpg, puis training/train.py")


if __name__ == "__main__":
    main()
