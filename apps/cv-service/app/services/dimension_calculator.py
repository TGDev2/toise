import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from app.config import settings
from app.models.schemas import (
    AnalyzeResponse,
    Dimensions,
    ReferenceObject,
)
from app.services.contour_detector import ContourDetector
from app.services.depth_estimator import DepthEstimator
from app.services.reference_detector import ReferenceDetector

logger = logging.getLogger(__name__)


class DimensionCalculator:
    """
    Main pipeline coordinator: loads images, runs depth estimation,
    detects contours and reference objects, calibrates scale,
    and computes room dimensions.
    """

    def __init__(self, depth_estimator: DepthEstimator):
        self.depth_estimator = depth_estimator
        self.contour_detector = ContourDetector()
        self.reference_detector = ReferenceDetector()

    def process(
        self,
        image_paths: list[str],
        reference_object: Optional[ReferenceObject] = None,
    ) -> AnalyzeResponse:
        """
        Process room photos and extract dimensions.

        For iteration 1, we process only the first image.
        Multi-image fusion is planned for iteration 2.
        """
        if not image_paths:
            return AnalyzeResponse(
                status="error", error="No images provided"
            )

        # Load the first image
        image_path = f"{settings.uploads_path}/{image_paths[0]}"
        logger.info(f"Processing image: {image_path}")

        try:
            pil_image = Image.open(image_path).convert("RGB")
        except Exception as e:
            return AnalyzeResponse(
                status="error", error=f"Failed to load image: {e}"
            )

        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        # Step 1: Depth estimation
        logger.info("Running depth estimation...")
        depth_map = self.depth_estimator.estimate(pil_image)

        # Step 2: Detect room contours
        logger.info("Detecting room contours...")
        contours = self.contour_detector.detect(cv_image, depth_map)

        # Step 3: Detect reference object
        ref_height_cm = None
        ref_height_px = None
        reference_detected = False
        reference_type = None

        if reference_object:
            # User provided reference object info
            ref_height_cm = reference_object.height_cm
            ref_type_str = reference_object.type
            # Still try to detect the door to get pixel height
            detected = self.reference_detector.detect_door(cv_image, depth_map)
            if detected:
                ref_height_px = detected.height_px
                reference_detected = True
                reference_type = ref_type_str
            else:
                # Can't find the reference in the image
                return AnalyzeResponse(
                    status="error",
                    error="Reference object specified but not detected in image",
                    raw_output=self._build_raw_output(depth_map, contours),
                )
        else:
            # Try automatic door detection
            logger.info("Attempting automatic door detection...")
            detected = self.reference_detector.detect_door(cv_image, depth_map)
            if detected:
                ref_height_px = detected.height_px
                ref_height_cm = detected.height_cm
                reference_detected = True
                reference_type = "door"
            else:
                # No reference found - return uncalibrated result
                logger.info("No reference object detected")
                return AnalyzeResponse(
                    status="no_reference",
                    reference_detected=False,
                    confidence="low",
                    raw_output=self._build_raw_output(depth_map, contours),
                )

        # Step 4: Calculate dimensions with scale calibration
        logger.info(
            f"Calibrating with reference: {ref_height_cm}cm = {ref_height_px}px"
        )
        dimensions = self._calculate_dimensions(
            depth_map=depth_map,
            contours=contours,
            ref_height_px=ref_height_px,
            ref_height_cm=ref_height_cm,
        )

        # Determine confidence based on detection quality
        confidence = self._assess_confidence(
            contours=contours,
            ref_detected=reference_detected,
            dimensions=dimensions,
        )

        return AnalyzeResponse(
            status="success",
            dimensions=dimensions,
            confidence=confidence,
            reference_detected=reference_detected,
            reference_type=reference_type,
            raw_output=self._build_raw_output(depth_map, contours),
        )

    def _calculate_dimensions(
        self,
        depth_map: np.ndarray,
        contours,
        ref_height_px: int,
        ref_height_cm: float,
    ) -> Dimensions:
        """
        Calculate room dimensions using depth map, detected contours,
        and reference scale.

        Uses the pixel-to-cm ratio from the reference object to convert
        depth map measurements to real-world units.
        """
        h, w = depth_map.shape
        px_per_cm = ref_height_px / ref_height_cm

        # Estimate room width from horizontal extent of floor region
        floor_mask = contours.floor_mask
        floor_rows = np.any(floor_mask > 0, axis=0)
        if np.any(floor_rows):
            floor_cols = np.where(floor_rows)[0]
            room_width_px = floor_cols[-1] - floor_cols[0]
        else:
            # Fallback: use image width as rough estimate
            room_width_px = int(w * 0.8)

        # Estimate room length from depth range in floor region
        if np.any(floor_mask > 0):
            floor_depths = depth_map[floor_mask > 0]
            depth_range = np.max(floor_depths) - np.min(floor_depths)
            # Map depth range to length (using scale factor)
            room_length_px = depth_range * (h / (np.max(depth_map) - np.min(depth_map) + 1e-6))
        else:
            room_length_px = int(h * 0.7)

        # Estimate height from vertical extent of wall regions
        # Walls are regions above the floor with relatively uniform depth
        wall_top = 0
        wall_bottom = h
        if contours.wall_lines:
            horizontal_lines = [
                (x1, y1, x2, y2)
                for x1, y1, x2, y2 in contours.wall_lines
                if abs(y2 - y1) < abs(x2 - x1)
            ]
            if horizontal_lines:
                y_values = [y1 for _, y1, _, _ in horizontal_lines] + [
                    y2 for _, _, _, y2 in horizontal_lines
                ]
                wall_top = min(y_values)
                wall_bottom = max(y_values)

        room_height_px = max(wall_bottom - wall_top, int(h * 0.6))

        # Convert to cm
        width_cm = max(int(room_width_px / px_per_cm), 100)
        length_cm = max(int(room_length_px / px_per_cm), 100)
        height_cm = max(int(room_height_px / px_per_cm), 200)

        # Sanity checks: clamp to reasonable room dimensions
        width_cm = min(width_cm, 2000)  # Max 20m
        length_cm = min(length_cm, 2000)
        height_cm = min(height_cm, 500)  # Max 5m

        # Default ceiling height if unreasonable
        if height_cm < 200 or height_cm > 400:
            height_cm = 250  # Standard 2.5m

        logger.info(
            f"Calculated dimensions: {length_cm}cm x {width_cm}cm x {height_cm}cm"
        )

        return Dimensions(
            length_cm=length_cm,
            width_cm=width_cm,
            height_cm=height_cm,
        )

    def _assess_confidence(
        self,
        contours,
        ref_detected: bool,
        dimensions: Dimensions,
    ) -> str:
        """Assess confidence level of the dimension estimate."""
        score = 0.0

        # Reference detection quality
        if ref_detected:
            score += 0.4

        # Number of wall lines detected
        n_lines = len(contours.wall_lines)
        if n_lines >= 6:
            score += 0.3
        elif n_lines >= 3:
            score += 0.2
        elif n_lines >= 1:
            score += 0.1

        # Floor detection quality
        floor_coverage = np.sum(contours.floor_mask) / contours.floor_mask.size
        if floor_coverage > 0.1:
            score += 0.3
        elif floor_coverage > 0.05:
            score += 0.15

        if score >= 0.7:
            return "high"
        elif score >= 0.4:
            return "medium"
        else:
            return "low"

    def _build_raw_output(self, depth_map: np.ndarray, contours) -> dict:
        """Build raw output dict for debugging/analysis."""
        return {
            "depth_map_stats": {
                "min": float(np.min(depth_map)),
                "max": float(np.max(depth_map)),
                "mean": float(np.mean(depth_map)),
                "std": float(np.std(depth_map)),
            },
            "contours": {
                "num_wall_lines": len(contours.wall_lines),
                "floor_coverage": float(
                    np.sum(contours.floor_mask) / contours.floor_mask.size
                ),
                "num_vanishing_points": len(contours.vanishing_points),
            },
            "image_size": {
                "height": contours.image_height,
                "width": contours.image_width,
            },
        }
