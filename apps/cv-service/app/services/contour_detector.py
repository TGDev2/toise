import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class RoomContours:
    """Detected room boundaries from the image."""

    floor_mask: np.ndarray  # Binary mask of floor region
    wall_lines: list  # List of (x1, y1, x2, y2) wall boundary lines
    vanishing_points: list  # Estimated vanishing points
    image_height: int
    image_width: int


class ContourDetector:
    """Detect room contours (walls, floor, ceiling) using OpenCV."""

    def detect(self, image: np.ndarray, depth_map: np.ndarray) -> RoomContours:
        """
        Detect room structure from image + depth map.

        Uses edge detection on the depth map to find wall-floor and
        wall-ceiling boundaries, then Hough line transform to extract
        structural lines.

        Args:
            image: BGR image as numpy array (H x W x 3)
            depth_map: Depth map (H x W)

        Returns:
            RoomContours with detected boundaries
        """
        h, w = image.shape[:2]

        # Normalize depth map to 0-255 for edge detection
        depth_norm = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX)
        depth_uint8 = depth_norm.astype(np.uint8)

        # Blur to reduce noise
        depth_blurred = cv2.GaussianBlur(depth_uint8, (5, 5), 0)

        # Canny edge detection on depth map
        edges = cv2.Canny(depth_blurred, 30, 100)

        # Hough line detection
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=80,
            minLineLength=min(h, w) // 6,
            maxLineGap=20,
        )

        wall_lines = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                # Filter: keep mostly horizontal or vertical lines
                angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
                if angle < 15 or angle > 75:
                    wall_lines.append((x1, y1, x2, y2))

        # Floor detection: bottom region with relatively uniform depth
        floor_mask = self._detect_floor(depth_uint8, h, w)

        # Estimate vanishing points from line intersections
        vanishing_points = self._estimate_vanishing_points(wall_lines, h, w)

        logger.info(
            f"Detected {len(wall_lines)} wall lines, "
            f"floor coverage: {np.sum(floor_mask) / floor_mask.size:.1%}"
        )

        return RoomContours(
            floor_mask=floor_mask,
            wall_lines=wall_lines,
            vanishing_points=vanishing_points,
            image_height=h,
            image_width=w,
        )

    def _detect_floor(
        self, depth_uint8: np.ndarray, h: int, w: int
    ) -> np.ndarray:
        """Detect floor region using depth gradient analysis."""
        # The floor typically occupies the bottom portion of the image
        # and has a smooth depth gradient (increasing from bottom to top)
        bottom_half = depth_uint8[h // 2 :, :]

        # Use Otsu threshold on bottom half to separate floor from walls
        _, floor_region = cv2.threshold(
            bottom_half, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )

        # Create full-size mask
        floor_mask = np.zeros((h, w), dtype=np.uint8)
        floor_mask[h // 2 :, :] = floor_region

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        floor_mask = cv2.morphologyEx(floor_mask, cv2.MORPH_CLOSE, kernel)
        floor_mask = cv2.morphologyEx(floor_mask, cv2.MORPH_OPEN, kernel)

        return floor_mask

    def _estimate_vanishing_points(
        self, wall_lines: list, h: int, w: int
    ) -> list:
        """Estimate vanishing points from detected lines."""
        if len(wall_lines) < 2:
            return [(w // 2, h // 3)]  # Default center-ish vanishing point

        # Separate horizontal-ish and vertical-ish lines
        horizontal = []
        vertical = []

        for x1, y1, x2, y2 in wall_lines:
            angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
            if angle < 15:
                horizontal.append((x1, y1, x2, y2))
            elif angle > 75:
                vertical.append((x1, y1, x2, y2))

        vanishing_points = []

        # Estimate horizontal vanishing point (where horizontal lines converge)
        if len(horizontal) >= 2:
            # Simple average of line endpoints' midpoint
            mid_x = np.mean([(x1 + x2) / 2 for x1, y1, x2, y2 in horizontal])
            mid_y = np.mean([(y1 + y2) / 2 for x1, y1, x2, y2 in horizontal])
            vanishing_points.append((int(mid_x), int(mid_y)))

        if not vanishing_points:
            vanishing_points.append((w // 2, h // 3))

        return vanishing_points
