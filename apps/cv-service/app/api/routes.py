import logging

from fastapi import APIRouter, Depends, Request

from app.api.auth import require_service_token
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.dimension_calculator import DimensionCalculator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    # `/health` reste ouvert : les healthchecks Docker n'ont pas le secret,
    # et il n'expose que des booleens de chargement de modele.
    dependencies=[Depends(require_service_token)],
)
async def analyze_images(request: Request, body: AnalyzeRequest):
    """
    Analyze room photos to extract dimensions.

    Pipeline:
    1. Load image from shared volume
    2. Run depth estimation
    3. Detect room contours (walls/floor)
    4. Detect reference object (door)
    5. Calibrate scale and compute dimensions
    """
    depth_estimator = request.app.state.depth_estimator
    opening_detector = request.app.state.opening_detector

    calculator = DimensionCalculator(depth_estimator, opening_detector)

    try:
        result = calculator.process(
            image_paths=body.image_paths,
            reference_object=body.reference_object,
        )
        return result
    except Exception as e:
        logger.exception("Analysis pipeline failed")
        return AnalyzeResponse(
            status="error",
            error=str(e),
        )
