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


class AnalyzeResponse(BaseModel):
    status: str  # "success" | "no_reference" | "error"
    dimensions: Optional[Dimensions] = None
    confidence: str = "medium"  # "high" | "medium" | "low"
    reference_detected: bool = False
    reference_type: Optional[str] = None
    raw_output: dict = {}
    error: Optional[str] = None
