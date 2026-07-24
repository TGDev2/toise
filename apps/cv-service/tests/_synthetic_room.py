"""Synthetic 'room' scenes for the CV-7 non-regression suite.

Builds a BGR image + a matching depth map from a small set of target
real-world dimensions (width/length/height_cm) and a chosen px_per_cm scale,
such that running them through the *real* ContourDetector (Canny/Hough/Otsu)
and ReferenceDetector (door or planar marker) recovers those dimensions
within a bounded deviation. No ML model involved: the depth map is built
directly, standing in for what DepthEstimator would have produced (see
tests/test_dimension_regression.py for the fake estimator that serves it).

Depth geometry, top to bottom (abstract relative-depth units — only their
relative magnitude matters, same convention as DepthEstimator: higher =
farther from camera):
- ceiling/back-wall band [0, y1): constant low depth
- wall band [y1, y2): constant depth, distinct from the ceiling (so both
  boundaries show up as separate Hough lines)
- floor band [y2, h): linear gradient, comfortably *above* the wall/ceiling
  band in value, bottoming out above the wall at the nearest row and
  peaking at a fixed "horizon" value at y2.

The floor must be the highest-valued region in the bottom half of the
frame: ContourDetector._detect_floor runs cv2.threshold(..., THRESH_BINARY
+ THRESH_OTSU) on that half, and THRESH_BINARY always keeps the
*above-threshold* cluster as foreground — so whichever region has the
higher depth values there is the one classified as "floor". Anything else
in that construction (walls, margins) must stay clearly below it.

y2 (the wall/floor boundary) is always kept >= h // 2 so the full gradient
falls inside the bottom half that this Otsu split examines — otherwise
part of the intended depth range would be invisible to it and the
width/length recovered wouldn't match what was built here.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from app.models.schemas import Dimensions, ReferenceObject
from app.services.reference_detector import (
    MARKER_SPECS,
    STANDARD_DOOR_HEIGHT_CM,
    STANDARD_DOOR_WIDTH_CM,
)

_D_LOW = 0.0  # ceiling band + the margin either side of the floor
_D_WALL = 50.0  # wall band [y1, y2), distinct from the ceiling
_D_FLOOR_FAR = 250.0  # floor depth at the horizon (row y2) — the scene's max

# Floor occupies this fraction of the frame width; the remainder is margin
# either side, so the floor's column extent is a genuine measurement rather
# than "the whole image is floor".
_FLOOR_WIDTH_FRAC = 0.85


@dataclass
class RoomScenario:
    name: str
    image: np.ndarray  # BGR uint8 (H, W, 3)
    depth_map: np.ndarray  # float32 (H, W)
    reference_object: ReferenceObject
    expected: Dimensions  # ground truth used to build the scene


def _canvas_and_bands(
    width_px: int, length_px: int, height_px: int
) -> tuple[int, int, int, int]:
    """Pick (w, h, y1, y2) so the floor gradient always fits inside the
    bottom half of the frame, regardless of how width/length/height relate.
    """
    w = round(width_px / _FLOOR_WIDTH_FRAC)
    margin = round(0.08 * (height_px + length_px)) + 40
    h = max(height_px + length_px + margin, 2 * length_px + margin)
    y2 = h - length_px  # wall/floor boundary
    y1 = y2 - height_px  # ceiling/wall boundary
    assert y1 >= 0 and y2 >= h // 2, (w, h, y1, y2)
    return w, h, y1, y2


def _build_depth_map(
    w: int, h: int, y1: int, y2: int, x0: int, width_px: int
) -> np.ndarray:
    depth = np.full((h, w), _D_WALL, dtype=np.float32)
    depth[:y1, :] = _D_LOW
    depth[y2:h, :] = _D_LOW  # margin either side of the floor columns

    # Floor gradient: _D_FLOOR_FAR at the horizon (row y2) down to a "near"
    # value at the bottom row, kept comfortably above _D_WALL so the floor
    # stays the highest-valued cluster in the bottom half (see module docs).
    length_px = h - y2
    d_near = _D_FLOOR_FAR * (1 - length_px / h)
    assert d_near > _D_WALL, (d_near, _D_WALL, "floor/wall depth bands must not overlap")
    floor_rows = np.arange(y2, h)
    gradient = _D_FLOOR_FAR + (d_near - _D_FLOOR_FAR) * (floor_rows - y2) / max(
        h - 1 - y2, 1
    )
    depth[y2:h, x0 : x0 + width_px] = gradient[:, None]
    return depth


def _base_scene(
    width_cm: int, length_cm: int, height_cm: int, px_per_cm: float
) -> tuple[int, int, int, int, int, np.ndarray]:
    """Shared canvas/depth-map setup for both room builders below.

    Returns (w, h, y1, y2, x0, depth_map); width_px is w's caller-known
    round(width_cm * px_per_cm), needed again to place the reference object.
    """
    width_px = round(width_cm * px_per_cm)
    length_px = round(length_cm * px_per_cm)
    height_px = round(height_cm * px_per_cm)
    w, h, y1, y2 = _canvas_and_bands(width_px, length_px, height_px)
    x0 = round((w - width_px) / 2)
    depth_map = _build_depth_map(w, h, y1, y2, x0, width_px)
    return w, h, y1, y2, x0, depth_map


def _marker_room(
    name: str,
    marker_type: str,
    width_cm: int,
    length_cm: int,
    height_cm: int,
    px_per_cm: float,
) -> RoomScenario:
    w, h, y1, y2, _x0, depth_map = _base_scene(
        width_cm, length_cm, height_cm, px_per_cm
    )

    long_cm, short_cm = MARKER_SPECS[marker_type]
    long_px = round(long_cm * px_per_cm)
    short_px = round(short_cm * px_per_cm)
    frac = (long_px * short_px) / (w * h)
    assert frac >= 0.0065, (
        f"{name}: marker area fraction {frac:.4%} too close to the "
        "detector's 0.5% floor — pick a smaller room or higher px_per_cm"
    )

    image = np.full((h, w, 3), 120, dtype=np.uint8)
    mx = round(w / 2 - short_px / 2)
    my = y1 + round(((y2 - y1) - long_px) / 2)
    cv2.rectangle(
        image, (mx, my), (mx + short_px, my + long_px), (250, 250, 250), thickness=-1
    )

    return RoomScenario(
        name=name,
        image=image,
        depth_map=depth_map,
        reference_object=ReferenceObject(type=marker_type),
        expected=Dimensions(
            length_cm=length_cm, width_cm=width_cm, height_cm=height_cm
        ),
    )


def _door_room(
    name: str,
    width_cm: int,
    length_cm: int,
    height_cm: int,
    px_per_cm: float,
) -> RoomScenario:
    w, h, _y1, _y2, _x0, depth_map = _base_scene(
        width_cm, length_cm, height_cm, px_per_cm
    )

    door_h_px = round(STANDARD_DOOR_HEIGHT_CM * px_per_cm)
    door_w_px = round(STANDARD_DOOR_WIDTH_CM * px_per_cm)
    area_frac = (door_h_px * door_w_px) / (w * h)
    assert 0.03 <= area_frac <= 0.45, (
        f"{name}: door area fraction {area_frac:.2%} outside detect_door's "
        "[2%, 50%] gate — adjust px_per_cm"
    )

    image = np.full((h, w, 3), 220, dtype=np.uint8)
    dx = round((w - door_w_px) / 2)
    dy = h - door_h_px  # bottom edge touches the floor
    cv2.rectangle(
        image, (dx, dy), (dx + door_w_px, dy + door_h_px), (40, 40, 40), thickness=-1
    )

    return RoomScenario(
        name=name,
        image=image,
        depth_map=depth_map,
        reference_object=ReferenceObject(type="door"),
        expected=Dimensions(
            length_cm=length_cm, width_cm=width_cm, height_cm=height_cm
        ),
    )


def build_scenarios() -> list[RoomScenario]:
    """The CV-7 reference image set: known ground-truth dimensions, one per
    calibration path (planar marker vs door) exercised by DimensionCalculator.
    """
    return [
        _marker_room(
            "a4_small_room",
            "a4",
            width_cm=150,
            length_cm=150,
            height_cm=220,
            px_per_cm=7.0,
        ),
        _door_room(
            "door_medium_room",
            width_cm=280,
            length_cm=200,
            height_cm=260,
            px_per_cm=5.0,
        ),
    ]
