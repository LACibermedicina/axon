# axon · API científica (FastAPI + NumPy/SciPy). Usuário sem privilégios, porta interna 8000.
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY backend/requirements.txt .
RUN pip install -r requirements.txt && useradd -u 10001 -m axon
COPY backend/ /srv/
COPY VERSION /srv/VERSION
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=20s --retries=5 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health')"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${API_WORKERS:-2} --proxy-headers"]
