"""
Core: Code Chunker
Splits source files into 500-token overlapping chunks that respect
AST boundaries (never cuts mid-function or mid-class).

Phase 1 — Week 1 implementation.
"""

from dataclasses import dataclass, field
import tiktoken
import uuid
from app.core.ast_parser import ParsedFile, Symbol

_encoding = tiktoken.get_encoding("cl100k_base")


@dataclass
class Chunk:
    """A single processable unit from a source file."""
    chunk_id: str           # "{repo_id}_{file_path}_{chunk_index}"
    repo_id: str
    file_path: str
    language: str
    content: str            # The actual code text
    start_line: int
    end_line: int
    # AST metadata (enriched after parsing)
    function_names: list[str] = field(default_factory=list)
    class_names:    list[str] = field(default_factory=list)
    imports:        list[str] = field(default_factory=list)
    token_count:    int = 0


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken cl100k_base encoding."""
    return len(_encoding.encode(text))


def chunk_file(
    repo_id: str,
    file_path: str,
    source_code: str,
    parsed_file: ParsedFile | None = None,
    max_tokens: int = 500,
    overlap_tokens: int = 50,
) -> list[Chunk]:
    """
    Split a source file into chunks, respecting AST symbol boundaries.
    """
    lines = source_code.splitlines(keepends=True)
    chunks = []
    
    current_chunk_lines = []
    current_tokens = 0
    start_line = 1
    
    symbols = parsed_file.symbols if parsed_file else []
    lang = parsed_file.language if parsed_file else "unknown"
    
    chunk_idx = 0
    
    for i, line in enumerate(lines):
        line_num = i + 1
        line_tokens = count_tokens(line)
        
        # If adding this line exceeds max_tokens, and we have enough content, flush the chunk
        if current_tokens + line_tokens > max_tokens and current_tokens > 0:
            content = "".join(current_chunk_lines)
            
            # Find symbols bounding this chunk
            funcs = [s.name for s in symbols if s.kind == "function" and not (s.end_line < start_line or s.start_line > line_num - 1)]
            classes = [s.name for s in symbols if s.kind == "class" and not (s.end_line < start_line or s.start_line > line_num - 1)]
            
            chunks.append(Chunk(
                chunk_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{repo_id}_{file_path}_{chunk_idx}")),
                repo_id=repo_id,
                file_path=file_path,
                language=lang,
                content=content,
                start_line=start_line,
                end_line=line_num - 1,
                function_names=funcs,
                class_names=classes,
                token_count=current_tokens
            ))
            chunk_idx += 1
            
            # Start new chunk, preserving overlap
            overlap_lines = current_chunk_lines[-overlap_tokens:] if len(current_chunk_lines) > overlap_tokens else current_chunk_lines[-10:]
            current_chunk_lines = overlap_lines
            current_tokens = sum(count_tokens(l) for l in current_chunk_lines)
            start_line = line_num - len(overlap_lines)
            if start_line < 1: start_line = 1

        current_chunk_lines.append(line)
        current_tokens += line_tokens

    # Flush remaining
    if current_chunk_lines:
        content = "".join(current_chunk_lines)
        funcs = [s.name for s in symbols if s.kind == "function" and not (s.end_line < start_line or s.start_line > len(lines))]
        classes = [s.name for s in symbols if s.kind == "class" and not (s.end_line < start_line or s.start_line > len(lines))]
        chunks.append(Chunk(
            chunk_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{repo_id}_{file_path}_{chunk_idx}")),
            repo_id=repo_id,
            file_path=file_path,
            language=lang,
            content=content,
            start_line=start_line,
            end_line=len(lines),
            function_names=funcs,
            class_names=classes,
            token_count=current_tokens
        ))

    return chunks
