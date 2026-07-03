"""
Core: LLM Provider Abstraction
Switches between Groq API and Ollama with a single environment variable.
Both expose an OpenAI-compatible API, so the same client works for both.

Phase 1 — Week 2 implementation.
"""

from openai import AsyncOpenAI
from app.config import settings

# Singleton client — initialized once per provider
_client: AsyncOpenAI | None = None
_active_provider: str | None = None


def get_llm_client() -> AsyncOpenAI:
    """
    Returns an async OpenAI-compatible client pointed at either:
      - Groq API  (LLM_PROVIDER=groq)   — https://api.groq.com/openai/v1
      - Ollama    (LLM_PROVIDER=ollama)  — http://localhost:11434/v1

    The client is cached as a singleton. If the provider setting changes
    at runtime (unlikely but possible), a new client is created.
    """
    global _client, _active_provider

    provider = settings.LLM_PROVIDER

    # Re-create client only if provider changed or first call
    if _client is None or _active_provider != provider:
        if provider == "groq":
            _client = AsyncOpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=settings.GROQ_API_KEY,
            )
        elif provider == "ollama":
            _client = AsyncOpenAI(
                base_url=f"{settings.OLLAMA_BASE_URL}/v1",
                api_key="ollama",  # Ollama doesn't need a real key but the SDK requires one
            )
        else:
            raise ValueError(f"Unknown LLM_PROVIDER: {provider}. Use 'groq' or 'ollama'.")

        _active_provider = provider

    return _client


def get_model_name() -> str:
    """Return the correct model name for the active provider."""
    if settings.LLM_PROVIDER == "groq":
        return settings.GROQ_MODEL       # e.g. "llama-3.3-70b-versatile"
    elif settings.LLM_PROVIDER == "ollama":
        return settings.OLLAMA_MODEL      # e.g. "llama3.1:8b"
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {settings.LLM_PROVIDER}")


def get_provider_info() -> dict:
    """Return a summary of the active LLM configuration (for health checks / debug)."""
    return {
        "provider": settings.LLM_PROVIDER,
        "model": get_model_name(),
        "base_url": "https://api.groq.com/openai/v1" if settings.LLM_PROVIDER == "groq"
                    else f"{settings.OLLAMA_BASE_URL}/v1",
    }
