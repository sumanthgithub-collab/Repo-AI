# =============================================================
# RepoTalk AI Service — Dockerfile
# Multi-stage build: keeps image lean for deployment on Render.
# =============================================================

# ---- Stage 1: Build ----
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch FIRST (before requirements.txt).
# This prevents pip from pulling the 900MB+ CUDA build.
# Machine: Intel i5-12500H + Intel Iris Xe — no NVIDIA GPU.
RUN pip install --no-cache-dir --user \
    torch==2.6.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Copy and install Python dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir --user -r requirements.txt

# ---- Stage 2: Runtime ----
FROM python:3.11-slim AS runtime

# Security: run as non-root user
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install runtime system deps (git for repo cloning)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Create directories needed at runtime
RUN mkdir -p /app/tmp/cloned_repos /app/.model_cache /app/logs \
    && chown -R appuser:appuser /app

USER appuser

# Environment
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Startup
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
