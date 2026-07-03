"""
Core: Symbol Index Helpers
Transforms chunk metadata stored in Qdrant payloads into deduplicated symbol results.
"""

from collections.abc import Iterable

from app.models.schemas import SymbolResult


def iter_symbol_candidates(chunk_payloads: Iterable[dict]) -> list[SymbolResult]:
    candidates: list[SymbolResult] = []

    for payload in chunk_payloads:
        file_path = str(payload.get("file_path", ""))
        start_line = int(payload.get("start_line", 1) or 1)
        end_line = int(payload.get("end_line", start_line) or start_line)

        for name in payload.get("function_names", []) or []:
            if not name:
                continue
            candidates.append(
                SymbolResult(
                    name=str(name),
                    kind="function",
                    file=file_path,
                    start_line=start_line,
                    end_line=end_line,
                )
            )

        for name in payload.get("class_names", []) or []:
            if not name:
                continue
            candidates.append(
                SymbolResult(
                    name=str(name),
                    kind="class",
                    file=file_path,
                    start_line=start_line,
                    end_line=end_line,
                )
            )

    return candidates


def merge_symbol_results(symbols: Iterable[SymbolResult]) -> list[SymbolResult]:
    merged: dict[tuple[str, str, str], SymbolResult] = {}

    for symbol in symbols:
        key = (symbol.name, symbol.kind, symbol.file)
        existing = merged.get(key)
        if existing is None:
            merged[key] = symbol.model_copy()
            continue

        existing.start_line = min(existing.start_line, symbol.start_line)
        existing.end_line = max(existing.end_line, symbol.end_line)

    return sorted(
        merged.values(),
        key=lambda symbol: (
            symbol.file.lower(),
            symbol.start_line,
            symbol.kind,
            symbol.name.lower(),
        ),
    )
