import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from app.config import settings
from app.models.schemas import (
    AnalyzeResponse,
    DetectedOpeningSchema,
    Dimensions,
    ReferenceObject,
)
from app.services.contour_detector import ContourDetector
from app.services.depth_estimator import DepthEstimator
from app.services.opening_detector import DetectedOpening, OpeningDetector
from app.services.reference_detector import ReferenceDetector

logger = logging.getLogger(__name__)

IOU_DEDUP_THRESHOLD = 0.4


def _resolve_upload_path(image_path: str) -> Path:
    """
    Resolve an uploaded image path safely inside UPLOADS_PATH.

    Defense in depth on top of AnalyzeRequest.image_paths validation:
    after resolving symlinks and normalizing, the final path must still
    be contained within the configured uploads directory, otherwise
    ValueError is raised.
    """
    uploads_root = Path(settings.uploads_path).resolve()
    candidate = (uploads_root / image_path).resolve()
    try:
        candidate.relative_to(uploads_root)
    except ValueError as exc:
        raise ValueError(
            f"image path escapes uploads directory: {image_path!r}"
        ) from exc
    return candidate


@dataclass
class PerImageResult:
    """Results from processing a single image."""

    image_path: str
    dimensions: Optional[Dimensions] = None
    reference_detected: bool = False
    reference_confidence: float = 0.0
    openings: list[DetectedOpening] = field(default_factory=list)
    wall_lines_count: int = 0
    floor_coverage: float = 0.0
    px_per_cm: float = 0.0
    depth_map: Optional[np.ndarray] = None
    contours: Optional[object] = None


