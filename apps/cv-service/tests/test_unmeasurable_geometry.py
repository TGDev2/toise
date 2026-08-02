"""Une géométrie non observée ne doit jamais produire de mesure.

Le pipeline peut trouver une référence d'échelle (une porte, un marqueur A4)
sans rien pouvoir mesurer autour : sol non segmenté, profondeur plate, aucune
ligne de mur horizontale. Ces tests fixent la frontière : dans ces cas il n'y
a pas de triplet métrique, et donc pas de `status="success"` — une valeur de
repli renvoyée comme un succès serait persistée par l'API puis chiffrée.

Ils couvrent aussi le pendant : une mesure bien observée mais invraisemblable
est rejetée, pas ramenée à la borne la plus proche.
"""

from typing import Optional

import numpy as np
import pytest
from PIL import Image

from app.config import settings
from app.models.schemas import ReferenceObject
from app.services.contour_detector import RoomContours
from app.services.dimension_calculator import DimensionCalculator
from app.services.reference_detector import DetectedReference

IMAGE_W, IMAGE_H = 480, 640
PX_PER_CM = 2.0


class _FakeDepthEstimator:
    def __init__(self, depth_map: np.ndarray):
        self._depth_map = depth_map

    def estimate(self, image) -> np.ndarray:
        return self._depth_map


class _FixedContourDetector:
    """Sert des contours choisis par le test, sans passer par Canny/Hough."""

    def __init__(self, contours: RoomContours):
        self._contours = contours

    def detect(self, image, depth_map) -> RoomContours:
        return self._contours


class _FixedReferenceDetector:
    """Trouve toujours une échelle : c'est le reste de la scène qu'on teste."""

    def detect(self, image, depth_map, reference_object) -> DetectedReference:
        return DetectedReference(
            type="door",
            bbox=(0, 0, 90, 204),
            height_px=int(204 * PX_PER_CM),
            height_cm=204.0,
            confidence=0.9,
            px_per_cm=PX_PER_CM,
        )


def _contours(
    floor_mask: Optional[np.ndarray] = None,
    wall_lines: Optional[list] = None,
) -> RoomContours:
    return RoomContours(
        floor_mask=(
            np.zeros((IMAGE_H, IMAGE_W), dtype=np.uint8)
            if floor_mask is None
            else floor_mask
        ),
        wall_lines=[] if wall_lines is None else wall_lines,
        vanishing_points=[],
        image_height=IMAGE_H,
        image_width=IMAGE_W,
    )


def _full_floor() -> np.ndarray:
    """Sol sur toute la largeur, moitié basse du cadre."""
    mask = np.zeros((IMAGE_H, IMAGE_W), dtype=np.uint8)
    mask[IMAGE_H // 2 :, :] = 255
    return mask


def _horizontal_walls() -> list:
    """Frontières plafond/mur et mur/sol horizontales, 200 cm d'écart."""
    top = 100
    bottom = top + int(200 * PX_PER_CM)
    return [(0, top, IMAGE_W - 1, top), (0, bottom, IMAGE_W - 1, bottom)]


def _gradient_depth() -> np.ndarray:
    """Profondeur décroissante du haut vers le bas : amplitude non nulle."""
    column = np.linspace(0.0, 100.0, IMAGE_H, dtype=np.float32)[::-1]
    return np.repeat(column[:, None], IMAGE_W, axis=1)


def _calculator() -> DimensionCalculator:
    return DimensionCalculator(
        depth_estimator=_FakeDepthEstimator(_gradient_depth()),
        opening_detector=None,
    )


@pytest.mark.parametrize(
    "label, depth_map, contours",
    [
        (
            "aucun sol détecté",
            _gradient_depth(),
            _contours(wall_lines=_horizontal_walls()),
        ),
        (
            "profondeur constante",
            np.full((IMAGE_H, IMAGE_W), 42.0, dtype=np.float32),
            _contours(floor_mask=_full_floor(), wall_lines=_horizontal_walls()),
        ),
        (
            "aucune ligne de mur horizontale",
            _gradient_depth(),
            _contours(floor_mask=_full_floor(), wall_lines=[]),
        ),
        (
            "seulement des lignes verticales",
            _gradient_depth(),
            _contours(
                floor_mask=_full_floor(),
                wall_lines=[(10, 0, 10, IMAGE_H - 1), (400, 0, 400, IMAGE_H - 1)],
            ),
        ),
    ],
)
def test_calculate_dimensions_returns_none_when_geometry_is_missing(
    label, depth_map, contours
):
    dimensions = _calculator()._calculate_dimensions(
        depth_map=depth_map, contours=contours, px_per_cm=PX_PER_CM
    )

    assert dimensions is None, (
        f"{label} : une dimension a été produite ({dimensions}) alors "
        "qu'aucune géométrie ne la porte"
    )


def test_calculate_dimensions_rejects_an_implausible_measurement():
    """Une hauteur mesurée à 60 cm est invraisemblable : on la rejette au lieu
    de la remonter à la borne basse, ce qui inventerait la valeur."""
    tiny_walls = [(0, 100, IMAGE_W - 1, 100), (0, 220, IMAGE_W - 1, 220)]

    dimensions = _calculator()._calculate_dimensions(
        depth_map=_gradient_depth(),
        contours=_contours(floor_mask=_full_floor(), wall_lines=tiny_walls),
        px_per_cm=PX_PER_CM,
    )

    assert dimensions is None


def test_calculate_dimensions_measures_when_the_geometry_is_there():
    """Contre-épreuve : avec sol, profondeur et murs, la mesure sort — et vaut
    ce que la géométrie porte, sans écrêtage."""
    dimensions = _calculator()._calculate_dimensions(
        depth_map=_gradient_depth(),
        contours=_contours(floor_mask=_full_floor(), wall_lines=_horizontal_walls()),
        px_per_cm=PX_PER_CM,
    )

    assert dimensions is not None
    # Largeur : étendue du sol, 479 px / 2 px/cm.
    assert dimensions.width_cm == 239
    # Hauteur : écart des deux frontières horizontales, 400 px / 2 px/cm.
    assert dimensions.height_cm == 200
    # Longueur : le sol couvre la moitié basse, soit la moitié de l'amplitude
    # de profondeur de la scène → environ h/2 px.
    assert 155 <= dimensions.length_cm <= 165


def test_process_does_not_report_success_without_measurable_geometry(
    tmp_path, monkeypatch
):
    """Bout en bout : référence trouvée, scène vide. La réponse ne doit ni
    valoir `success` ni porter de dimensions — c'est elle que l'API persiste."""
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    image_path = tmp_path / "room.png"
    Image.fromarray(np.full((IMAGE_H, IMAGE_W, 3), 120, dtype=np.uint8)).save(
        image_path
    )

    calculator = _calculator()
    calculator.contour_detector = _FixedContourDetector(_contours())
    calculator.reference_detector = _FixedReferenceDetector()

    response = calculator.process(
        [image_path.name], reference_object=ReferenceObject(type="door")
    )

    assert response.status != "success", (
        f"statut {response.status!r} avec dimensions {response.dimensions!r} : "
        "une scène sans géométrie mesurable a produit un succès"
    )
    assert response.dimensions is None
