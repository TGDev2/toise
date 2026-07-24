"""Full-pipeline non-regression tests (BACKLOG CV-7).

Runs the real DimensionCalculator.process() — real ContourDetector, real
ReferenceDetector — over a small set of synthetic room images with known
ground-truth dimensions (tests/_synthetic_room.py), and asserts the
recovered width/length/height stay within a bounded deviation. Only depth
estimation is stubbed (no ML model needed, keeping this torch-free like the
rest of the cv-service CI job).

This is a non-regression guard, not an accuracy benchmark: the pipeline is
a coarse heuristic (BACKLOG CV-2/CV-5 track the resulting confidence
intervals), so the tolerance below is loose by design. The bar is "a real
regression trips this", not "this proves the measurements are precise".
"""

import numpy as np
import pytest
from PIL import Image

from _synthetic_room import RoomScenario, build_scenarios
from app.config import settings
from app.services.dimension_calculator import DimensionCalculator

MAX_DEVIATION_PCT = 0.20


class _FakeDepthEstimator:
    """Stands in for DepthEstimator: returns a precomputed depth map instead
    of running a model, so these tests need no torch/transformers."""

    def __init__(self, depth_map: np.ndarray):
        self._depth_map = depth_map

    def estimate(self, image) -> np.ndarray:
        return self._depth_map


def _assert_within_tolerance(actual_cm: int, expected_cm: int, label: str) -> None:
    deviation = abs(actual_cm - expected_cm) / expected_cm
    assert deviation <= MAX_DEVIATION_PCT, (
        f"{label}: got {actual_cm}cm, expected {expected_cm}cm "
        f"(deviation {deviation:.1%} exceeds max {MAX_DEVIATION_PCT:.0%})"
    )


@pytest.mark.parametrize("scenario", build_scenarios(), ids=lambda s: s.name)
def test_dimensions_within_max_deviation(
    scenario: RoomScenario, tmp_path, monkeypatch
):
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))

    image_path = tmp_path / f"{scenario.name}.png"
    Image.fromarray(scenario.image[:, :, ::-1]).save(image_path)  # BGR -> RGB

    calculator = DimensionCalculator(
        depth_estimator=_FakeDepthEstimator(scenario.depth_map),
        opening_detector=None,
    )
    response = calculator.process(
        [image_path.name], reference_object=scenario.reference_object
    )

    assert response.status == "success", (
        f"{scenario.name}: expected status=success, got "
        f"{response.status!r} ({response.error})"
    )
    assert response.reference_detected
    assert response.dimensions is not None

    _assert_within_tolerance(
        response.dimensions.width_cm,
        scenario.expected.width_cm,
        f"{scenario.name}: width",
    )
    _assert_within_tolerance(
        response.dimensions.length_cm,
        scenario.expected.length_cm,
        f"{scenario.name}: length",
    )
    _assert_within_tolerance(
        response.dimensions.height_cm,
        scenario.expected.height_cm,
        f"{scenario.name}: height",
    )
