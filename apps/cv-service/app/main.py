from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.api.routes import router as analyze_router
from app.api.health import router as health_router
from app.services.depth_estimator import DepthEstimator
from app.services.opening_detector import OpeningDetector

depth_estimator: DepthEstimator | None = None
opening_detector: OpeningDetector | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup, cleanup on shutdown."""
    global depth_estimator, opening_detector
    depth_estimator = DepthEstimator()
    depth_estimator.load_model()
    app.state.depth_estimator = depth_estimator

    opening_detector = OpeningDetector()
    opening_detector.load_model()
    app.state.opening_detector = opening_detector
    yield
    del depth_estimator
    del opening_detector


app = FastAPI(
    title="EstiMate CV Service",
    description="Computer vision pipeline for room dimension analysis",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(analyze_router)
