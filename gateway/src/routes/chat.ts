/**
 * Route: /api/chat
 * Proxies queries to the FastAPI AI service.
 * Handles both non-streaming (JSON) and streaming (SSE) responses.
 */

import { Router } from "express";
import { IncomingMessage } from "http";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimit";
import { prisma, ensureUser } from "../services/db";
import { aiClient, normalizeCitations, queryAI } from "../services/aiProxy";

export const chatRoutes = Router();
const HISTORY_LIMIT = 10;

// ── Phase 1: Concurrent request guard ────────────────────────────────────────
//
// Prevents duplicate DB writes when the client fires two requests for the same
// session before the first one completes (rapid Enter spam, network retry).
// Key: "userId:sessionId" — stored in memory per-process.
// For multi-instance deployments, replace with a Redis SET NX pattern.
const activeStreams = new Set<string>();

function streamKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

// ── Background RAGAS Evaluation ───────────────────────────────────────────────

/**
 * Fires an async RAGAS eval request to the AI service after an answer is saved.
 * Runs completely in the background — never blocks the response to the client.
 * On success, persists the scores to the message's ragasScore DB field.
 */
function triggerEvalInBackground({
  messageId,
  question,
  answer,
  contexts,
  repoId,
}: {
  messageId: string;
  question: string;
  answer: string;
  contexts: string[];
  repoId: string;
}) {
  // Intentionally not awaited — fire and forget
  (async () => {
    try {
      const evalRes = await aiClient.post("/api/v1/eval/score", {
        question,
        answer,
        contexts,
        repo_id: repoId,
        message_id: messageId,
      }, { timeout: 60_000 });

      const scores = evalRes.data as {
        faithfulness: number;
        answer_relevancy: number;
        context_precision: number;
        overall: string;
      };

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
    } catch {
      // Eval failures are non-critical — silently ignored.
    }
  })();
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  repoId:    z.string().min(1),
  question:  z.string().min(1).max(2000),
  sessionId: z.string().min(1),
  topK:      z.number().int().min(1).max(20).optional().default(5),
});

