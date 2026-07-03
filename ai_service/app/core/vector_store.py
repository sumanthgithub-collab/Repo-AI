"""
Core: Qdrant Vector Store Client
Manages all interactions with Qdrant: collection setup, upsert, hybrid search.

Phase 1 — Week 1 & 2 implementation.
"""

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as rest
from app.config import settings
from app.core.chunker import Chunk

# ---------------------------------------------------------------------------
# Collection Config
# ---------------------------------------------------------------------------
COLLECTION_NAME = settings.QDRANT_COLLECTION
VECTOR_SIZE = settings.EMBEDDING_DIMENSION  # matches the embedding model in .env
DISTANCE = rest.Distance.COSINE

# ---------------------------------------------------------------------------
# Client (singleton) — uses local embedded Qdrant (no server required)
# ---------------------------------------------------------------------------
_client: AsyncQdrantClient | None = None


async def get_qdrant_client() -> AsyncQdrantClient:
    """Lazy-initialize the Qdrant async client (singleton).
    
    Uses local embedded mode (path=QDRANT_LOCAL_PATH) when QDRANT_URL is
    a localhost address — no server process needed.
    For cloud/remote Qdrant, set QDRANT_URL to a non-localhost URL.
    """
    global _client
    if _client is None:
        if settings.QDRANT_URL.startswith("http://localhost") or settings.QDRANT_URL.startswith("http://127.0.0.1"):
            # Embedded local mode — stores data in .qdrant_local directory
            _client = AsyncQdrantClient(path=settings.QDRANT_LOCAL_PATH)
        else:
            _client = AsyncQdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
            )
    return _client


async def ensure_collection_exists() -> None:
    """
    Create the Qdrant collection if it doesn't exist.
    Called once at application startup.
    """
    client = await get_qdrant_client()
    collections = await client.get_collections()
    
    if not any(c.name == COLLECTION_NAME for c in collections.collections):
        await client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=rest.VectorParams(
                size=VECTOR_SIZE,
                distance=DISTANCE
            )
        )
        # Create payload indexes for filtering
        await client.create_payload_index(COLLECTION_NAME, field_name="repo_id", field_schema=rest.PayloadSchemaType.KEYWORD)


async def upsert_chunks(chunks: list[Chunk], embeddings: list[list[float]]) -> int:
    """
    Upsert a batch of chunks with their embeddings into Qdrant.
    """
    if not chunks:
        return 0
        
    client = await get_qdrant_client()
    points = [
        rest.PointStruct(
            id=c.chunk_id,
            vector=emb,
            payload={
                "repo_id": c.repo_id,
                "file_path": c.file_path,
                "language": c.language,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "function_names": c.function_names,
                "class_names": c.class_names,
                "imports": c.imports,
                "content": c.content,
            }
        )
        for c, emb in zip(chunks, embeddings)
    ]
    
    # Batch upsert
    batch_size = 100
    for i in range(0, len(points), batch_size):
        await client.upsert(
            collection_name=COLLECTION_NAME,
            points=points[i:i + batch_size]
        )
        
    return len(points)


async def hybrid_search(
    repo_id: str,
    query_vector: list[float],
    query_text: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Hybrid search combining dense vector similarity + sparse BM25 keyword matching.
    """
    # Note: Phase 1 Week 2 — Full hybrid requires sparse vectors setup.
    # We will start with a basic dense search for now.
    client = await get_qdrant_client()
    results = await client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=rest.Filter(
            must=[
                rest.FieldCondition(
                    key="repo_id",
                    match=rest.MatchValue(value=repo_id)
                )
            ]
        ),
        limit=top_k,
        with_payload=True,
    )
    
    return [
        {
            "chunk_id": r.id,
            "file_path": r.payload["file_path"],
            "start_line": r.payload["start_line"],
            "end_line": r.payload["end_line"],
            "content": r.payload["content"],
            "score": r.score,
            "function_names": r.payload.get("function_names", []),
            "class_names": r.payload.get("class_names", [])
        }
        for r in results
    ]


async def delete_repo_vectors(repo_id: str) -> int:
    """Delete all vectors associated with a repo_id."""
    client = await get_qdrant_client()
    try:
        response = await client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=rest.FilterSelector(
                filter=rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="repo_id", match=rest.MatchValue(value=repo_id)
                        )
                    ]
                )
            ),
        )
        return getattr(response, "points_deleted", True) # Approximate indication
    except Exception as e:
        print(f"Error deleting vectors for {repo_id}: {e}")
        return 0


async def list_repo_chunks(repo_id: str, batch_size: int = 256) -> list[dict]:
    """
    Return all stored chunk payloads for a repo.
    Used by symbol navigation and repo metadata features.
    """
    client = await get_qdrant_client()
    offset = None
    chunks: list[dict] = []

    while True:
        records, offset = await client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=rest.Filter(
                must=[
                    rest.FieldCondition(
                        key="repo_id",
                        match=rest.MatchValue(value=repo_id),
                    )
                ]
            ),
            limit=batch_size,
            with_payload=True,
            with_vectors=False,
            offset=offset,
        )

        for record in records:
            if record.payload:
                chunks.append(dict(record.payload))

        if offset is None:
            break

    return chunks
