import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Standard door dimensions
STANDARD_DOOR_HEIGHT_CM = 204
STANDARD_DOOR_WIDTH_CM = 90
DOOR_ASPECT_RATIO = STANDARD_DOOR_WIDTH_CM / STANDARD_DOOR_HEIGHT_CM  # ~0.44

# Planar reference markers (universal calibration objects the user lays flat on
# the wall when no door is visible). Each entry is (long_cm, short_cm) — the two
# real-world side lengths of the object.
#   - A4 sheet: 297 x 210 mm            → aspect (short/long) ≈ 0.707
#   - Bank card (ISO/IEC 7810 ID-1): 85.60 x 53.98 mm → aspect ≈ 0.631
MARKER_SPECS: dict[str, tuple[float, float]] = {
    "a4": (29.7, 21.0),
    "card": (8.56, 5.398),
}

# Fraction-of-image-area bounds for a plausible planar marker. A wall-mounted
# A4/card is small relative to the frame but must be big enough to measure.
MARKER_MIN_AREA_FRAC = 0.005
MARKER_MAX_AREA_FRAC = 0.6
MARKER_SCORE_THRESHOLD = 0.5
# Hard gate on the observed short/long aspect vs the marker's real aspect.
# Tight enough to reject non-markers (a door ≈ 0.44) and to keep A4 (≈ 0.707)
# and card (≈ 0.631) distinct. A marker photographed roughly frontally (per the
# UI guidance) stays well inside this band; a heavily skewed shot is rejected as
# no_reference rather than yielding a silently wrong scale.
MARKER_ASPECT_TOL = 0.06


@dataclass
class DetectedReference:
    """A detected reference object in the image."""

    type: str  # "door" | "a4" | "card"
    bbox: tuple  # (x, y, w, h) in pixels
    height_px: int  # Height in pixels
    height_cm: float  # Known real height in cm
    confidence: float  # 0-1
    px_per_cm: float = 0.0  # Scale factor derived from this reference


