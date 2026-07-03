"""
Router: /api/v1/symbols
AST-powered symbol lookup using metadata already stored in Qdrant payloads.
"""

from fastapi import APIRouter

from app.core.symbol_index import iter_symbol_candidates, merge_symbol_results
from app.core.vector_store import list_repo_chunks
from app.models.schemas import SymbolRequest, SymbolResult

router = APIRouter()


@router.post("/lookup", response_model=list[SymbolResult], summary="Find a symbol by name")
async def lookup_symbol(request: SymbolRequest):
    """
    Given a symbol name (e.g. "authenticate"), search Qdrant metadata
    for matching function/class definitions and return their file:line locations.
    """
    chunks = await list_repo_chunks(request.repo_id)
    symbol_name = request.symbol_name.strip().lower()
    if not symbol_name:
        return []

    symbols = merge_symbol_results(iter_symbol_candidates(chunks))
    return [symbol for symbol in symbols if symbol.name.lower() == symbol_name]


@router.get("/{repo_id}/all", response_model=list[SymbolResult], summary="List all symbols for a repo")
async def list_all_symbols(repo_id: str):
    """
    Return all extracted symbols for a repo.
    Used to build the repo symbol index in the frontend workspace.
    """
    chunks = await list_repo_chunks(repo_id)
    return merge_symbol_results(iter_symbol_candidates(chunks))
