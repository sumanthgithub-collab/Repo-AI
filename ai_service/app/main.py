"""
RepoTalk AI Service — FastAPI Application Entry Point

Routers mounted here:
  /health          → health check
  /api/v1/ingest   → repo ingestion pipeline
  /api/v1/query    → retrieval + generation
  /api/v1/symbols  → AST symbol lookup
  /api/v1/persona  → repo profiling + onboarding guide
  /api/v1/pr       → PR summarizer
  /api/v1/eval     → RAGAS evaluation
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ingest, query, symbols, persona, pr, eval as eval_router
from app.core.vector_store import ensure_collection_exists
from app.core.llm_provider import get_provider_info


# ---------------------------------------------------------------------------
# Lifespan — runs on startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure Qdrant collection is ready
    try:
        await ensure_collection_exists()
        print("[OK] Qdrant collection ready")
    except Exception as e:
        print(f"[WARNING] Qdrant connection failed (will retry on first request): {e}")

    print(f"[OK] LLM provider: {settings.LLM_PROVIDER} -> {get_provider_info()['model']}")
    yield
    # Shutdown: nothing to clean up (yet)


# ---------------------------------------------------------------------------
# App Instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RAG pipeline powering RepoTalk — chat with any GitHub repo.",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS (Node gateway is the only caller in prod; allow all in dev)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(ingest.router,  prefix="/api/v1/ingest",  tags=["Ingestion"])
app.include_router(query.router,   prefix="/api/v1/query",   tags=["Query"])
app.include_router(symbols.router, prefix="/api/v1/symbols", tags=["Symbols"])
app.include_router(persona.router, prefix="/api/v1/persona", tags=["Persona"])
app.include_router(pr.router,      prefix="/api/v1/pr",      tags=["PR Summarizer"])
app.include_router(eval_router.router, prefix="/api/v1/eval", tags=["Evaluation"])

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "llm": get_provider_info(),
    }
