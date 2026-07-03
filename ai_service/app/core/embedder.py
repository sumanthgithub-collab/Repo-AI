"""
Core: Embedding Module
Runs nomic-embed-code-v1 locally via sentence-transformers.
No API calls, no usage costs — runs on CPU or GPU.

Phase 1 — Week 1 implementation.
"""

from sentence_transformers import SentenceTransformer
from app.config import settings

# Model is loaded once at startup (singleton pattern to avoid repeated loading)
_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    """
    Lazy-loads the embedding model on first call.
    Subsequent calls return the cached instance.
    Downloads model from HuggingFace on first run (~150MB for nomic-embed-code-v1).
    """
    global _model
    if _model is None:
        import torch
        device = settings.EMBEDDING_DEVICE
        if device == "cuda" and not torch.cuda.is_available():
            print("⚠️ CUDA requested but not available. Falling back to CPU for embeddings.")
            device = "cpu"
        # Nomic models highly recommend trust_remote_code=True
        _model = SentenceTransformer(settings.EMBEDDING_MODEL, device=device, trust_remote_code=True)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Encode a list of text strings into embedding vectors.
    """
    if not texts:
        return []
    model = get_embedding_model()
    # For nomic-embed-code, document prefix is recommended
    prefixed_texts = [f"search_document: {t}" for t in texts]
    embeddings = model.encode(prefixed_texts, normalize_embeddings=True)
    return embeddings.tolist()


def embed_query(query: str) -> list[float]:
    """
    Encode a single query string for retrieval.
    Uses "search_query: " prefix (nomic instruction format for retrieval).
    """
    model = get_embedding_model()
    prefixed_query = f"search_query: {query}"
    # encode returns an array, we get the first (and only) item
    return model.encode([prefixed_query], normalize_embeddings=True)[0].tolist()
