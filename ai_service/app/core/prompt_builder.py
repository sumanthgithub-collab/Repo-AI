"""
Core: Prompt Builder
Constructs the grounding prompt sent to the LLM.
The system prompt forces the model to answer ONLY from retrieved context.

Phase 1 — Week 2 implementation.
"""

import re


LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".java": "java",
    ".go": "go",
}

SYSTEM_PROMPT = """You are RepoTalk, an expert code assistant. You help developers understand codebases.

STRICT RULES:
1. Answer ONLY using the provided code context below. Do not use any external knowledge.
2. If the answer cannot be found in the context, say: "I couldn't find this in the codebase."
3. Always cite your sources using the format [file.py:line_start-line_end] inline in your answer.
4. Be concise and technical. Assume the user is a developer.
5. When referencing code, use inline code blocks.

You will be provided with:
- The user's question
- Relevant code chunks from the repository (with file paths and line numbers)
- Recent conversation history (for multi-turn context)
"""

# Max conversation history turns to include (to stay within context window)
MAX_HISTORY_TURNS = 10


def get_language_for_file(file_path: str) -> str | None:
    """Return a syntax-highlighting hint based on file extension."""
    dot_index = file_path.rfind(".")
    if dot_index == -1:
        return None
    return LANGUAGE_BY_EXTENSION.get(file_path[dot_index:].lower())


def build_query_prompt(
    question: str,
    retrieved_chunks: list[dict],
    conversation_history: list[dict],
) -> list[dict]:
    """
    Build the full message list for the LLM chat completion.

    Returns:
        List of message dicts ready for client.chat.completions.create(messages=...)
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject recent conversation history (trimmed to MAX_HISTORY_TURNS)
    history = conversation_history[-MAX_HISTORY_TURNS:]
    for turn in history:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Build the final user message with context + question
    context_block = format_context_block(retrieved_chunks)
    final_user_message = f"{context_block}\n\nQuestion: {question}"
    messages.append({"role": "user", "content": final_user_message})

    return messages


def format_context_block(chunks: list[dict]) -> str:
    """
    Format retrieved chunks into the context block injected into the final user message.
    """
    if not chunks:
        return "--- CONTEXT ---\nNo relevant code found.\n--- END CONTEXT ---"

    sections = ["--- CONTEXT ---"]
    for chunk in chunks:
        file_path = chunk.get("file_path", "unknown")
        start_line = chunk.get("start_line", 0)
        end_line = chunk.get("end_line", 0)
        content = chunk.get("content", "")

        # Detect language for syntax highlighting
        lang = get_language_for_file(file_path) or ""

        header = f"[{file_path}:{start_line}-{end_line}]"
        sections.append(f"{header}\n```{lang}\n{content.rstrip()}\n```")

    sections.append("--- END CONTEXT ---")
    return "\n\n".join(sections)


def extract_citations(answer: str, chunks: list[dict]) -> list[dict]:
    """
    Parse the LLM response and match inline citations ([file:line-line]) to actual chunks.

    Returns list of structured citation objects:
        [{"file": "src/auth.py", "start_line": 15, "end_line": 42, "snippet": "...", "score": 0.95}]
    """
    # Regex pattern to find citations like [file.py:10-25] or [src/utils.ts:100-120]
    pattern = r"\[([^\]]+?):(\d+)-(\d+)\]"
    matches = re.findall(pattern, answer)

    citations = []
    seen = set()

    for file_ref, start_str, end_str in matches:
        start_line = int(start_str)
        end_line = int(end_str)
        key = (file_ref, start_line, end_line)

        if key in seen:
            continue
        seen.add(key)

        # Try to match this citation back to an actual retrieved chunk
        snippet = ""
        score = 0.0
        for chunk in chunks:
            chunk_file = chunk.get("file_path", "")
            # Match if the citation file is a suffix of the chunk file path
            # (e.g. "auth.py" matches "src/auth.py")
            if chunk_file.endswith(file_ref) or file_ref.endswith(chunk_file) or chunk_file == file_ref:
                # Check if line ranges overlap
                c_start = chunk.get("start_line", 0)
                c_end = chunk.get("end_line", 0)
                if not (end_line < c_start or start_line > c_end):
                    snippet = chunk.get("content", "")[:300]  # Truncate for response size
                    score = chunk.get("score", 0.0)
                    break

        citations.append({
            "file": file_ref,
            "start_line": start_line,
            "end_line": end_line,
            "snippet": snippet,
            "score": score,
        })

    return citations