class DimensionCalculator:
    """
    Main pipeline coordinator: loads images, runs depth estimation,
    detects contours and reference objects, calibrates scale,
    and computes room dimensions.
    """

    def __init__(
        self,
        depth_estimator: DepthEstimator,
        opening_detector: Optional[OpeningDetector] = None,
    ):
        self.depth_estimator = depth_estimator
        self.contour_detector = ContourDetector()
        self.reference_detector = ReferenceDetector()
        self.opening_detector = opening_detector

    def process(
        self,
        image_paths: list[str],
        reference_object: Optional[ReferenceObject] = None,
    ) -> AnalyzeResponse:
        """
        Process room photos and extract dimensions.

        Multi-image: processes all images, fuses results via median,
        and merges detected openings with IoU deduplication.
        """
        if not image_paths:
            return AnalyzeResponse(
                status="error", error="No images provided"
            )

        per_image_results: list[PerImageResult] = []

        for path in image_paths:
            result = self._process_single_image(path, reference_object)
            if result is not None:
                per_image_results.append(result)

        if not per_image_results:
            return AnalyzeResponse(
                status="error",
                error="Failed to process any image",
            )

        # Check if any image found a reference
        results_with_ref = [r for r in per_image_results if r.reference_detected]
        results_with_dims = [r for r in per_image_results if r.dimensions]

        if not results_with_ref:
            # No reference found in any image
            raw_output = self._build_multi_image_raw(per_image_results)
            return AnalyzeResponse(
                status="no_reference",
                reference_detected=False,
                confidence="low",
                confidence_score=0.0,
                num_images_processed=len(per_image_results),
                raw_output=raw_output,
            )

        if not results_with_dims:
            raw_output = self._build_multi_image_raw(per_image_results)
            return AnalyzeResponse(
                status="error",
                error="Reference detected but dimensions could not be computed",
                num_images_processed=len(per_image_results),
                raw_output=raw_output,
            )

        # Fuse dimensions via median
        dimensions = self._fuse_dimensions(results_with_dims)

        # Merge openings across images
        all_openings: list[DetectedOpening] = []
        for r in per_image_results:
            all_openings.extend(r.openings)
        merged_openings = self._merge_openings(all_openings)

        # Enhanced confidence scoring
        confidence_score = self._assess_confidence_v2(
            per_image_results=per_image_results,
            results_with_dims=results_with_dims,
            dimensions=dimensions,
        )
        confidence = self._score_to_level(confidence_score)

        # Convert openings to schema
        opening_schemas = [
            DetectedOpeningSchema(
                type=o.type,
                width_cm=o.width_cm,
                height_cm=o.height_cm,
                confidence=o.confidence,
                count=1,
            )
            for o in merged_openings
        ]

        # Group identical openings (same type + similar dimensions)
        opening_schemas = self._group_openings(opening_schemas)

        raw_output = self._build_multi_image_raw(per_image_results)

        return AnalyzeResponse(
            status="success",
            dimensions=dimensions,
            confidence=confidence,
            confidence_score=confidence_score,
            reference_detected=True,
            reference_type="door",
            openings=opening_schemas,
            num_images_processed=len(per_image_results),
            raw_output=raw_output,
        )

    def _process_single_image(
        self,
        image_path: str,
        reference_object: Optional[ReferenceObject],
    ) -> Optional[PerImageResult]:
        """Process a single image through the full pipeline."""
        try:
            full_path = _resolve_upload_path(image_path)
        except ValueError as e:
            logger.warning(f"Rejected unsafe image path {image_path!r}: {e}")
            return None

        logger.info(f"Processing image: {full_path}")

        try:
            pil_image = Image.open(full_path).convert("RGB")
        except Exception as e:
            logger.warning(f"Failed to load image {full_path}: {e}")
            return None

        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        # Step 1: Depth estimation
        depth_map = self.depth_estimator.estimate(pil_image)

        # Step 2: Detect room contours
        contours = self.contour_detector.detect(cv_image, depth_map)

        # Step 3: Detect reference object
        ref_height_cm = None
        ref_height_px = None
        reference_detected = False
        ref_confidence = 0.0

        if reference_object:
            ref_height_cm = reference_object.height_cm
            detected = self.reference_detector.detect_door(cv_image, depth_map)
            if detected:
                ref_height_px = detected.height_px
                reference_detected = True
                ref_confidence = detected.confidence
        else:
            detected = self.reference_detector.detect_door(cv_image, depth_map)
            if detected:
                ref_height_px = detected.height_px
                ref_height_cm = detected.height_cm
                reference_detected = True
                ref_confidence = detected.confidence

        result = PerImageResult(
            image_path=image_path,
            reference_detected=reference_detected,
            reference_confidence=ref_confidence,
            wall_lines_count=len(contours.wall_lines),
            floor_coverage=float(
                np.sum(contours.floor_mask) / contours.floor_mask.size
            ),
            depth_map=depth_map,
            contours=contours,
        )

        if not reference_detected or ref_height_px is None or ref_height_cm is None:
            return result

        # Step 4: Calculate dimensions
        px_per_cm = ref_height_px / ref_height_cm
        result.px_per_cm = px_per_cm
        result.dimensions = self._calculate_dimensions(
            depth_map=depth_map,
            contours=contours,
            ref_height_px=ref_height_px,
            ref_height_cm=ref_height_cm,
        )

        # Step 5: Detect openings
        if self.opening_detector is not None:
            result.openings = self.opening_detector.detect(
                cv_image, depth_map, px_per_cm
            )

        return result

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
            room_width_px = int(w * 0.8)

        # Estimate room length from depth range in floor region
        if np.any(floor_mask > 0):
            floor_depths = depth_map[floor_mask > 0]
            depth_range = np.max(floor_depths) - np.min(floor_depths)
            room_length_px = depth_range * (
                h / (np.max(depth_map) - np.min(depth_map) + 1e-6)
            )
        else:
            room_length_px = int(h * 0.7)

        # Estimate height from vertical extent of wall regions
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

        # Sanity checks
        width_cm = min(width_cm, 2000)
        length_cm = min(length_cm, 2000)
        height_cm = min(height_cm, 500)

        if height_cm < 200 or height_cm > 400:
            height_cm = 250

        logger.info(
            f"Calculated dimensions: {length_cm}cm x {width_cm}cm x {height_cm}cm"
        )

        return Dimensions(
            length_cm=length_cm,
            width_cm=width_cm,
            height_cm=height_cm,
        )

    def _fuse_dimensions(
        self, results: list[PerImageResult]
    ) -> Dimensions:
        """Fuse dimensions from multiple images using median."""
        lengths = [r.dimensions.length_cm for r in results]
        widths = [r.dimensions.width_cm for r in results]
        heights = [r.dimensions.height_cm for r in results]

        return Dimensions(
            length_cm=int(np.median(lengths)),
            width_cm=int(np.median(widths)),
            height_cm=int(np.median(heights)),
        )

    def _merge_openings(
        self, openings: list[DetectedOpening]
    ) -> list[DetectedOpening]:
        """Merge openings from multiple images using IoU deduplication."""
        if len(openings) <= 1:
            return openings

        # Sort by confidence descending
        openings.sort(key=lambda o: o.confidence, reverse=True)

        merged: list[DetectedOpening] = []
        for opening in openings:
            is_duplicate = False
            for m in merged:
                if opening.type == m.type:
                    # Compare dimensions instead of bbox (different images have
                    # different coordinate spaces)
                    w_ratio = min(opening.width_cm, m.width_cm) / max(
                        opening.width_cm, m.width_cm, 1
                    )
                    h_ratio = min(opening.height_cm, m.height_cm) / max(
                        opening.height_cm, m.height_cm, 1
                    )
                    if w_ratio > 0.7 and h_ratio > 0.7:
                        is_duplicate = True
                        break
            if not is_duplicate:
                merged.append(opening)

        return merged

    @staticmethod
    def _group_openings(
        openings: list[DetectedOpeningSchema],
    ) -> list[DetectedOpeningSchema]:
        """Group identical openings (same type, similar dimensions) by count."""
        if not openings:
            return openings

        groups: list[DetectedOpeningSchema] = []
        for o in openings:
            matched = False
            for g in groups:
                if (
                    g.type == o.type
                    and abs(g.width_cm - o.width_cm) <= 10
                    and abs(g.height_cm - o.height_cm) <= 10
                ):
                    g.count += o.count
                    g.confidence = max(g.confidence, o.confidence)
                    matched = True
                    break
            if not matched:
                groups.append(
                    DetectedOpeningSchema(
                        type=o.type,
                        width_cm=o.width_cm,
                        height_cm=o.height_cm,
                        confidence=o.confidence,
                        count=o.count,
                    )
                )
        return groups

    def _assess_confidence_v2(
        self,
        per_image_results: list[PerImageResult],
        results_with_dims: list[PerImageResult],
        dimensions: Dimensions,
    ) -> float:
        """
        Enhanced confidence scoring for iteration 2.

        Weights:
        - Multi-image coherence: 30%
        - Reference object quality: 30%
        - Dimension plausibility: 20%
        - Detection coverage: 20%
        """
        score = 0.0

        # 1. Multi-image coherence (30%)
        if len(results_with_dims) >= 2:
            lengths = [r.dimensions.length_cm for r in results_with_dims]
            widths = [r.dimensions.width_cm for r in results_with_dims]
            heights = [r.dimensions.height_cm for r in results_with_dims]

            cvs = []  # coefficient of variation for each dimension
            for values in [lengths, widths, heights]:
                mean = np.mean(values)
                if mean > 0:
                    cvs.append(np.std(values) / mean)
                else:
                    cvs.append(1.0)

            avg_cv = np.mean(cvs)
            if avg_cv < 0.05:
                score += 0.30
            elif avg_cv < 0.15:
                score += 0.15 + 0.15 * (0.15 - avg_cv) / 0.10
            else:
                score += 0.05
        elif len(results_with_dims) == 1:
            # Single image: partial credit
            score += 0.15

        # 2. Reference object quality (30%)
        ref_results = [r for r in per_image_results if r.reference_detected]
        if ref_results:
            avg_ref_conf = np.mean([r.reference_confidence for r in ref_results])
            score += 0.30 * avg_ref_conf

        # 3. Dimension plausibility (20%)
        d = dimensions
        max_ratio = max(d.length_cm, d.width_cm) / max(
            min(d.length_cm, d.width_cm), 1
        )
        if max_ratio <= 3.0 and 200 <= d.height_cm <= 350:
            score += 0.20
        elif max_ratio <= 5.0 and 200 <= d.height_cm <= 400:
            score += 0.10
        else:
            score += 0.02

        # 4. Detection coverage (20%)
        avg_wall_lines = np.mean(
            [r.wall_lines_count for r in per_image_results]
        )
        avg_floor_cov = np.mean(
            [r.floor_coverage for r in per_image_results]
        )
        coverage_score = 0.0
        if avg_wall_lines >= 6:
            coverage_score += 0.5
        elif avg_wall_lines >= 3:
            coverage_score += 0.3
        elif avg_wall_lines >= 1:
            coverage_score += 0.15
        if avg_floor_cov > 0.1:
            coverage_score += 0.5
        elif avg_floor_cov > 0.05:
            coverage_score += 0.25
        score += 0.20 * coverage_score

        return min(score, 1.0)

    @staticmethod
    def _score_to_level(score: float) -> str:
        """Map numeric confidence to level string."""
        if score >= 0.95:
            return "high"
        elif score >= 0.85:
            return "medium"
        else:
            return "low"

    def _build_multi_image_raw(
        self, results: list[PerImageResult]
    ) -> dict:
        """Build raw output dict with per-image breakdown."""
        per_image = []
        for r in results:
            entry: dict = {
                "image_path": r.image_path,
                "reference_detected": r.reference_detected,
                "reference_confidence": r.reference_confidence,
                "wall_lines_count": r.wall_lines_count,
                "floor_coverage": r.floor_coverage,
                "openings_count": len(r.openings),
            }
            if r.dimensions:
                entry["dimensions"] = {
                    "length_cm": r.dimensions.length_cm,
                    "width_cm": r.dimensions.width_cm,
                    "height_cm": r.dimensions.height_cm,
                }
            if r.depth_map is not None:
                entry["depth_map_stats"] = {
                    "min": float(np.min(r.depth_map)),
                    "max": float(np.max(r.depth_map)),
                    "mean": float(np.mean(r.depth_map)),
                    "std": float(np.std(r.depth_map)),
                }
            per_image.append(entry)

        return {
            "num_images_processed": len(results),
            "per_image": per_image,
        }
