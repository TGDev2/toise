"""Unit tests for scale calibration references (BACKLOG CV-3).

Covers both calibration sources without any ML dependency (cv2 + numpy only):
- the standard door (auto-detected, ~204 cm);
- the universal planar markers (A4 sheet / bank card) that unblock photos with
  no visible door.

All fixtures are synthetic images built in memory (same approach as
``training/smoke_test.py``) so the suite is deterministic and fast.
"""

from types import SimpleNamespace

import cv2
import numpy as np

from app.models.schemas import ReferenceObject
from app.services.reference_detector import (
    MARKER_SPECS,
    STANDARD_DOOR_HEIGHT_CM,
    DetectedReference,
    ReferenceDetector,
)


def _blank(h: int, w: int, value: int = 200) -> np.ndarray:
    """Uniform BGR canvas (no edges → nothing detectable)."""
    return np.full((h, w, 3), value, dtype=np.uint8)


def _rect_image(
    h: int,
    w: int,
    x: int,
    y: int,
    rw: int,
    rh: int,
    fill: int,
    bg: int = 200,
) -> np.ndarray:
    """Canvas with a single solid rectangle (a crisp quad for the detector)."""
    img = _blank(h, w, bg)
    cv2.rectangle(img, (x, y), (x + rw, y + rh), (fill, fill, fill), thickness=-1)
    return img


def _make_door_image() -> np.ndarray:
    """Tall dark rectangle touching the floor, door aspect ~0.44."""
    h, w = 800, 600
    door_w, door_h = 90, 204  # 90/204 ≈ 0.44
    x = (w - door_w) // 2
    y = h - door_h  # bottom edge touches the floor
    return _rect_image(h, w, x, y, door_w, door_h, fill=40)


# --------------------------------------------------------------------------- #
# Door (existing behaviour, now also exposing px_per_cm)                       #
# --------------------------------------------------------------------------- #


def test_detect_door_returns_scale():
    detector = ReferenceDetector()
    image = _make_door_image()
    depth = np.zeros(image.shape[:2], dtype=np.float32)

    ref = detector.detect_door(image, depth)

    assert ref is not None
    assert ref.type == "door"
    assert ref.height_cm == STANDARD_DOOR_HEIGHT_CM
    assert ref.height_px > 0
    # px_per_cm is the single source of scale and must match height/height_cm.
    assert ref.px_per_cm == ref.height_px / STANDARD_DOOR_HEIGHT_CM
    # ~204 px tall door calibrated at 204 cm → ~1 px/cm.
    assert abs(ref.px_per_cm - 1.0) < 0.1


def test_detect_door_honours_custom_height():
    detector = ReferenceDetector()
    image = _make_door_image()
    depth = np.zeros(image.shape[:2], dtype=np.float32)

    ref_default = detector.detect_door(image, depth)
    ref_half = detector.detect_door(image, depth, height_cm=102)

    assert ref_default is not None and ref_half is not None
    # Same pixels, half the real height → twice the scale.
    assert abs(ref_half.px_per_cm - 2 * ref_default.px_per_cm) < 1e-6


# --------------------------------------------------------------------------- #
# Planar markers (A4 / bank card) — the CV-3 feature                          #
# --------------------------------------------------------------------------- #


def test_detect_a4_marker_scale():
    long_cm, short_cm = MARKER_SPECS["a4"]
    long_px, short_px = 297, 210  # 210/297 == 21/29.7 (exact A4 aspect)
    image = _rect_image(480, 640, 170, 90, short_px, long_px, fill=250, bg=120)

    ref = ReferenceDetector().detect_marker(image, "a4")

    assert ref is not None
    assert ref.type == "a4"
    expected = 0.5 * (long_px / long_cm + short_px / short_cm)  # == 10.0
    assert abs(ref.px_per_cm - expected) < 0.6
    assert ref.confidence > 0.5


def test_detect_card_marker_scale():
    long_cm, short_cm = MARKER_SPECS["card"]
    long_px, short_px = 428, 270  # ratio ≈ ISO ID-1 (0.631)
    image = _rect_image(480, 640, 110, 40, long_px, short_px, fill=250, bg=120)

    ref = ReferenceDetector().detect_marker(image, "card")

    assert ref is not None
    assert ref.type == "card"
    expected = 0.5 * (long_px / long_cm + short_px / short_cm)  # ≈ 50
    assert abs(ref.px_per_cm - expected) < 3.0


def test_detect_marker_absent_returns_none():
    # Uniform canvas → no contours → nothing to calibrate on.
    image = _blank(480, 640)
    assert ReferenceDetector().detect_marker(image, "a4") is None


# --------------------------------------------------------------------------- #
# Dispatcher: detect() routes on reference_object.type                         #
# --------------------------------------------------------------------------- #


def test_detect_dispatches_to_marker_for_a4():
    long_px, short_px = 297, 210
    image = _rect_image(480, 640, 170, 90, short_px, long_px, fill=250, bg=120)
    depth = np.zeros(image.shape[:2], dtype=np.float32)

    ref = ReferenceDetector().detect(image, depth, ReferenceObject(type="a4"))

    assert isinstance(ref, DetectedReference)
    assert ref.type == "a4"
    assert ref.px_per_cm > 0


def test_detect_defaults_to_door_when_no_reference():
    detector = ReferenceDetector()
    image = _make_door_image()
    depth = np.zeros(image.shape[:2], dtype=np.float32)

    via_dispatch = detector.detect(image, depth, None)
    via_door = detector.detect_door(image, depth)

    assert via_dispatch is not None and via_door is not None
    assert via_dispatch.type == "door"
    assert via_dispatch.px_per_cm == via_door.px_per_cm


def test_detect_marker_type_does_not_find_a_door():
    # A door-only photo, but the user says they placed an A4: the door must not
    # be mistaken for the marker → no_reference (None), never a bogus scale.
    detector = ReferenceDetector()
    image = _make_door_image()
    depth = np.zeros(image.shape[:2], dtype=np.float32)

    assert detector.detect(image, depth, SimpleNamespace(type="a4")) is None
