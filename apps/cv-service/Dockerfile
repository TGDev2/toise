# Stage 1: Download model weights
FROM python:3.12-slim AS model-downloader

RUN pip install --no-cache-dir transformers torch --index-url https://download.pytorch.org/whl/cpu

RUN python -c "\
from transformers import AutoImageProcessor, AutoModelForDepthEstimation; \
AutoImageProcessor.from_pretrained('depth-anything/depth-anything-v2-small-hf'); \
AutoModelForDepthEstimation.from_pretrained('depth-anything/depth-anything-v2-small-hf')"

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for OpenCV
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy cached model weights from stage 1
COPY --from=model-downloader /root/.cache/huggingface /root/.cache/huggingface

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
