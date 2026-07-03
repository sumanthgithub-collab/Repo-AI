/**
 * Route: /api/persona
 * Persona generation + retrieval for a repo.
 * Caches result in the Repo.personaJson DB column for fast subsequent loads.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma, ensureUser } from "../services/db";
import { aiClient } from "../services/aiProxy";

export const personaRoutes = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SuggestedQuestion {
  label: string;
  question: string;
  category: string;
}

export interface RepoPersona {
  repo_name: string;
  dominant_language: string;
  stack: string[];
  frameworks: string[];
  repo_type: string;
  architecture_style: string;
  expertise_level: string;
  file_tree: string;
  architecture_overview: string;
  onboarding_guide: string;
  conventions: string;
  key_entry_points: string[];
  suggested_questions: SuggestedQuestion[];
  total_files: number;
  total_chunks: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PERSONA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isPersonaStale(generatedAt: Date | null): boolean {
  if (!generatedAt) return true;
  return Date.now() - generatedAt.getTime() > PERSONA_CACHE_TTL_MS;
}

function normalizeRepoLanguages(languages: string): string[] {
  return languages
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean);
}

function fallbackPersona(repo: {
  githubUrl: string;
  name?: string | null;
  languages?: string | null;
  framework?: string | null;
  chunkCount?: number | null;
}): RepoPersona {
  const languages = repo.languages ? normalizeRepoLanguages(repo.languages) : [];
  const stack = languages.length > 0 ? languages.map((language) => language.toUpperCase()) : ["Unknown"];
  const repoName = repo.name ?? repo.githubUrl.replace(/\/$/, "").split("/").slice(-2).join("/");
  const framework = repo.framework ? [repo.framework] : [];

  return {
    repo_name: repoName,
    dominant_language: stack[0],
    stack: [...stack, ...framework].slice(0, 8),
    frameworks: framework,
    repo_type: "library",
    architecture_style: "unknown",
    expertise_level: "intermediate",
    file_tree: "",
    architecture_overview:
      "RepoTalk has the repository record, but the indexed code chunks are not available yet. Re-run ingestion for this repository to generate a full architecture profile.",
    onboarding_guide:
      "## Re-index this repository\n1. Go back to Repository Workspace.\n2. Delete this repository entry if it was created during a failed ingestion.\n3. Connect the GitHub URL again.\n4. Wait until indexing reaches 100%.\n5. Open the chat workspace again.",
    conventions: "Code conventions are available after successful indexing.",
    key_entry_points: [],
    suggested_questions: [
      {
        label: "Ingestion status",
        question: "Why did ingestion fail for this repository and what should I check first?",
        category: "debugging",
      },
      {
        label: "Entry point",
        question: "After indexing, what is the main entry point of this repository?",
        category: "architecture",
      },
      {
        label: "Data model",
        question: "After indexing, what data models and persistence layers are used?",
        category: "implementation",
      },
      {
        label: "Error handling",
        question: "After indexing, how does this codebase handle errors?",
        category: "debugging",
      },
      {
        label: "Testing",
        question: "After indexing, how is the test suite organized?",
        category: "onboarding",
      },
    ],
    total_files: 0,
    total_chunks: repo.chunkCount ?? 0,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/persona/:repoId
 * Returns cached persona, or generates + caches it if stale/missing.
 */
personaRoutes.get("/:repoId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    select: {
      id: true,
      githubUrl: true,
      name: true,
      languages: true,
      framework: true,
      chunkCount: true,
      status: true,
      personaJson: true,
      personaGeneratedAt: true,
    },
  });

  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  if (repo.status !== "READY") {
    res.status(409).json({ error: "Repo is not ready yet. Wait for ingestion to complete." });
    return;
  }

  // ── Cache hit: return if fresh ───────────────────────────────────────────
  if (repo.personaJson && !isPersonaStale(repo.personaGeneratedAt)) {
    res.json(JSON.parse(repo.personaJson) as RepoPersona);
    return;
  }

  // ── Cache miss: generate from AI service ─────────────────────────────────
  try {
    const aiRes = await aiClient.post<RepoPersona>("/api/v1/persona/", {
      repo_id: repo.id,
      repo_url: repo.githubUrl,
    });

    const persona = aiRes.data;

    // Persist to DB
    await prisma.repo.update({
      where: { id: repo.id },
      data: {
        personaJson: JSON.stringify(persona),
        personaGeneratedAt: new Date(),
        // Also sync detected framework into DB column
        framework: persona.frameworks?.[0] ?? null,
      },
    });

    res.json(persona);
  } catch (err: unknown) {
    // If AI service is down, return cached stale data rather than error
    if (repo.personaJson) {
      res.json(JSON.parse(repo.personaJson) as RepoPersona);
      return;
    }

    const persona = fallbackPersona(repo);
    res.json(persona);
  }
});

/**
 * POST /api/persona/:repoId/regenerate
 * Force-regenerate the persona (invalidates cache).
 */
personaRoutes.post("/:repoId/regenerate", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    select: { id: true, githubUrl: true, status: true },
  });

  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  if (repo.status !== "READY") {
    res.status(409).json({ error: "Repo not ready" });
    return;
  }

  // Clear AI-service in-memory cache
  try {
    await aiClient.delete(`/api/v1/persona/${repo.id}/cache`);
  } catch { /* ignore if endpoint doesn't exist */ }

  // Clear DB cache
  await prisma.repo.update({
    where: { id: repo.id },
    data: { personaJson: null, personaGeneratedAt: null },
  });

  // Generate fresh
  try {
    const aiRes = await aiClient.post<RepoPersona>("/api/v1/persona/", {
      repo_id: repo.id,
      repo_url: repo.githubUrl,
    });

    const persona = aiRes.data;

    await prisma.repo.update({
      where: { id: repo.id },
      data: {
        personaJson: JSON.stringify(persona),
        personaGeneratedAt: new Date(),
        framework: persona.frameworks?.[0] ?? null,
      },
    });

    res.json(persona);
  } catch (err: unknown) {
    const fallback = await prisma.repo.findUnique({
      where: { id: repo.id },
      select: {
        githubUrl: true,
        name: true,
        languages: true,
        framework: true,
        chunkCount: true,
      },
    });
    res.json(fallbackPersona(fallback ?? { githubUrl: repo.githubUrl }));
  }
});
