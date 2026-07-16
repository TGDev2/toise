from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health_check(request: Request):
    depth = getattr(request.app.state, "depth_estimator", None)
    opening = getattr(request.app.state, "opening_detector", None)
    return {
        "status": "ok",
        "service": "cv-service",
        "models": {
            # Modèle de profondeur : requis (le démarrage échoue s'il manque).
            "depth": bool(depth is not None and depth.model is not None),
            # YOLO : optionnel — repli sur l'heuristique OpenCV si absent.
            "yolo": bool(opening is not None and opening.model is not None),
        },
    }
