/**
 * Gateway: AI Service Proxy
 * Typed helper for all HTTP communication with the FastAPI AI service.
 */

import axios from "axios";
import { IncomingMessage } from "http";
import { Response as ExpressResponse } from "express";

const AI_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";

export const aiClient = axios.create({
  baseURL: AI_URL,
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AiIngestRequest {
  repo_url: string;
  repo_id: string;
  user_id: string;
  languages: string[];
}

export interface AiIngestStatus {
  repo_id: string;
  status: string;
  current_stage: string;
  total_chunks: number;
  embedded_chunks: number;
  progress_pct: number;
  error?: string;
}

export interface AiQueryRequest {
  repo_id: string;
  question: string;
  session_id: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  top_k: number;
}

export interface AiQueryResponse {
  answer: string;
  citations: Array<{
    file: string;
    start_line: number;
    end_line: number;
    snippet: string;
  }>;
  model_used: string;
}

export interface GatewayCitation {
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

type UnknownCitation = Partial<GatewayCitation> & {
  start_line?: number;
  end_line?: number;
};

export function normalizeCitation(citation: UnknownCitation): GatewayCitation {
  const start = citation.startLine ?? citation.start_line ?? 1;
  const end = citation.endLine ?? citation.end_line ?? start;

  return {
    file: citation.file ?? "unknown",
    startLine: Number.isFinite(start) ? Number(start) : 1,
    endLine: Number.isFinite(end) ? Number(end) : Number.isFinite(start) ? Number(start) : 1,
    snippet: citation.snippet ?? "",
  };
}

export function normalizeCitations(citations: unknown): GatewayCitation[] {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => normalizeCitation((citation ?? {}) as UnknownCitation));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * triggerIngestion — fire-and-forget POST to AI service.
 * Does not await pipeline completion.
 */
export async function triggerIngestion(payload: AiIngestRequest): Promise<void> {
  await aiClient.post("/api/v1/ingest/", payload);
}

/**
 * getIngestStatus — poll current ingestion status for a repo.
 */
export async function getIngestStatus(repoId: string): Promise<AiIngestStatus> {
  const res = await aiClient.get<AiIngestStatus>(
    `/api/v1/ingest/${repoId}/status`
  );
  return res.data;
}

/**
 * deleteRepoVectors — delete all Qdrant vectors for a repo.
 */
export async function deleteRepoVectors(
  repoId: string,
  userId: string
): Promise<void> {
  await aiClient.delete(
    `/api/v1/ingest/${repoId}?user_id=${encodeURIComponent(userId)}`
  );
}

/**
 * queryAI — non-streaming query.
 */
export async function queryAI(
  payload: AiQueryRequest
): Promise<AiQueryResponse> {
  const res = await aiClient.post<AiQueryResponse>("/api/v1/query/", payload);
  return res.data;
}

/**
 * pipeStreamToResponse — starts a streaming request to the AI service and
 * pipes the SSE response directly to the Express response stream.
 *
 * The AI service emits:
 *   data: {"token": "..."}
 *   data: {"done": true, "citations": [...]}
 */
export async function pipeStreamToResponse(
  payload: AiQueryRequest,
  res: ExpressResponse
): Promise<void> {
  const aiResponse = await aiClient.post("/api/v1/query/stream", payload, {
    responseType: "stream",
    timeout: 180_000,
  });

  const stream = aiResponse.data as IncomingMessage;

  // Forward SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Pipe AI stream to client
  stream.pipe(res, { end: false });

  await new Promise<void>((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
    res.on("close", () => stream.destroy());
  });

  res.end();
}
