import logging

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

from app.config import settings

logger = logging.getLogger(__name__)


class DepthEstimator:
    """Wrapper around Depth Anything V2 Small for monocular depth estimation."""

    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"

    def load_model(self):
        """Load the depth estimation model. Called once at startup."""
        model_id = f"depth-anything/{settings.model_name}-hf"
        logger.info(f"Loading depth model: {model_id}")

        self.processor = AutoImageProcessor.from_pretrained(model_id)
        self.model = AutoModelForDepthEstimation.from_pretrained(model_id)
        self.model.to(self.device)
        self.model.eval()

        logger.info("Depth model loaded successfully")

    def estimate(self, image: Image.Image) -> np.ndarray:
        """
        Run depth estimation on a single image.

        Args:
            image: PIL Image (RGB)

        Returns:
            Depth map as numpy array (H x W), values represent relative depth
            (higher = farther from camera).
        """
        if self.model is None or self.processor is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)

        predicted_depth = outputs.predicted_depth

        # Interpolate to original image size
        prediction = torch.nn.functional.interpolate(
            predicted_depth.unsqueeze(1),
            size=image.size[::-1],  # (H, W)
            mode="bicubic",
            align_corners=False,
        )

        depth_map = prediction.squeeze().cpu().numpy()

        return depth_map
