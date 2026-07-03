/**
 * Route: /api/sessions
 * Session + Message CRUD — persistent chat history.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma, ensureUser } from "../services/db";
import { normalizeCitations } from "../services/aiProxy";

export const sessionRoutes = Router();

function parseStoredCitations(raw: unknown) {
  if (!raw) return null;
  try {
    return normalizeCitations(JSON.parse(raw as string));
  } catch {
    return null;
  }
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  repoId: z.string().min(1),
  title: z.string().optional(),
});

const SaveMessageSchema = z.object({
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string().min(1),
  citations: z.array(z.unknown()).optional(),
  ragasScore: z.record(z.number()).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 * Create a new chat session for a repo.
 */
sessionRoutes.post("/", requireAuth, async (req, res) => {
  const parse = CreateSessionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const userId = await ensureUser(req.userId!, req.userEmail);
  const { repoId, title } = parse.data;

  // Verify repo belongs to user
  const repo = await prisma.repo.findFirst({
    where: { id: repoId, userId },
    select: { id: true },
  });
  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  const session = await prisma.session.create({
    data: { repoId, userId, title: title ?? null },
    select: { id: true, repoId: true, userId: true, title: true, createdAt: true },
  });

  res.status(201).json(session);
});

/**
 * GET /api/sessions?repoId=xxx
 * List all sessions for the current user, optionally filtered by repo.
 */
sessionRoutes.get("/", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);
  const { repoId } = req.query;

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      ...(repoId && typeof repoId === "string" ? { repoId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  res.json(sessions);
});

/**
 * GET /api/sessions/bookmarks
 * Get all bookmarked messages across all sessions for the user.
 * IMPORTANT: must be declared before GET /:sessionId to avoid wildcard collision.
 */
sessionRoutes.get("/bookmarks", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const messages = await prisma.message.findMany({
    where: {
      bookmarked: true,
      session: { userId },
    },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          repo: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    messages.map((m) => ({
      ...m,
      citations: parseStoredCitations(m.citations),
      ragasScore: m.ragasScore ? JSON.parse(m.ragasScore as string) : null,
    }))
  );
});

/**
 * GET /api/sessions/:sessionId
 * Get a session with all its messages.
 */
sessionRoutes.get("/:sessionId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const session = await prisma.session.findFirst({
    where: { id: req.params.sessionId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Parse JSON fields in messages
  res.json({
    ...session,
    messages: session.messages.map((m) => ({
      ...m,
      citations: parseStoredCitations(m.citations),
      ragasScore: m.ragasScore ? JSON.parse(m.ragasScore as string) : null,
    })),
  });
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session and all its messages.
 */
sessionRoutes.delete("/:sessionId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const session = await prisma.session.findFirst({
    where: { id: req.params.sessionId, userId },
    select: { id: true },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await prisma.session.delete({ where: { id: session.id } });
  res.json({ deleted: true });
});

/**
 * POST /api/sessions/:sessionId/messages
 * Save a message (user or assistant) to a session.
 */
sessionRoutes.post("/:sessionId/messages", requireAuth, async (req, res) => {
  const parse = SaveMessageSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const userId = await ensureUser(req.userId!, req.userEmail);

  const session = await prisma.session.findFirst({
    where: { id: req.params.sessionId, userId },
    select: { id: true },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { role, content, citations, ragasScore } = parse.data;
  const normalizedCitations = citations ? normalizeCitations(citations) : undefined;

  // Auto-title session from first user message
  if (role === "USER") {
    const existingMessages = await prisma.message.count({
      where: { sessionId: session.id },
    });
    if (existingMessages === 0) {
      const autoTitle =
        content.length > 60 ? content.slice(0, 57) + "..." : content;
      await prisma.session.update({
        where: { id: session.id },
        data: { title: autoTitle, updatedAt: new Date() },
      });
    } else {
      // touch updatedAt so list sorts correctly
      await prisma.session.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      });
    }
  }

  const message = await prisma.message.create({
    data: {
      role,
      content,
      citations: normalizedCitations ? JSON.stringify(normalizedCitations) : undefined,
      ragasScore: ragasScore ? JSON.stringify(ragasScore) : undefined,
      sessionId: session.id,
    },
  });

  // Parse JSON strings back for response
  res.status(201).json({
    ...message,
    citations: parseStoredCitations(message.citations),
    ragasScore: message.ragasScore ? JSON.parse(message.ragasScore as string) : null,
  });
});



/**
 * PATCH /api/sessions/:sessionId/messages/:messageId/bookmark
 * Toggle the bookmarked flag.
 */
sessionRoutes.patch(
  "/:sessionId/messages/:messageId/bookmark",
  requireAuth,
  async (req, res) => {
    const userId = await ensureUser(req.userId!, req.userEmail);

    const message = await prisma.message.findFirst({
      where: {
        id: req.params.messageId,
        session: { id: req.params.sessionId, userId },
      },
    });

    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { bookmarked: !message.bookmarked },
    });

    res.json({
      ...updated,
      citations: parseStoredCitations(updated.citations),
      ragasScore: updated.ragasScore ? JSON.parse(updated.ragasScore as string) : null,
    });
  }
);
