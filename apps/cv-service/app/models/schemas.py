from pathlib import PurePosixPath, PureWindowsPath
from typing import Optional

from pydantic import BaseModel, field_validator


class ReferenceObject(BaseModel):
    type: str = "door"
    height_cm: float = 204.0


def _validate_relative_upload_path(value: str) -> str:
    """
    Reject any path that could escape the uploads directory.

    Only forward-slash relative paths are accepted. This is a first line
    of defense; dimension_calculator additionally resolves and checks the
    final path is contained in UPLOADS_PATH.
    """
    if not isinstance(value, str) or not value:
        raise ValueError("image path must be a non-empty string")
    if "\x00" in value:
        raise ValueError("image path contains a null byte")
    if "\\" in value:
        raise ValueError("image path must not contain backslashes")
    if PurePosixPath(value).is_absolute() or PureWindowsPath(value).is_absolute():
        raise ValueError("image path must be relative")
    parts = PurePosixPath(value).parts
    if any(part == ".." for part in parts):
        raise ValueError("image path must not contain '..' segments")
    return value


class AnalyzeRequest(BaseModel):
    image_paths: list[str]
    reference_object: Optional[ReferenceObject] = None

    @field_validator("image_paths")
    @classmethod
    def _check_image_paths(cls, paths: list[str]) -> list[str]:
        if not paths:
            raise ValueError("image_paths must not be empty")
        return [_validate_relative_upload_path(p) for p in paths]


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
