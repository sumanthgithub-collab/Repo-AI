"""
RepoTalk AI Service — Configuration
Loads environment variables with sensible defaults.
"""

from pathlib import Path

from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- App ---
    APP_NAME: str = "RepoTalk AI Service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # --- LLM Provider ---
    LLM_PROVIDER: Literal["groq", "ollama"] = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384  # 384 for all-MiniLM-L6-v2; 768 for nomic-embed-code-v1
    EMBEDDING_DEVICE: str = "cpu"

    # --- Qdrant ---
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "repotalk_chunks"
    QDRANT_LOCAL_PATH: str = "./.qdrant_local"  # used when QDRANT_URL is localhost

    # --- GitHub ---
    GITHUB_TOKEN: str = ""

    # --- Langfuse ---
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "http://localhost:3001"

    # --- Paths ---
    REPOS_DIR: str = "./repos_cache"

    class Config:
        # Load from the ai_service local .env (not the root .env which has
        # gateway/frontend keys that would cause extra-field validation errors)
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


def _read_root_github_token() -> str:
    """Read the shared root .env token when ai_service/.env leaves it blank."""
    root_env = Path(__file__).resolve().parents[2] / ".env"
    if not root_env.exists():
        return ""

    for line in root_env.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("GITHUB_TOKEN="):
            continue
        return line.split("=", 1)[1].strip().strip('"').strip("'")

    return ""


settings = Settings()
if not settings.GITHUB_TOKEN.strip():
    settings.GITHUB_TOKEN = _read_root_github_token()
