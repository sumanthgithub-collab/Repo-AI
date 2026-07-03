"""
Router: /api/v1/query
Retrieves relevant chunks from Qdrant and generates a grounded answer
via the configured LLM (Groq or Ollama).

Phase 1 — Week 2 implementation.
"""

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import QueryRequest, QueryResponse, Citation
from app.core.embedder import embed_query
from app.core.vector_store import hybrid_search
from app.core.prompt_builder import build_query_prompt, extract_citations
from app.core.llm_provider import get_llm_client, get_model_name

router = APIRouter()


@router.post("/", response_model=QueryResponse, summary="Ask a question about a repo")
async def query_repo(request: QueryRequest):
    """
    Full RAG pipeline (non-streaming):
      1. Embed the question
      2. Retrieve top-k chunks from Qdrant
      3. Build grounding prompt
      4. Call LLM (Groq / Ollama)
      5. Extract citations
      6. Return structured response
    """
    try:
        # 1. Embed the question
        query_vector = embed_query(request.question)

        # 2. Retrieve from Qdrant
        retrieved_chunks = await hybrid_search(
            repo_id=request.repo_id,
            query_vector=query_vector,
            query_text=request.question,
            top_k=request.top_k,
        )

        if not retrieved_chunks:
            return QueryResponse(
                answer="I couldn't find any relevant code in this repository for your question. "
                       "The repository may not have been ingested yet, or the question doesn't match any indexed code.",
                citations=[],
                session_id=request.session_id,
                model_used=get_model_name(),
            )

        # 3. Build prompt
        messages = build_query_prompt(
            question=request.question,
            retrieved_chunks=retrieved_chunks,
            conversation_history=request.history,
        )

        # 4. Call LLM (non-streaming)
        client = get_llm_client()
        response = await client.chat.completions.create(
            model=get_model_name(),
            messages=messages,
            temperature=0.1,       # Low temp for factual, grounded answers
            max_tokens=2048,
        )

        answer = response.choices[0].message.content or ""

        # 5. Extract citations
        raw_citations = extract_citations(answer, retrieved_chunks)
        citations = [
            Citation(
                file=c["file"],
                start_line=c["start_line"],
                end_line=c["end_line"],
                snippet=c["snippet"],
                score=c["score"],
            )
            for c in raw_citations
        ]

        return QueryResponse(
            answer=answer,
            citations=citations,
            session_id=request.session_id,
            model_used=get_model_name(),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query pipeline error: {str(e)}")


@router.post("/stream", summary="Ask with streaming SSE response")
async def query_repo_stream(request: QueryRequest):
    """
    Same RAG pipeline but streams the LLM response token-by-token as SSE.
    The Node gateway forwards this stream directly to the frontend.

    SSE format:
      data: {"token": "The"}\n\n
      data: {"token": " authenticate"}\n\n
      data: {"done": true, "citations": [...]}\n\n
    """

    async def event_generator():
        try:
            # 1. Embed
            query_vector = embed_query(request.question)

            # 2. Retrieve
            retrieved_chunks = await hybrid_search(
                repo_id=request.repo_id,
                query_vector=query_vector,
                query_text=request.question,
                top_k=request.top_k,
            )

            if not retrieved_chunks:
                no_result_msg = "I couldn't find any relevant code in this repository for your question."
                yield f"data: {json.dumps({'token': no_result_msg})}\n\n"
                yield f"data: {json.dumps({'done': True, 'citations': [], 'session_id': request.session_id})}\n\n"
                return

            # 3. Build prompt
            messages = build_query_prompt(
                question=request.question,
                retrieved_chunks=retrieved_chunks,
                conversation_history=request.history,
            )

            # 4. Stream from LLM
            client = get_llm_client()
            stream = await client.chat.completions.create(
                model=get_model_name(),
                messages=messages,
                temperature=0.1,
                max_tokens=2048,
                stream=True,
            )

            full_answer = ""
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    token = delta.content
                    full_answer += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # 5. Extract citations after full answer is assembled
            raw_citations = extract_citations(full_answer, retrieved_chunks)
            citations_payload = [
                {
                    "file": c["file"],
                    "start_line": c["start_line"],
                    "end_line": c["end_line"],
                    "snippet": c["snippet"],
                    "score": c["score"],
                }
                for c in raw_citations
            ]

            # Final SSE event with citations
            yield f"data: {json.dumps({'done': True, 'citations': citations_payload, 'session_id': request.session_id, 'model_used': get_model_name()})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering for Render
        },
    )
