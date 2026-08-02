import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.auth import require_service_token
from app.config import settings
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.dimension_calculator import DimensionCalculator

logger = logging.getLogger(__name__)

router = APIRouter()

# Slots d'analyse du processus. Construit à la première requête, donc dans la
# boucle qui l'utilisera, et non à l'import : `app.main` n'est pas le seul
# point d'entrée (les tests montent le routeur seul) et un sémaphore créé hors
# boucle est une source d'erreurs silencieuses.
_analysis_slots: Optional[asyncio.Semaphore] = None


def analysis_slots() -> asyncio.Semaphore:
    global _analysis_slots
    if _analysis_slots is None:
        _analysis_slots = asyncio.Semaphore(settings.max_concurrent_analyses)
    return _analysis_slots


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

    Le pipeline est synchrone et lié au CPU (Torch, OpenCV, Pillow). L'exécuter
    dans la coroutine, comme avant, gelait la boucle d'événements du seul
    processus du conteneur pour toute sa durée : `/health` ne répondait plus, et
    le healthcheck Docker (30 s × 5) finissait par déclarer malsain un service
    qui travaillait normalement. Il tourne donc dans un thread — Torch et OpenCV
    relâchent le GIL sur l'essentiel de leur travail.

    L'admission est bornée en amont : nombre d'images et surface décodée
    (`AnalyzeRequest`, `image_loader.load_rgb`), et un nombre fixe d'analyses
    simultanées ci-dessous. Refuser tout de suite plutôt que mettre en file :
    une file invisible ne fait que déplacer la saturation vers des timeouts
    côté appelant, pendant que le travail continue sans destinataire.
    """
    slots = analysis_slots()
    if slots.locked():
        logger.warning("Analyse refusée : toutes les analyses simultanées sont occupées")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Analyse déjà en cours sur ce service ; réessayez dans un instant."
            ),
            headers={"Retry-After": "30"},
        )

    depth_estimator = request.app.state.depth_estimator
    opening_detector = request.app.state.opening_detector

    calculator = DimensionCalculator(depth_estimator, opening_detector)

    # `locked()` puis `acquire()` sans point d'attente intermédiaire : dans une
    # boucle mono-thread, aucune autre coroutine ne peut s'intercaler ici.
    async with slots:
        try:
            return await asyncio.to_thread(
                calculator.process,
                image_paths=body.image_paths,
                reference_object=body.reference_object,
            )
        except Exception as e:
            logger.exception("Analysis pipeline failed")
            return AnalyzeResponse(
                status="error",
                error=str(e),
                # Une panne survenue en repli heuristique et une panne survenue
                # sous le modele n'ont pas la meme portee : la premiere se
                # repare en deployant les poids.
                opening_detector=calculator.opening_detector_mode(),
            )
