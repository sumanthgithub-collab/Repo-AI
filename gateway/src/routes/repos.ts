/**
 * Route: /api/repos
 * Repo management — connect, list, get, status poll, delete.
 * Triggers AI service ingestion as a background job.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma, ensureUser } from "../services/db";
import {
  triggerIngestion,
  getIngestStatus,
  deleteRepoVectors,
} from "../services/aiProxy";

export const repoRoutes = Router();

// ── Validation schemas ─────────────────────────────────────────────────────────

const CreateRepoSchema = z.object({
  githubUrl: z
    .string()
    .url("Must be a valid URL")
    .regex(/github\.com/, "Must be a GitHub URL"),
  languages: z.array(z.string()).optional().default(["py", "js", "ts"]),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function repoNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // pathname = "/owner/repo" → "owner/repo"
    return u.pathname.replace(/^\//, "").replace(/\.git$/, "") || url;
  } catch {
    return url;
  }
}

function normalizeRepoLanguages(languages: string): string[] {
  return languages.split(",").map((lang) => lang.trim()).filter(Boolean);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/repos
 * Connect a new GitHub repo. Fires ingestion in background.
 */
repoRoutes.post("/", requireAuth, async (req, res) => {
  const parse = CreateRepoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { githubUrl, languages } = parse.data;
  const userId = await ensureUser(req.userId!, req.userEmail);

  // Create repo record
  const repo = await prisma.repo.create({
    data: {
      githubUrl,
      name: repoNameFromUrl(githubUrl),
      languages: languages.join(","),  // Store as comma-separated for SQLite
      status: "INGESTING",
      userId,
    },
  });

  // Trigger ingestion (fire and forget — pipeline runs in background)
  try {
    await triggerIngestion({
      repo_url: githubUrl,
      repo_id: repo.id,
      user_id: userId,
      languages,
    });
  } catch (err) {
    // If trigger fails, mark as error but still return the repo
    await prisma.repo.update({
      where: { id: repo.id },
      data: { status: "ERROR", errorMsg: "Failed to start ingestion" },
    });
    res.status(202).json({
      repoId: repo.id,
      status: "error",
      message: "Repo created but ingestion could not be started",
    });
    return;
  }

  res.status(202).json({
    repoId: repo.id,
    status: "ingesting",
    message: "Ingestion started in background",
  });
});

/**
 * GET /api/repos
 * List all repos for the current user.
 */
repoRoutes.get("/", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repos = await prisma.repo.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  // Deserialize languages back to array
  const reposList = repos.map((r) => ({
    ...r,
    languages: normalizeRepoLanguages(r.languages),
  }));

  res.json(reposList);
});

/**
 * GET /api/repos/:repoId
 * Get a single repo with session count.
 */
repoRoutes.get("/:repoId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    include: { _count: { select: { sessions: true } } },
  });

  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  res.json({
    ...repo,
    languages: normalizeRepoLanguages(repo.languages),
  });
});

/**
 * GET /api/repos/:repoId/status
 * Poll ingestion status. Proxied from AI service. Also syncs DB.
 */
repoRoutes.get("/:repoId/status", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    select: { id: true, status: true },
  });

  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  try {
    const aiStatus = await getIngestStatus(req.params.repoId);

    // Sync DB status from AI service
    if (aiStatus.status === "done") {
      await prisma.repo.update({
        where: { id: repo.id },
        data: {
          status: "READY",
          chunkCount: aiStatus.total_chunks,
          errorMsg: null,
        },
      });
    } else if (aiStatus.status === "error") {
      await prisma.repo.update({
        where: { id: repo.id },
        data: {
          status: "ERROR",
          errorMsg: aiStatus.error ?? "Ingestion failed",
        },
      });
    } else if (aiStatus.status !== "pending") {
      // Still in progress
      await prisma.repo.update({
        where: { id: repo.id },
        data: { status: "INGESTING" },
      });
    }

    res.json(aiStatus);
  } catch {
    // AI service unreachable — return DB status
    res.json({
      repo_id: req.params.repoId,
      status: repo.status.toLowerCase(),
      current_stage: "Checking status...",
      total_chunks: 0,
      embedded_chunks: 0,
      progress_pct: 0,
    });
  }
});

/**
 * DELETE /api/repos/:repoId
 * Delete repo from DB + remove Qdrant vectors.
 */
repoRoutes.delete("/:repoId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    select: { id: true },
  });

  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  // Delete from DB (cascades to sessions + messages)
  await prisma.repo.delete({ where: { id: repo.id } });

  // Delete Qdrant vectors (best-effort — don't fail if AI service is down)
  try {
    await deleteRepoVectors(repo.id, userId);
  } catch { /* ignore */ }

  res.json({ deleted: true, repoId: repo.id });
});
