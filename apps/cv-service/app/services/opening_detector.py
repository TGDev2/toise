import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Standard opening dimensions (cm)
STANDARD_DOOR_WIDTH_CM = 90
STANDARD_DOOR_HEIGHT_CM = 204
STANDARD_WINDOW_WIDTH_CM = 120
STANDARD_WINDOW_HEIGHT_CM = 100

# YOLO class mappings (for custom door/window model)
CLASS_DOOR = 0
CLASS_WINDOW = 1
CLASS_NAMES = {CLASS_DOOR: "door", CLASS_WINDOW: "window"}

CONFIDENCE_THRESHOLD = 0.3
IOU_THRESHOLD = 0.5


@dataclass
class DetectedOpening:
    """A detected door or window in the image."""

    type: str  # "door" | "window"
    bbox: tuple  # (x, y, w, h) in pixels
    width_cm: int
    height_cm: int
    confidence: float  # 0-1


class OpeningDetector:
    """Detect doors and windows in room images using YOLOv8."""

    def __init__(self):
        self.model = None

    def load_model(self, model_path: str = "models/door-window-yolov8n.pt"):
        """Load the YOLOv8 model for door/window detection."""
        try:
            from ultralytics import YOLO

            self.model = YOLO(model_path)
            logger.info(f"Opening detector model loaded from {model_path}")
        except FileNotFoundError:
            logger.warning(
                f"YOLO model not found at {model_path}, "
                "falling back to heuristic detection"
            )
            self.model = None
        except Exception as e:
            logger.warning(
                f"Failed to load YOLO model: {e}, "
                "falling back to heuristic detection"
            )
            self.model = None

    def detect(
        self,
        image: np.ndarray,
        depth_map: np.ndarray,
        px_per_cm: float,
    ) -> list[DetectedOpening]:
        """
        Detect doors and windows in the image.

        Uses YOLO if available, otherwise falls back to heuristic detection.

        Args:
            image: BGR image (H x W x 3)
            depth_map: Depth map (H x W)
            px_per_cm: Scale factor from reference calibration

        Returns:
            List of detected openings with real-world dimensions
        """
        if self.model is not None:
            return self._detect_yolo(image, px_per_cm)
        return self._detect_heuristic(image, depth_map, px_per_cm)

    def _detect_yolo(
        self, image: np.ndarray, px_per_cm: float
    ) -> list[DetectedOpening]:
        """Detect openings using YOLO model."""
        results = self.model(image, conf=CONFIDENCE_THRESHOLD, verbose=False)

        openings = []
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                opening_type = CLASS_NAMES.get(cls_id)
                if opening_type is None:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bw = x2 - x1
                bh = y2 - y1

                width_cm = max(int(bw / px_per_cm), 30)
                height_cm = max(int(bh / px_per_cm), 30)

                # Sanity clamp
                width_cm = min(width_cm, 300)
                height_cm = min(height_cm, 300)

                openings.append(
                    DetectedOpening(
                        type=opening_type,
                        bbox=(int(x1), int(y1), int(bw), int(bh)),
                        width_cm=width_cm,
                        height_cm=height_cm,
                        confidence=conf,
                    )
                )

        logger.info(f"YOLO detected {len(openings)} openings")
        return openings

    def _detect_heuristic(
        self,
        image: np.ndarray,
        depth_map: np.ndarray,
        px_per_cm: float,
    ) -> list[DetectedOpening]:
        """
        Fallback heuristic detection for doors and windows.

        Doors: tall rectangles near floor with depth discontinuity.
        Windows: rectangles in upper wall area with depth discontinuity.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        edges = cv2.Canny(gray, 50, 150)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        openings: list[DetectedOpening] = []

        for contour in contours:
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            if len(approx) < 4 or len(approx) > 8:
                continue

            x, y, bw, bh = cv2.boundingRect(contour)
            area = bw * bh

            if area < (h * w * 0.01) or area > (h * w * 0.4):
                continue

            aspect = bw / bh
            depth_score = self._check_depth_edge(depth_map, x, y, bw, bh)

            # Classify: door (tall, near bottom) vs window (wider, upper area)
            bottom_y = y + bh
            near_floor = (bottom_y > h * 0.7)

            if 0.2 < aspect < 0.7 and near_floor:
                # Door candidate
                score = (
                    (1.0 - abs(aspect - 0.44) / 0.44) * 0.4
                    + depth_score * 0.3
                    + (1.0 - abs(bottom_y - h) / h) * 0.3
                )
                if score > 0.3:
                    width_cm = max(int(bw / px_per_cm), 60)
                    height_cm = max(int(bh / px_per_cm), 180)
                    openings.append(
                        DetectedOpening(
                            type="door",
                            bbox=(x, y, bw, bh),
                            width_cm=min(width_cm, 200),
                            height_cm=min(height_cm, 300),
                            confidence=min(score, 1.0),
                        )
                    )

            elif 0.7 <= aspect <= 3.0 and y < h * 0.6:
                # Window candidate
                score = depth_score * 0.5 + min(area / (h * w * 0.05), 1.0) * 0.5
                if score > 0.3:
                    width_cm = max(int(bw / px_per_cm), 40)
                    height_cm = max(int(bh / px_per_cm), 40)
                    openings.append(
                        DetectedOpening(
                            type="window",
                            bbox=(x, y, bw, bh),
                            width_cm=min(width_cm, 300),
                            height_cm=min(height_cm, 250),
                            confidence=min(score, 1.0),
                        )
                    )

        # Deduplicate by IoU
        openings = self._nms(openings)

        logger.info(f"Heuristic detected {len(openings)} openings")
        return openings

    def _check_depth_edge(
        self,
        depth_map: np.ndarray,
        x: int,
        y: int,
        w: int,
        h: int,
    ) -> float:
        """Check depth discontinuity at bounding box boundaries."""
        map_h, map_w = depth_map.shape
        margin = max(5, min(w, h) // 10)

        x1 = max(0, x - margin)
        x2 = min(map_w, x + w + margin)
        y1 = max(0, y - margin)
        y2 = min(map_h, y + h + margin)

        inner = depth_map[y : y + h, x : x + w]
        if inner.size == 0:
            return 0.0
        inner_mean = np.mean(inner)

        border_mask = np.zeros_like(depth_map, dtype=bool)
        border_mask[y1:y2, x1:x2] = True
        border_mask[y : y + h, x : x + w] = False
        border_vals = depth_map[border_mask]

        if border_vals.size == 0:
            return 0.0
        border_mean = np.mean(border_vals)

        depth_range = np.max(depth_map) - np.min(depth_map)
        if depth_range < 1e-6:
            return 0.0

        diff = abs(inner_mean - border_mean) / depth_range
        return min(diff * 3, 1.0)

    @staticmethod
    def _nms(openings: list[DetectedOpening]) -> list[DetectedOpening]:
        """Non-maximum suppression to remove duplicate detections."""
        if len(openings) <= 1:
            return openings

        # Sort by confidence descending
        openings.sort(key=lambda o: o.confidence, reverse=True)

        kept: list[DetectedOpening] = []
        for opening in openings:
            is_duplicate = False
            for k in kept:
                if opening.type == k.type:
                    iou = _compute_iou(opening.bbox, k.bbox)
                    if iou > IOU_THRESHOLD:
                        is_duplicate = True
                        break
            if not is_duplicate:
                kept.append(opening)

        return kept


def _compute_iou(
    bbox1: tuple, bbox2: tuple
) -> float:
    """Compute IoU between two (x, y, w, h) bounding boxes."""
    x1, y1, w1, h1 = bbox1
    x2, y2, w2, h2 = bbox2

    xa = max(x1, x2)
    ya = max(y1, y2)
    xb = min(x1 + w1, x2 + w2)
    yb = min(y1 + h1, y2 + h2)

    inter = max(0, xb - xa) * max(0, yb - ya)
    if inter == 0:
        return 0.0

    area1 = w1 * h1
    area2 = w2 * h2
    union = area1 + area2 - inter

    return inter / union if union > 0 else 0.0
