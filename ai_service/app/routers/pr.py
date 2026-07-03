"""
Router: /api/v1/pr
PR diff analysis and plain-English summarization.

Phase 3 — Week 8 implementation.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import PRRequest, PRResponse

router = APIRouter()


@router.post("/summarize", response_model=PRResponse, summary="Summarize a GitHub PR")
async def summarize_pr(request: PRRequest):
    """
    Given a GitHub PR URL:
      1. Fetch PR diff via GitHub API (using GITHUB_TOKEN)
      2. Parse changed files and identify modified functions (via Tree-sitter diff analysis)
      3. Query Qdrant for callers of modified functions (impact analysis)
      4. Generate plain-English summary of changes using LLM
      5. List impact warnings: which functions/files are affected
      6. Return structured PR summary + impact report
    """
    # TODO: Implement in Phase 3 - Week 8
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 3 Week 8")


@router.post("/webhook", summary="GitHub webhook handler")
async def github_webhook(payload: dict):
    """
    Receives GitHub push/PR webhook events.
    On push: re-indexes changed chunks in Qdrant.
    On PR open: triggers impact analysis.
    """
    # TODO: Implement in Phase 3 - Week 8
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 3 Week 8")
