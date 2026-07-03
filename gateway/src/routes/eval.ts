/**
 * Route: /api/eval
 * Proxies to the FastAPI evaluation service and aggregates RAGAS metrics from DB.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma, ensureUser } from "../services/db";
import { aiClient } from "../services/aiProxy";

export const evalRoutes = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface RagasScore {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  overall: string;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/eval/dashboard/:repoId
 * Aggregates stored RAGAS scores from the DB for all messages in a repo.
 * Returns averages and a timeline of individual scores.
 */
evalRoutes.get("/dashboard/:repoId", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  // Verify repo belongs to this user
  const repo = await prisma.repo.findFirst({
    where: { id: req.params.repoId, userId },
    select: { id: true, name: true },
  });
  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  // Fetch all assistant messages with ragasScore in this repo
  const messages = await prisma.message.findMany({
    where: {
      session: { repoId: repo.id, userId },
      role: "ASSISTANT",
      NOT: { ragasScore: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ragasScore: true,
      createdAt: true,
      content: true,
    },
  });

  if (messages.length === 0) {
    res.json({
      repoId: repo.id,
      repoName: repo.name,
      totalEvaluated: 0,
      aggregate: null,
      timeline: [],
    });
    return;
  }

  // Parse scores
  const scores: RagasScore[] = messages
    .map((m) => {
      try {
        return JSON.parse(m.ragasScore as string) as RagasScore;
      } catch {
        return null;
      }
    })
    .filter((s): s is RagasScore => s !== null);

  const n = scores.length;
  const avgFaithfulness = scores.reduce((acc, s) => acc + s.faithfulness, 0) / n;
  const avgRelevancy    = scores.reduce((acc, s) => acc + s.answer_relevancy, 0) / n;
  const avgPrecision    = scores.reduce((acc, s) => acc + s.context_precision, 0) / n;

  const grade = (avg: number) => avg > 0.8 ? "high" : avg >= 0.6 ? "medium" : "low";

  const timeline = messages.map((m, i) => {
    const s = scores[i];
    return {
      messageId: m.id,
      createdAt: m.createdAt,
      faithfulness:     s?.faithfulness ?? null,
      answer_relevancy: s?.answer_relevancy ?? null,
      context_precision: s?.context_precision ?? null,
      overall:          s?.overall ?? null,
    };
  });

  res.json({
    repoId: repo.id,
    repoName: repo.name,
    totalEvaluated: n,
    aggregate: {
      avg_faithfulness:     Math.round(avgFaithfulness * 1000) / 1000,
      avg_relevancy:        Math.round(avgRelevancy * 1000) / 1000,
      avg_precision:        Math.round(avgPrecision * 1000) / 1000,
      overall_grade:        grade((avgFaithfulness + avgRelevancy + avgPrecision) / 3),
    },
    timeline,
  });
});

/**
 * POST /api/eval/score
 * Manually trigger RAGAS evaluation on a specific message.
 * Body: { messageId, question, answer, contexts }
 * Stores result in DB message.ragasScore.
 */
evalRoutes.post("/score", requireAuth, async (req, res) => {
  const { messageId, question, answer, contexts, repoId } = req.body;

  if (!messageId || !question || !answer || !Array.isArray(contexts)) {
    res.status(400).json({ error: "messageId, question, answer, and contexts[] are required" });
    return;
  }

  const userId = await ensureUser(req.userId!, req.userEmail);

  // Verify the message belongs to this user
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      session: { userId },
    },
    select: { id: true },
  });

  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  try {
    const evalRes = await aiClient.post("/api/v1/eval/score", {
      question,
      answer,
      contexts,
      repo_id: repoId ?? "",
      message_id: messageId,
    });

    const scores = evalRes.data as RagasScore & { message_id: string };

    // Persist scores to DB
    await prisma.message.update({
      where: { id: messageId },
      data: {
        ragasScore: JSON.stringify({
          faithfulness:      scores.faithfulness,
          answer_relevancy:  scores.answer_relevancy,
          context_precision: scores.context_precision,
          overall:           scores.overall,
        }),
      },
    });

    res.json(scores);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Evaluation failed";
    res.status(502).json({ error: `AI service error: ${msg}` });
  }
});
