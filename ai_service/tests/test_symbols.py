from app.models.schemas import SymbolResult
from app.core.symbol_index import iter_symbol_candidates, merge_symbol_results


def test_iter_symbol_candidates_maps_chunk_metadata_to_symbol_results():
    chunk_payloads = [
        {
            "file_path": "src/auth.py",
            "start_line": 5,
            "end_line": 18,
            "function_names": ["authenticate", "authorize"],
            "class_names": ["AuthService"],
        }
    ]

    results = iter_symbol_candidates(chunk_payloads)

    assert [(result.name, result.kind) for result in results] == [
        ("authenticate", "function"),
        ("authorize", "function"),
        ("AuthService", "class"),
    ]
    assert all(result.file == "src/auth.py" for result in results)


def test_merge_symbol_results_deduplicates_by_name_kind_and_file():
    symbols = [
        SymbolResult(
            name="authenticate",
            kind="function",
            file="src/auth.py",
            start_line=5,
            end_line=18,
        ),
        SymbolResult(
            name="authenticate",
            kind="function",
            file="src/auth.py",
            start_line=12,
            end_line=24,
        ),
        SymbolResult(
            name="AuthService",
            kind="class",
            file="src/auth.py",
            start_line=1,
            end_line=30,
        ),
    ]

    merged = merge_symbol_results(symbols)

    assert len(merged) == 2
    auth_function = next(symbol for symbol in merged if symbol.name == "authenticate")
    assert auth_function.start_line == 5
    assert auth_function.end_line == 24