class ReferenceDetector:
    """Detect reference objects in room images for scale calibration.

    Two calibration sources are supported:
    - a standard door (~204 cm), auto-detected when no explicit marker is asked;
    - a universal planar marker (A4 sheet or bank card) the user lays on the
      wall, which unblocks photos without a visible door (BACKLOG CV-3).
    """

    def detect(
        self,
        image: np.ndarray,
        depth_map: np.ndarray,
        reference_object=None,
    ) -> Optional[DetectedReference]:
        """
        Detect the requested reference object for scale calibration.

        Dispatches on ``reference_object.type``:
        - ``None`` / ``"door"`` → door detection (with an optional custom height);
        - ``"a4"`` / ``"card"`` → planar marker detection.

        Args:
            image: BGR image (H x W x 3)
            depth_map: Depth map (H x W)
            reference_object: optional object carrying ``type`` (and ``height_cm``
                for doors). Absent → auto door detection (backwards compatible).

        Returns:
            DetectedReference if found, None otherwise.
        """
        ref_type = getattr(reference_object, "type", None) or "door"

        if ref_type in MARKER_SPECS:
            return self.detect_marker(image, ref_type)

        # Door (default). Honour a caller-provided real height when present.
        height_cm = getattr(reference_object, "height_cm", None)
        if height_cm is None:
            height_cm = STANDARD_DOOR_HEIGHT_CM
        return self.detect_door(image, depth_map, height_cm=height_cm)

    def detect_door(
        self,
        image: np.ndarray,
        depth_map: np.ndarray,
        height_cm: float = STANDARD_DOOR_HEIGHT_CM,
    ) -> Optional[DetectedReference]:
        """
        Detect a standard door in the image.

        Strategy:
        1. Find vertical rectangular regions with door-like aspect ratio
        2. Check for depth discontinuity (doors create an edge in depth map)
        3. Score candidates and return the best match

        Args:
            image: BGR image (H x W x 3)
            depth_map: Depth map (H x W)
            height_cm: Known real door height in cm (default: standard 204 cm)

        Returns:
            DetectedReference if found, None otherwise
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # Edge detection
        edges = cv2.Canny(gray, 50, 150)

        # Dilate to connect nearby edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)

        # Find contours
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        candidates = []

        for contour in contours:
            # Approximate to polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            # Look for roughly rectangular shapes (4 corners)
            if len(approx) < 4 or len(approx) > 8:
                continue

            x, y, bw, bh = cv2.boundingRect(contour)
            area = bw * bh

            # Filter by size: door should be a significant portion of image
            if area < (h * w * 0.02) or area > (h * w * 0.5):
                continue

            # Filter by aspect ratio (door is taller than wide)
            aspect = bw / bh
            if aspect < 0.2 or aspect > 0.7:
                continue

            # Score based on aspect ratio closeness to standard door
            aspect_score = 1.0 - abs(aspect - DOOR_ASPECT_RATIO) / DOOR_ASPECT_RATIO

            # Check depth discontinuity at door boundaries
            depth_score = self._check_depth_discontinuity(
                depth_map, x, y, bw, bh
            )

            # Position score: doors usually touch or are near the floor
            bottom_y = y + bh
            position_score = 1.0 - abs(bottom_y - h) / h

            # Combined score
            score = aspect_score * 0.4 + depth_score * 0.3 + position_score * 0.3

            if score > 0.3:
                candidates.append(
                    (score, DetectedReference(
                        type="door",
                        bbox=(x, y, bw, bh),
                        height_px=bh,
                        height_cm=height_cm,
                        confidence=min(score, 1.0),
                        px_per_cm=bh / height_cm if height_cm > 0 else 0.0,
                    ))
                )

        if not candidates:
            logger.info("No door detected in image")
            return None

        # Return best candidate
        candidates.sort(key=lambda c: c[0], reverse=True)
        best = candidates[0][1]
        logger.info(
            f"Door detected: bbox={best.bbox}, "
            f"height_px={best.height_px}, confidence={best.confidence:.2f}"
        )
        return best

    def detect_marker(
        self, image: np.ndarray, ref_type: str
    ) -> Optional[DetectedReference]:
        """
        Detect a planar reference marker (A4 sheet or bank card) laid flat on a
        wall, and derive the pixel-per-cm scale from its known real dimensions.

        Strategy:
        1. Find convex quadrilateral contours of a plausible size.
        2. Measure the two side lengths in pixels (mean of opposite sides).
        3. Score each candidate by how closely its aspect ratio matches the
           marker's real short/long ratio and how rectangular it is.
        4. Return the best candidate, with ``px_per_cm`` averaged over both axes.

        Args:
            image: BGR image (H x W x 3)
            ref_type: marker key present in ``MARKER_SPECS`` ("a4" | "card")

        Returns:
            DetectedReference (``type=ref_type``) if found, None otherwise.
        """
        long_cm, short_cm = MARKER_SPECS[ref_type]
        expected_aspect = short_cm / long_cm

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        image_area = float(h * w)

        edges = cv2.Canny(gray, 50, 150)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        contours, _ = cv2.findContours(
            edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
        )

        best: Optional[tuple[float, DetectedReference]] = None

        for contour in contours:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

            # Only clean quadrilaterals (a flat sheet/card seen ~frontally).
            if len(approx) != 4 or not cv2.isContourConvex(approx):
                continue

            area = cv2.contourArea(approx)
            if (
                area < image_area * MARKER_MIN_AREA_FRAC
                or area > image_area * MARKER_MAX_AREA_FRAC
            ):
                continue

            quad = self._order_quad(approx.reshape(4, 2).astype(np.float32))
            tl, tr, br, bl = quad
            width_px = 0.5 * (
                np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)
            )
            height_px = 0.5 * (
                np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)
            )
            long_px = max(width_px, height_px)
            short_px = min(width_px, height_px)
            if long_px <= 1e-6:
                continue

            observed_aspect = short_px / long_px
            # Hard aspect gate: reject anything that isn't this marker's shape
            # (a door, a window, a wall panel…) before trusting its scale.
            if abs(observed_aspect - expected_aspect) > MARKER_ASPECT_TOL:
                continue
            aspect_score = max(
                0.0, 1.0 - abs(observed_aspect - expected_aspect) / expected_aspect
            )

            # Rectangularity: quad area vs its axis-aligned side product.
            rect_score = min(area / (long_px * short_px), 1.0)

            score = aspect_score * 0.6 + rect_score * 0.4
            if score < MARKER_SCORE_THRESHOLD:
                continue

            px_per_cm = 0.5 * (long_px / long_cm + short_px / short_cm)
            x, y, bw, bh = cv2.boundingRect(approx)
            candidate = DetectedReference(
                type=ref_type,
                bbox=(int(x), int(y), int(bw), int(bh)),
                height_px=int(round(long_px)),
                height_cm=long_cm,
                confidence=min(score, 1.0),
                px_per_cm=px_per_cm,
            )
            if best is None or score > best[0]:
                best = (score, candidate)

        if best is None:
            logger.info(f"No {ref_type} marker detected in image")
            return None

        result = best[1]
        logger.info(
            f"Marker '{ref_type}' detected: bbox={result.bbox}, "
            f"px_per_cm={result.px_per_cm:.3f}, "
            f"confidence={result.confidence:.2f}"
        )
        return result

    @staticmethod
    def _order_quad(pts: np.ndarray) -> np.ndarray:
        """Order 4 points as top-left, top-right, bottom-right, bottom-left.

        Uses the classic coordinate-sum / coordinate-diff trick: the top-left
        has the smallest x+y, the bottom-right the largest; the top-right has
        the smallest x-y, the bottom-left the largest.
        """
        s = pts.sum(axis=1)
        diff = pts[:, 0] - pts[:, 1]
        tl = pts[np.argmin(s)]
        br = pts[np.argmax(s)]
        tr = pts[np.argmax(diff)]
        bl = pts[np.argmin(diff)]
        return np.array([tl, tr, br, bl], dtype=np.float32)

    def _check_depth_discontinuity(
        self,
        depth_map: np.ndarray,
        x: int,
        y: int,
        w: int,
        h: int,
    ) -> float:
        """
        Check if there's a depth discontinuity at the boundaries of
        the detected rectangle (doors create depth edges).

        Returns a score 0-1 where higher means more likely a door.
        """
        map_h, map_w = depth_map.shape
        margin = max(5, min(w, h) // 10)

        # Clamp coordinates
        x1 = max(0, x - margin)
        x2 = min(map_w, x + w + margin)
        y1 = max(0, y - margin)
        y2 = min(map_h, y + h + margin)

        # Inside region average depth
        inner = depth_map[y : y + h, x : x + w]
        if inner.size == 0:
            return 0.0
        inner_mean = np.mean(inner)

        # Border region average depth
        border_mask = np.zeros_like(depth_map, dtype=bool)
        border_mask[y1:y2, x1:x2] = True
        border_mask[y : y + h, x : x + w] = False
        border_vals = depth_map[border_mask]

        if border_vals.size == 0:
            return 0.0
        border_mean = np.mean(border_vals)

        # Depth difference (doors are typically recessed or open to another space)
        depth_range = np.max(depth_map) - np.min(depth_map)
        if depth_range < 1e-6:
            return 0.0

        diff = abs(inner_mean - border_mean) / depth_range
        return min(diff * 3, 1.0)  # Scale up, cap at 1
