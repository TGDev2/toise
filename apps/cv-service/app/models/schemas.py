from pydantic import BaseModel
from typing import Optional


class ReferenceObject(BaseModel):
    type: str = "door"
    height_cm: float = 204.0


class AnalyzeRequest(BaseModel):
    image_paths: list[str]
    reference_object: Optional[ReferenceObject] = None


class Dimensions(BaseModel):
    length_cm: int
    width_cm: int
    height_cm: int


class DetectedOpeningSchema(BaseModel):
    type: str  # "door" | "window"
    width_cm: int
    height_cm: int
    confidence: float  # 0-1
    count: int = 1


class AnalyzeResponse(BaseModel):
    status: str  # "success" | "no_reference" | "error"
    dimensions: Optional[Dimensions] = None
    confidence: str = "medium"  # "high" | "medium" | "low"
    confidence_score: float = 0.0  # numeric 0-1 for observability
    reference_detected: bool = False
    reference_type: Optional[str] = None
    openings: list[DetectedOpeningSchema] = []
    num_images_processed: int = 0
    raw_output: dict = {}
    error: Optional[str] = None
