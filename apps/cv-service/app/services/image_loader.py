"""Ouverture des images uploadées — et seul point d'enregistrement du décodeur HEIF.

L'API accepte HEIC/HEIF à l'ingestion (`ALLOWED_MIMES` de `photos.controller.ts`,
`storage.allowedMimeTypes` de `configuration.ts`) puis stocke les octets **tels
quels**, avec l'extension `.heic` (`PhotosService.resolveExtension`). Le chemin
transmis au service CV par `AnalysisService` peut donc désigner un HEIC — ce que
ni Pillow nu ni OpenCV ne savent décoder. Sans `pillow_heif`, un projet
photographié depuis un iPhone (HEIC est le format par défaut d'iOS) traversait
l'ingestion pour échouer plus loin en « Failed to process any image ».

Deux raisons de passer par ce module plutôt que d'appeler `Image.open` /
`cv2.imread` directement :

- l'enregistrement de l'opener HEIF doit précéder toute ouverture, et le seul
  moyen fiable de le garantir est que l'ouverture en dépende ;
- l'échec d'enregistrement (roue `pillow_heif` absente d'une image de base) ne
  doit pas être fatal : le service reste opérant sur JPEG/PNG, mais il l'annonce
  au démarrage au lieu de le découvrir photo par photo.

Module pur (stdlib + numpy + Pillow) : importable sans torch, testé en CI.
"""

import logging
import math
from pathlib import Path
from typing import Optional, Union

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Suffixes qu'aucune des deux bibliothèques de décodage du service ne gère
# nativement : ils n'existent que si `pillow_heif` a pu s'enregistrer.
HEIF_SUFFIXES = frozenset({".heic", ".heif"})


def _register_heif_opener() -> bool:
    try:
        from pillow_heif import register_heif_opener
    except ImportError:
        logger.warning(
            "pillow_heif absent : les photos HEIC/HEIF seront rejetées alors "
            "que l'API les accepte à l'ingestion. Installer pillow-heif "
            "(cf. requirements.txt)."
        )
        return False

    register_heif_opener()
    logger.info("Décodeur HEIF enregistré (HEIC/HEIF lisibles).")
    return True


#: Vrai si HEIC/HEIF sont décodables dans ce processus. Exposé pour /health.
HEIF_SUPPORTED: bool = _register_heif_opener()


def load_rgb(
    path: Union[str, Path], max_pixels: Optional[int] = None
) -> Image.Image:
    """Ouvre une image en RGB. Lève comme `Image.open` si elle est illisible.

    `max_pixels` borne la surface réellement décodée. Au-delà, l'image est
    **réduite** à ce budget, jamais rejetée : toutes les mesures du pipeline
    sont des rapports entre une longueur en pixels et `px_per_cm` mesuré dans
    la *même* image, donc invariants par mise à l'échelle uniforme. Refuser la
    photo la ferait échouer côté utilisateur pour un problème de ressources qui
    n'est pas le sien.

    La réduction passe par `Image.thumbnail`, qui appelle `draft()` : sur un
    JPEG le décodeur travaille directement en 1/2, 1/4 ou 1/8 et la pleine
    résolution n'est jamais matérialisée en mémoire. C'est ce qui rend la borne
    utile face à un fichier très compressé mais très grand — un JPEG de 20 Mo
    (la limite d'ingestion de l'API) peut porter 100 Mpx.

    `None` ou `0` désactive la borne : c'est le défaut, réservé aux appelants
    hors requête (scripts d'entraînement). Le chemin serveur passe toujours
    `settings.max_image_pixels`.
    """
    image = Image.open(path)
    pixels = image.width * image.height
    if max_pixels and pixels > max_pixels:
        scale = math.sqrt(max_pixels / pixels)
        target = (
            max(1, int(image.width * scale)),
            max(1, int(image.height * scale)),
        )
        logger.warning(
            f"Image {path} réduite : {image.width}×{image.height} "
            f"({pixels / 1e6:.1f} Mpx) dépasse le budget de "
            f"{max_pixels / 1e6:.1f} Mpx → {target[0]}×{target[1]}"
        )
        image.thumbnail(target, Image.LANCZOS)
    return image.convert("RGB")


def load_bgr(
    path: Union[str, Path], max_pixels: Optional[int] = None
) -> Optional[np.ndarray]:
    """Équivalent `cv2.imread` couvrant HEIC/HEIF ; `None` si illisible.

    Rend la même chose que `cv2.imread` (uint8 BGR, `None` en cas d'échec) pour
    rester substituable aux appels existants. `max_pixels` : cf. `load_rgb`.
    """
    try:
        rgb = load_rgb(path, max_pixels=max_pixels)
    except Exception as exc:  # noqa: BLE001 — contrat « None si illisible »
        logger.warning(f"Image illisible {path}: {exc}")
        return None
    return np.asarray(rgb)[:, :, ::-1].copy()


def is_heif(path: Union[str, Path]) -> bool:
    return Path(path).suffix.lower() in HEIF_SUFFIXES
