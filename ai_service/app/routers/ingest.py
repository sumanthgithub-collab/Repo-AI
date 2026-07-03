"""
Router: /api/v1/ingest
Handles cloning a GitHub repo, parsing, chunking, embedding, and storing
vectors in Qdrant.

Phase 1 — Week 1 implementation.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException
import uuid
import asyncio
from app.models.schemas import IngestRequest, IngestResponse
from app.core import repo_cloner, ast_parser, chunker, embedder, vector_store

router = APIRouter()

# Temporary in-memory status store for Phase 1
# In a real setup, we'd update a DB (Supabase via gateway)
INGEST_STATUS = {}


async def run_ingestion_pipeline(repo_id: str, repo_url: str, languages: list[str]):
    """Background task implementing the ingestion pipeline."""
    try:
        # Give Uvicorn a chance to flush the HTTP 200 OK response to the socket
        await asyncio.sleep(1)
        INGEST_STATUS[repo_id] = {
            "status": "cloning", 
            "current_stage": "Cloning repository...",
            "total_chunks": 0,
            "embedded_chunks": 0,
            "progress_pct": 0.0
        }
        
        # 1. Clone — run in thread pool so event loop stays responsive during git clone
        repo_path = await asyncio.to_thread(repo_cloner.clone_repo, repo_url, repo_id)
        
        # 2. Get files — also sync I/O, run in thread pool
        INGEST_STATUS[repo_id].update({"status": "parsing", "current_stage": "Parsing files..."})
        files = await asyncio.to_thread(repo_cloner.get_repo_files, repo_path, languages)
        
        # Ensure collection exists before doing heavy lifting
        await vector_store.ensure_collection_exists()

        all_chunks = []
        
        # 3. Parse & 4. Chunk
        for file in files:
            full_path = repo_path / file
            rel_path = str(file)
            try:
                content = full_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue # Skip binary/non-utf8 files
                
            parsed = ast_parser.parse_file(rel_path, content)
            file_chunks = chunker.chunk_file(repo_id, rel_path, content, parsed)
            all_chunks.extend(file_chunks)
            
        total_chunks = len(all_chunks)
        INGEST_STATUS[repo_id].update({
            "status": "embedding",
            "current_stage": "Embedding and structuring chunks...",
            "total_chunks": total_chunks
        })
        
        # 5. Embed & 6. Upsert
        # We batch embedding and upsert to avoid blocking or OOM
        batch_size = 50
        embedded_count = 0
        for i in range(0, total_chunks, batch_size):
            batch = all_chunks[i:i + batch_size]
            texts = [c.content for c in batch]
            
            # Offload heavy CPU work to a separate thread so event loop remains responsive
            embs = await asyncio.to_thread(embedder.embed_texts, texts)
            
            await vector_store.upsert_chunks(batch, embs)
            
            embedded_count += len(batch)
            pct = round((embedded_count / total_chunks) * 100, 2) if total_chunks > 0 else 100.0
            INGEST_STATUS[repo_id].update({
                "embedded_chunks": embedded_count,
                "progress_pct": pct
            })
            
            # Allow event loop to breathe during heavy sync compute
            await asyncio.sleep(0) 

        # 7. Cleanup
        repo_cloner.cleanup_repo(repo_id)
        INGEST_STATUS[repo_id].update({
            "status": "done",
            "current_stage": "Ingestion completed successfully",
            "progress_pct": 100.0
        })

    except Exception as e:
        print(f"Ingestion failed for {repo_id}: {e}")
        INGEST_STATUS[repo_id].update({"status": "error", "error": str(e), "current_stage": "Failed"})


@router.post("/", response_model=IngestResponse, summary="Start repo ingestion")
async def ingest_repo(request: IngestRequest, background_tasks: BackgroundTasks):
    """Kick off the ingestion pipeline for a GitHub repository."""
    
    # repo_id is provided by the gateway, but if missing, fallback to uuid
    repo_id = request.repo_id or str(uuid.uuid4())
    
    INGEST_STATUS[repo_id] = {
        "status": "pending",
        "current_stage": "Queued",
        "total_chunks": 0,
        "embedded_chunks": 0,
        "progress_pct": 0.0
    }
    
    background_tasks.add_task(
        run_ingestion_pipeline, 
        repo_id, 
        request.repo_url, 
        request.languages
    )
    
    return IngestResponse(
        repo_id=repo_id,
        status="ingesting",
        message="Ingestion pipeline started in the background."
    )


@router.get("/{repo_id}/status", summary="Check ingestion status")
async def get_ingestion_status(repo_id: str):
    """Poll the current ingestion status for a repo."""
    status = INGEST_STATUS.get(repo_id)
    if not status:
        raise HTTPException(status_code=404, detail="Repo ingestion state not found")
    return {"repo_id": repo_id, **status}


@router.delete("/{repo_id}", summary="Delete all vectors for a repo")
async def delete_repo_vectors(repo_id: str, user_id: str):
    """Delete all Qdrant vectors associated with a repo_id."""
    count = await vector_store.delete_repo_vectors(repo_id)
    return {"message": "Vectors deleted", "repo_id": repo_id, "deleted": count}
