"""
Core: GitHub Repo Cloner
Handles cloning and local management of GitHub repositories.

Phase 1 — Week 1 implementation.
"""

import os
import shutil
from pathlib import Path
from git import Repo, exc
from app.config import settings

CLONE_BASE_DIR = Path(settings.REPOS_DIR)

PLACEHOLDER_TOKEN_PARTS = (
    "your_",
    "token_here",
    "placeholder",
    "github_token",
)

# Excluded directories and file patterns
EXCLUDED_DIRS = {
    "node_modules", ".git", "__pycache__", "dist", "build",
    "venv", ".venv", "env", ".env", "coverage", ".next", "out"
}

EXCLUDED_EXTENSIONS = {
    ".min.js", ".lock", ".log", ".pyc", ".pyo", ".pyd",
    ".so", ".dll", ".dylib", ".exe", ".bin", ".sqlite", 
    ".jpeg", ".jpg", ".png", ".gif", ".svg", ".ico"
}

MAX_FILE_SIZE_BYTES = 500 * 1024  # 500KB


def clone_repo(repo_url: str, repo_id: str) -> Path:
    """
    Clone a GitHub repository to local disk.
    If it exists, fetch and pull latest.
    """
    repo_path = CLONE_BASE_DIR / repo_id
    if not CLONE_BASE_DIR.exists():
        CLONE_BASE_DIR.mkdir(parents=True, exist_ok=True)
    
    auth_url = repo_url
    github_token = settings.GITHUB_TOKEN.strip()
    is_placeholder_token = any(part in github_token.lower() for part in PLACEHOLDER_TOKEN_PARTS)
    if github_token and not is_placeholder_token and repo_url.startswith("https://"):
        auth_url = repo_url.replace("https://", f"https://oauth2:{github_token}@")
    
    try:
        if repo_path.exists() and (repo_path / ".git").exists():
            repo = Repo(repo_path)
            origin = repo.remotes.origin
            origin.pull()
        else:
            Repo.clone_from(auth_url, repo_path, depth=1)
    except exc.GitCommandError as e:
        raise ValueError(f"Failed to clone repository: {str(e)}")
        
    return repo_path


def get_repo_files(repo_path: Path, language_filter: list[str] | None = None) -> list[Path]:
    """
    Walk the cloned repo and return all source files relative to repo_path.
    Filters by language extensions and file size/ignored directories.
    """
    source_files = []
    
    if language_filter:
        # ensure extensions start with '.'
        language_filter = [ext if ext.startswith('.') else f".{ext}" for ext in language_filter]
        
    for root, dirs, files in os.walk(repo_path):
        # Exclude directories in place (skip hidden dirs like .github)
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith('.')]
        
        for file in files:
            path = Path(root) / file
            
            # Filter by extension
            if path.suffix in EXCLUDED_EXTENSIONS:
                continue
                
            if language_filter and path.suffix not in language_filter:
                continue
                
            # Filter by size
            if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                continue
                
            source_files.append(path.relative_to(repo_path))
            
    return source_files


def cleanup_repo(repo_id: str) -> None:
    """Delete the local clone for a repo after ingestion is complete (save disk space)."""
    repo_path = CLONE_BASE_DIR / repo_id
    if repo_path.exists():
        shutil.rmtree(repo_path, ignore_errors=True)
