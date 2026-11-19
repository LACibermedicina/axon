FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg fluidsynth fluid-soundfont-gm libsndfile1 libcairo2 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 10001 worker
WORKDIR /app
COPY requirements-core.txt requirements-ml.txt ./
RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r requirements-core.txt -r requirements-ml.txt
COPY . .
RUN pip install --no-deps .
USER worker
CMD ["python", "-m", "harmonia_ai.worker"]
