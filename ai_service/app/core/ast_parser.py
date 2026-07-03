"""
Core: AST Parser
Uses Tree-sitter to extract symbols (functions, classes, imports) from source code.
Supports: Python, JavaScript, TypeScript, Java, Go.

Phase 1 — Week 3 implementation.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_java
import tree_sitter_go
from tree_sitter import Language, Parser


# Note: In tree-sitter 0.23, language objects are initialized directly from the modules
SUPPORTED_LANGUAGES = {
    ".py":   ("python", Language(tree_sitter_python.language())),
    ".js":   ("javascript", Language(tree_sitter_javascript.language())),
    ".jsx":  ("javascript", Language(tree_sitter_javascript.language())),
    ".ts":   ("typescript", Language(tree_sitter_typescript.language_typescript())),
    ".tsx":  ("tsx", Language(tree_sitter_typescript.language_tsx())),
    ".java": ("java", Language(tree_sitter_java.language())),
    ".go":   ("go", Language(tree_sitter_go.language())),
}


@dataclass
class Symbol:
    """Represents an extracted AST symbol (function, class, method)."""
    name: str
    kind: str         # "function" | "class" | "method" | "import"
    file: str
    start_line: int
    end_line: int
    docstring: str = ""


@dataclass
class ParsedFile:
    """Result of parsing a single source file."""
    file_path: str
    language: str
    symbols: list[Symbol]
    imports: list[str]


def parse_file(file_path: str, source_code: str) -> ParsedFile:
    """
    Parse a source file and extract all symbols.
    Language is inferred from file extension.
    """
    ext = Path(file_path).suffix
    lang_tuple = SUPPORTED_LANGUAGES.get(ext)
    
    if not lang_tuple:
        return ParsedFile(file_path, "unknown", [], [])
        
    lang_name, ts_lang = lang_tuple
    
    # Initialize parser
    parser = Parser(ts_lang)
    
    # Parse code into an AST
    tree = parser.parse(bytes(source_code, "utf8"))
    
    symbols = []
    imports = []
    
    # Basic tree traversal to extract functions and classes
    def walk_tree(node: Any):
        node_type = node.type
        
        # Python
        if node_type == "function_definition":
            name_node = node.child_by_field_name("name")
            if name_node:
                symbols.append(Symbol(name=name_node.text.decode("utf8"), kind="function", file=file_path, start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1))
        elif node_type == "class_definition":
            name_node = node.child_by_field_name("name")
            if name_node:
                symbols.append(Symbol(name=name_node.text.decode("utf8"), kind="class", file=file_path, start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1))
        
        # JS / TS
        elif node_type in ["function_declaration", "method_definition"]:
            name_node = node.child_by_field_name("name")
            if name_node:
                symbols.append(Symbol(name=name_node.text.decode("utf8"), kind="function", file=file_path, start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1))
        elif node_type == "class_declaration":
            name_node = node.child_by_field_name("name")
            if name_node:
                symbols.append(Symbol(name=name_node.text.decode("utf8"), kind="class", file=file_path, start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1))
                
        # Java / Go
        elif node_type in ["method_declaration"]:
            name_node = node.child_by_field_name("name")
            if name_node:
                symbols.append(Symbol(name=name_node.text.decode("utf8"), kind="method", file=file_path, start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1))
                
        # Traverse children
        for child in node.children:
            walk_tree(child)

    walk_tree(tree.root_node)
    
    return ParsedFile(
        file_path=file_path,
        language=lang_name,
        symbols=symbols,
        imports=imports
    )


def get_language_for_file(file_path: str) -> str | None:
    """Return the Tree-sitter language name for a given file path, or None if unsupported."""
    ext = Path(file_path).suffix
    lang_tuple = SUPPORTED_LANGUAGES.get(ext)
    return lang_tuple[0] if lang_tuple else None
