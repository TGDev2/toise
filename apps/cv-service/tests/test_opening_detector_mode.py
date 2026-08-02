"""Le mode du détecteur d'ouvertures doit sortir de l'analyse (revue 02/08/2026).

En l'absence des poids YOLO, `OpeningDetector` bascule sur l'heuristique OpenCV
sans que rien ne le dise en aval : les boîtes sortent avec un `confidence` sur la
même échelle 0-1 dans les deux modes, et l'information n'existait qu'enfouie dans
`raw_output`, un dict non typé que l'API NestJS ne lit pas.

Ces tests verrouillent le champ de premier niveau `opening_detector` sur **tous**
les points de sortie de `process()`, chemins d'erreur compris — c'est justement
quand l'analyse échoue qu'on veut savoir avec quoi elle a été tentée.
"""

import numpy as np
import pytest

from app.models.schemas import AnalyzeResponse
from app.services.dimension_calculator import DimensionCalculator
from app.services.opening_detector import OpeningDetector


class _FakeDepthEstimator:
    def estimate(self, image) -> np.ndarray:
        return np.zeros((8, 8), dtype=np.float32)


def _calculator(model) -> DimensionCalculator:
    detector = OpeningDetector()
    detector.model = model
    return DimensionCalculator(_FakeDepthEstimator(), detector)


def test_mode_is_heuristic_without_weights():
    assert _calculator(None).opening_detector_mode() == "heuristic"


def test_mode_is_yolo_once_the_model_is_loaded():
    assert _calculator(object()).opening_detector_mode() == "yolo"


def test_mode_is_none_without_a_detector():
    calculator = DimensionCalculator(_FakeDepthEstimator(), None)
    assert calculator.opening_detector_mode() == "none"


def test_missing_weights_are_not_a_load_failure():
    """Le repli est silencieux par conception : `load_model` n'échoue pas."""
    detector = OpeningDetector()
    detector.load_model("models/absent-on-purpose.pt")
    assert detector.model is None


@pytest.mark.parametrize("model,expected", [(None, "heuristic"), (object(), "yolo")])
def test_error_paths_still_name_the_detector(model, expected):
    # Aucune image : le premier point de sortie de `process()`, un chemin
    # d'erreur. Il portait `opening_detector: "none"` par défaut, ce qui était
    # faux — un détecteur était bien monté.
    response = _calculator(model).process(image_paths=[])

    assert response.status == "error"
    assert response.opening_detector == expected


def test_default_stays_none_on_a_bare_response():
    # Une réponse construite hors pipeline (erreur remontée par le routeur avant
    # d'avoir un calculateur) ne prétend pas qu'un modèle a tourné.
    assert AnalyzeResponse(status="error", error="boom").opening_detector == "none"
