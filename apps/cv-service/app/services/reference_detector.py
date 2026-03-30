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


@dataclass
class DetectedReference:
    """A detected reference object in the image."""

    type: str  # "door"
    bbox: tuple  # (x, y, w, h) in pixels
    height_px: int  # Height in pixels
    height_cm: float  # Known real height in cm
    confidence: float  # 0-1


class ReferenceDetector:
    """Detect reference objects (doors) in room images for scale calibration."""

    def detect_door(
        self, image: np.ndarray, depth_map: np.ndarray
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
                        height_cm=STANDARD_DOOR_HEIGHT_CM,
                        confidence=min(score, 1.0),
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
