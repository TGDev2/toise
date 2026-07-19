# Stage 1: Download model weights
FROM python:3.12-slim AS model-downloader

# torch depuis l'index CPU PyTorch, transformers depuis PyPI (l'index PyTorch
# n'héberge pas transformers — un --index-url unique casse le build). Versions
# alignées sur requirements.txt : le cache HF pré-rempli ici doit être produit
# par la même version de transformers que celle qui le lira au runtime.
RUN pip install --no-cache-dir torch==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir transformers==4.47.1 Pillow==11.1.0

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
# torch/torchvision épinglés depuis l'index CPU AVANT requirements.txt : sans
# pin, « latest CPU » dérive et entre en conflit avec le torch==2.5.1+cpu de
# requirements.txt (inexistant sur PyPI) ; torchvision est requis par
# ultralytics et doit matcher la version de torch.
RUN pip install --no-cache-dir \
    torch==2.5.1+cpu torchvision==0.20.1+cpu --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy cached model weights from stage 1
COPY --from=model-downloader /root/.cache/huggingface /root/.cache/huggingface

COPY app/ ./app/

# Poids YOLO portes/fenêtres : artefact GitHub Release (cv-model-vN), récupéré
# par scripts/fetch-model.sh AVANT le build. Le dossier existe toujours (README
# committé) ; sans poids, le service bascule sur l'heuristique (/health → yolo:false).
COPY models/ ./models/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
