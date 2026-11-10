#!/usr/bin/env python3
"""Récupère l'export de ré-entraînement CV-6 depuis l'API Toisé.

Appelle GET /admin/cv-retraining/export (paginé) puis télécharge les photos
référencées via GET /admin/cv-retraining/photo?path=… — auth Firebase
(signInWithPassword) avec un compte admin dédié, aucun mécanisme d'auth
spécifique.

Sorties dans --out (le « bundle », transitoire — purgé par retrain.py) :
  export.json    — jobs concaténés de toutes les pages
  images/…       — photos, arborescence {projectId}/{uuid}.ext préservée

Environnement requis :
  TOISE_API_URL         ex. https://api.toise.fr/api/v1
  FIREBASE_WEB_API_KEY     clé Web du projet Firebase
  TOISE_ADMIN_EMAIL     compte admin dédié à la boucle
  TOISE_ADMIN_PASSWORD

Exemple :
  python training/export_client.py --out training/retrain/bundle
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

FIREBASE_SIGNIN_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
)
PAGE_LIMIT = 200


def fail(msg: str) -> None:
    print(f"ERREUR : {msg}", file=sys.stderr)
    sys.exit(1)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"variable d'environnement {name} manquante (voir docstring)")
    return value


def firebase_sign_in(api_key: str, email: str, password: str) -> str:
    """Échange email/mot de passe contre un ID token Firebase."""
    resp = requests.post(
        FIREBASE_SIGNIN_URL,
        params={"key": api_key},
        json={"email": email, "password": password, "returnSecureToken": True},
        timeout=30,
    )
    if resp.status_code != 200:
        fail(f"authentification Firebase refusée ({resp.status_code}) : "
             f"{resp.text[:200]}")
    return resp.json()["idToken"]


def fetch_export(api_url: str, token: str, since: str | None) -> list[dict]:
    """Concatène toutes les pages de l'export."""
    headers = {"Authorization": f"Bearer {token}"}
    jobs: list[dict] = []
    cursor = since
    while True:
        params: dict = {"limit": PAGE_LIMIT}
        if cursor:
            params["since"] = cursor
        resp = requests.get(f"{api_url}/admin/cv-retraining/export",
                            headers=headers, params=params, timeout=120)
        if resp.status_code != 200:
            fail(f"export refusé ({resp.status_code}) : {resp.text[:200]}")
        page = resp.json()
        jobs.extend(page["jobs"])
        cursor = page.get("next_since")
        print(f"  page reçue : {page['job_count']} jobs exploitables "
              f"(cursor → {cursor})")
        if not cursor:
            return jobs


def download_images(api_url: str, token: str, jobs: list[dict],
                    images_dir: Path) -> dict[str, int]:
    """Télécharge chaque photo référencée ; 404 (photo supprimée) → skip."""
    headers = {"Authorization": f"Bearer {token}"}
    paths = sorted({
        entry["image_path"]
        for job in jobs
        for entry in job.get("per_image", [])
        if entry.get("image_path")
    })
    stats = {"downloaded": 0, "missing": 0, "already": 0}
    for rel in paths:
        dest = images_dir / rel
        if dest.exists():
            stats["already"] += 1
            continue
        resp = requests.get(f"{api_url}/admin/cv-retraining/photo",
                            headers=headers, params={"path": rel},
                            timeout=120)
        if resp.status_code == 404:
            print(f"  photo absente (supprimée ?) : {rel} — ignorée")
            stats["missing"] += 1
            continue
        if resp.status_code != 200:
            fail(f"téléchargement de {rel} refusé ({resp.status_code})")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.content)
        stats["downloaded"] += 1
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="training/retrain/bundle",
                        help="dossier du bundle (export.json + images/)")
    parser.add_argument("--since", default=None,
                        help="ISO 8601 : n'exporter que les jobs complétés après")
    args = parser.parse_args()

    api_url = require_env("TOISE_API_URL").rstrip("/")
    api_key = require_env("FIREBASE_WEB_API_KEY")
    email = require_env("TOISE_ADMIN_EMAIL")
    password = require_env("TOISE_ADMIN_PASSWORD")

    out = Path(args.out)
    images_dir = out / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print("Authentification Firebase…")
    token = firebase_sign_in(api_key, email, password)

    print("Export des jobs…")
    jobs = fetch_export(api_url, token, args.since)
    print(f"{len(jobs)} jobs exploitables au total")

    print("Téléchargement des photos…")
    stats = download_images(api_url, token, jobs, images_dir)
    print(f"  {stats['downloaded']} téléchargées, {stats['already']} déjà "
          f"présentes, {stats['missing']} manquantes")

    bundle = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "since": args.since,
        "job_count": len(jobs),
        "image_stats": stats,
        "jobs": jobs,
    }
    (out / "export.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Bundle écrit : {out / 'export.json'}")


if __name__ == "__main__":
    main()
