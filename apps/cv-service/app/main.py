from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.api.routes import router as analyze_router
from app.api.health import router as health_router
from app.services.depth_estimator import DepthEstimator

depth_estimator: DepthEstimator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown."""
    global depth_estimator
    depth_estimator = DepthEstimator()
    depth_estimator.load_model()
    app.state.depth_estimator = depth_estimator
    yield
    del depth_estimator


app = FastAPI(
    title="EstiMate CV Service",
    description="Computer vision pipeline for room dimension analysis",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(analyze_router)
