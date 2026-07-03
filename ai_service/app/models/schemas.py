"""
Pydantic request/response models for the AI Service.
Shared across all routers.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
class IngestRequest(BaseModel):
    repo_url: str = Field(..., example="https://github.com/tiangolo/fastapi")
    languages: list[str] = Field(
        default=["python", "javascript", "typescript", "java", "go"],
        description="File extensions to include. Leave empty for all supported languages.",
    )
    user_id: str = Field(..., description="Clerk user ID — stored as collection owner.")
    repo_id: str = Field(..., description="Unique repo ID from the Node gateway DB.")


class IngestResponse(BaseModel):
    repo_id: str
    status: str                  # "ingesting" | "done" | "error"
    chunks_created: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    question: str = Field(..., example="Where is authentication handled?")
    repo_id: str
    session_id: str
    history: list[dict] = Field(
        default=[],
        description="Last N messages for multi-turn context. [{role, content}]",
    )
    top_k: int = Field(default=5, description="Number of chunks to retrieve.")


class Citation(BaseModel):
    file: str
    start_line: int
    end_line: int
    snippet: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    session_id: str
    model_used: str


# ---------------------------------------------------------------------------
# Symbols
# ---------------------------------------------------------------------------
class SymbolRequest(BaseModel):
    symbol_name: str = Field(..., example="authenticate")
    repo_id: str


class SymbolResult(BaseModel):
    name: str
    kind: str    # "function" | "class" | "method"
    file: str
    start_line: int
    end_line: int


# ---------------------------------------------------------------------------
# Persona
# ---------------------------------------------------------------------------
class PersonaRequest(BaseModel):
    repo_id: str
    repo_url: str


class PersonaResponse(BaseModel):
    stack: list[str]
    dominant_language: str
    frameworks: list[str]
    architecture_style: str
    conventions: str
    key_contributors: list[str]
    onboarding_guide: str    # Markdown
    architecture_overview: str  # Text-based diagram


# ---------------------------------------------------------------------------
# PR Summarizer
# ---------------------------------------------------------------------------
class PRRequest(BaseModel):
    pr_url: str = Field(..., example="https://github.com/owner/repo/pull/42")
    repo_id: str


class PRResponse(BaseModel):
    summary: str
    impact_warnings: list[str]
    changed_functions: list[str]
    diff_overview: str


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------
class EvalRequest(BaseModel):
    question: str
    answer: str
    contexts: list[str]     # The retrieved chunks that generated the answer
    repo_id: str
    message_id: str


class EvalResponse(BaseModel):
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    overall: str            # "high" | "medium" | "low"
    message_id: str