async function loadRecentHistory(sessionId: string) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      role: true,
      content: true,
    },
  });

  return messages
    .reverse()
    .map((message): { role: "user" | "assistant"; content: string } => ({
      role: message.role === "ASSISTANT" ? "assistant" : "user",
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);
}

/**
 * touchSession — atomically update session metadata.
 *
 * Phase 1 fix (CH-05): Rewrote as a single UPDATE that only sets the title
 * when it is currently NULL, eliminating the non-atomic read-then-write race
 * that could cause two concurrent requests to both overwrite the title.
 */
async function touchSession(sessionId: string, question: string) {
  const title = question.length > 60 ? question.slice(0, 57) + "..." : question;

  // Atomic: only set title when it's NULL (first message in this session).
  // SQLite-compatible raw query — avoids the separate COUNT + conditional UPDATE.
  await prisma.$executeRaw`
    UPDATE "Session"
    SET
      "title"     = CASE WHEN "title" IS NULL THEN ${title} ELSE "title" END,
      "updatedAt" = datetime('now')
    WHERE "id" = ${sessionId}
  `;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/query
 * Non-streaming: send question, get full answer + citations.
 */
chatRoutes.post("/query", requireAuth, rateLimiter, async (req, res) => {
  const parse = QuerySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { repoId, question, sessionId, topK } = parse.data;
  const userId = await ensureUser(req.userId!, req.userEmail);

  // Phase 1: Concurrent request guard (CH-02)
  const key = streamKey(userId, sessionId);
  if (activeStreams.has(key)) {
    res.status(409).json({ error: "A request for this session is already in progress. Please wait." });
    return;
  }
  activeStreams.add(key);

  try {
    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId, repoId },
      select: { id: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const history = await loadRecentHistory(sessionId);

    // Save user message
    await prisma.message.create({
      data: {
        role: "USER",
        content: question,
        sessionId,
      },
    });
    await touchSession(sessionId, question);

    // Forward to AI service
    const aiResponse = await queryAI({
      repo_id: repoId,
      question,
      session_id: sessionId,
      history,
      top_k: topK,
    });

    // Save assistant message with citations
    const normalizedCitations = normalizeCitations(aiResponse.citations);
    const savedMsg = await prisma.message.create({
      data: {
        role: "ASSISTANT",
        content: aiResponse.answer,
        citations: JSON.stringify(normalizedCitations),
        sessionId,
      },
    });

    // Trigger background RAGAS evaluation (non-blocking)
    triggerEvalInBackground({
      messageId: savedMsg.id,
      question,
      answer: aiResponse.answer,
      contexts: normalizedCitations.map((c) => c.snippet ?? "").filter(Boolean),
      repoId,
    });

    res.json({
      answer:      aiResponse.answer,
      citations:   normalizedCitations,
      model_used:  aiResponse.model_used,
      session_id:  sessionId,
      message_id:  savedMsg.id,
    });
  } finally {
    // Always release the lock so the user can send another message.
    activeStreams.delete(key);
  }
});

/**
 * POST /api/chat/stream
 * Streaming SSE: pipes AI token stream to the client.
 * On completion, saves message pair to DB.
 *
 * Phase 1 fixes applied:
 *  - activeStreams guard prevents duplicate concurrent requests (CH-01)
 *  - finishStream uses a Promise mutex so concurrent data events can't double-save (CH-03)
 *  - Error events from AI service terminate the stream rather than continuing (CH-06)
 *  - clientGone flag prevents writing to a closed socket (CH-04)
 */
chatRoutes.post("/stream", requireAuth, rateLimiter, async (req, res) => {
  const parse = QuerySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { repoId, question, sessionId, topK } = parse.data;
  const userId = await ensureUser(req.userId!, req.userEmail);

  // Phase 1: Concurrent request guard (CH-01)
  const key = streamKey(userId, sessionId);
  if (activeStreams.has(key)) {
    res.status(409).json({ error: "A stream for this session is already in progress. Please wait." });
    return;
  }
  activeStreams.add(key);

  try {
    // Verify session
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId, repoId },
      select: { id: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const history = await loadRecentHistory(sessionId);

    // Save user message before streaming starts
    await prisma.message.create({
      data: { role: "USER", content: question, sessionId },
    });
    await touchSession(sessionId, question);

    // Stream setup — flush headers immediately so client starts receiving
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Phase 1 (CH-04): Track if client disconnected before we finish.
    // This prevents writing to a closed socket after a DB save.
    let clientGone = false;
    res.on("close", () => { clientGone = true; });

    const safeWrite = (data: string) => {
      if (!clientGone) res.write(data);
    };

    try {
      const aiResponse = await aiClient.post("/api/v1/query/stream", {
        repo_id: repoId,
        question,
        session_id: sessionId,
        history,
        top_k: topK,
      }, {
        responseType: "stream",
        timeout: 180_000,
      });

      const stream = aiResponse.data as IncomingMessage;
      let buffer = "";
      let fullAnswer = "";

      // Phase 1 (CH-03): Promise-based mutex for finishStream.
      // Because stream.on('data') is an async callback and Node.js EventEmitter
      // does not await async listeners, two rapid data events could both enter
      // finishStream before the first await returns. A Promise lock ensures
      // only the first caller does the DB write.
      let finishPromise: Promise<void> | null = null;

      const finishStream = (rawCitations: unknown): Promise<void> => {
        if (finishPromise) return finishPromise; // idempotent
        finishPromise = (async () => {
          const citations = normalizeCitations(rawCitations);
          const savedAssistant = await prisma.message.create({
            data: {
              role: "ASSISTANT",
              content: fullAnswer,
              citations: JSON.stringify(citations),
              sessionId,
            },
          });

          safeWrite(`data: ${JSON.stringify({
            done: true,
            citations,
            session_id: sessionId,
            message_id: savedAssistant.id,
          })}\n\n`);

          // Trigger background RAGAS evaluation (non-blocking)
          triggerEvalInBackground({
            messageId: savedAssistant.id,
            question,
            answer: fullAnswer,
            contexts: citations.map((c) => c.snippet ?? "").filter(Boolean),
            repoId,
          });
        })();
        return finishPromise;
      };

      stream.on("data", async (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          // Phase 1 (ST-05 equivalent): Separate JSON parse errors from
          // intentional error events so both paths reach the right handler.
          let event: { token?: string; done?: boolean; citations?: unknown; error?: string };
          try {
            event = JSON.parse(payload);
          } catch {
            continue; // Ignore non-JSON keepalive lines only
          }

          if (event.token) {
            fullAnswer += event.token;
            safeWrite(`data: ${JSON.stringify({ token: event.token })}\n\n`);
            continue;
          }

          if (event.error) {
            // Phase 1 (CH-06): Error from AI service — tell client and stop.
            // Do NOT continue the loop; let the stream end naturally.
            safeWrite(`data: ${JSON.stringify({ error: event.error })}\n\n`);
            stream.destroy();
            break;
          }

          if (event.done) {
            await finishStream(event.citations);
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on("end", async () => {
          if (!finishPromise) {
            try {
              await finishStream([]);
            } catch (err) {
              reject(err);
              return;
            }
          } else {
            // Wait for any in-progress finishStream to complete
            await finishPromise.catch(() => {});
          }
          resolve();
        });
        stream.on("error", reject);
        stream.on("aborted", () => reject(new Error("Stream aborted by AI service")));
        res.on("close", () => {
          stream.destroy();
          // Phase 1 Fix: Actually reject the promise when the client disconnects
          // (e.g. strict mode unmount) so the catch block runs and the finally block
          // releases the activeStreams lock immediately.
          reject(new Error("Client disconnected"));
        });
      });
    } catch {
      safeWrite(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    }

    res.end();
  } finally {
    // Always release the lock, whether we succeeded or threw.
    activeStreams.delete(key);
  }
});

