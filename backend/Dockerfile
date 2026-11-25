FROM python:3.11-slim

# No .pyc files, unbuffered logs. PORT is overridden by Render at runtime.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Tesseract OCR for image uploads, curl for the container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Build context is backend/ (paths below are relative to it)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Includes app/, migrations/, alembic.ini, scripts/ (see .dockerignore)
COPY . /app/

RUN mkdir -p /app/temp_uploads && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Shell form so ${PORT} expands. Migrations run on every start (Render free plan
# has no preDeployCommand). The demo and pack seed runs inside the app lifespan.
# --forwarded-allow-ips "*" is safe only because the container is reachable
# solely through Render's proxy.
CMD python -m alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips "*"
