"""Le contrat de formats annoncé par l'API doit être tenu par le service CV.

`photos.controller.ts` (`ALLOWED_MIMES`) et `configuration.ts`
(`storage.allowedMimeTypes`) acceptent JPEG, PNG **et HEIC/HEIF** ; les octets
sont stockés tels quels et le chemin est transmis ici. Ces tests vérifient que
chacun de ces formats traverse réellement le pipeline — le cas HEIC échouait
auparavant, à l'analyse et non à l'ingestion, en « Failed to process any
image ». Aucune dépendance ML (CI-safe).
"""

import numpy as np
import pytest
from PIL import Image

from _synthetic_room import build_scenarios
from app.config import settings
from app.services.dimension_calculator import DimensionCalculator
from app.services.image_loader import HEIF_SUPPORTED, is_heif, load_bgr, load_rgb

# Un format par MIME annoncé côté API, avec le suffixe que
# `PhotosService.resolveExtension` pose sur le fichier stocké.
ANNOUNCED_FORMATS = [("jpeg", ".jpg"), ("png", ".png"), ("heif", ".heic")]


class _FakeDepthEstimator:
    def __init__(self, depth_map: np.ndarray):
        self._depth_map = depth_map

    def estimate(self, image) -> np.ndarray:
        return self._depth_map


def _write(array_rgb: np.ndarray, path, pil_format: str):
    Image.fromarray(array_rgb).save(path, format=pil_format)
    return path


def _colour_bands() -> np.ndarray:
    """Trois aplats R/G/B purs (64×48 RGB).

    Des aplats et non du bruit : JPEG comme HEIF sous-échantillonnent la
    chrominance, ce qui détruirait une image aléatoire et rendrait toute
    comparaison de couleurs ininterprétable. Sur de larges zones uniformes la
    teinte survit — c'est ce qui permet d'affirmer l'ordre des canaux.
    """
    rgb = np.zeros((64, 48, 3), dtype=np.uint8)
    rgb[:, :16] = (220, 20, 20)
    rgb[:, 16:32] = (20, 220, 20)
    rgb[:, 32:] = (20, 20, 220)
    return rgb


def test_heif_decoder_is_available():
    """Garde-fou de déploiement.

    L'API accepte le HEIC sans condition : si cette assertion tombe, c'est que
    l'image du service CV a perdu son décodeur et que tout projet iPhone
    échouera à l'analyse. Mieux vaut le voir en CI qu'en production.
    """
    assert HEIF_SUPPORTED, (
        "pillow_heif indisponible : le service ne peut pas décoder les HEIC "
        "que l'API accepte pourtant à l'ingestion (cf. requirements.txt)"
    )


def test_is_heif_matches_stored_extensions():
    assert is_heif("a/b/photo.heic")
    assert is_heif("PHOTO.HEIF")
    assert not is_heif("photo.jpg")


@pytest.mark.parametrize("pil_format,suffix", ANNOUNCED_FORMATS)
def test_every_announced_format_round_trips(tmp_path, pil_format, suffix):
    rgb = _colour_bands()
    path = _write(rgb, tmp_path / f"photo{suffix}", pil_format)

    assert load_rgb(path).size == (48, 64)

    bgr = load_bgr(path)
    assert bgr is not None
    assert bgr.shape == (64, 48, 3)
    # Ordre des canaux : `load_bgr` doit être substituable à `cv2.imread`.
    # Échantillonné au centre de chaque bande, loin du ringing des bords.
    for x, expected_bgr in [(8, (20, 20, 220)), (24, (20, 220, 20)), (40, (220, 20, 20))]:
        assert np.allclose(bgr[32, x], expected_bgr, atol=25), (
            f"{pil_format}: canaux inversés ou couleur perdue en x={x} "
            f"(lu {tuple(int(v) for v in bgr[32, x])}, attendu {expected_bgr})"
        )


def test_load_bgr_returns_none_on_garbage(tmp_path):
    broken = tmp_path / "photo.heic"
    broken.write_bytes(b"pas une image")
    assert load_bgr(broken) is None


def test_full_pipeline_accepts_a_heic_photo(tmp_path, monkeypatch):
    """Le cas qui échouait : mêmes scènes que la non-régression CV-7, en HEIC.

    Prouve que l'ouverture du fichier n'est plus le point de rupture — la
    précision des dimensions reste couverte par `test_dimension_regression`.
    """
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    scenario = build_scenarios()[1]  # door_medium_room

    image_path = _write(
        scenario.image[:, :, ::-1], tmp_path / "salon.heic", "HEIF"
    )

    response = DimensionCalculator(
        depth_estimator=_FakeDepthEstimator(scenario.depth_map),
        opening_detector=None,
    ).process([image_path.name], reference_object=scenario.reference_object)

    assert response.error != "Failed to process any image"
    assert response.status == "success", (
        f"HEIC refusé par le pipeline : {response.status!r} ({response.error})"
    )
    assert response.num_images_processed == 1
