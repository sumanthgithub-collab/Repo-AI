"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Citation } from "@/lib/types";

interface StreamingTextProps {
  repoId: string;
  sessionId: string;
  question: string;
  getToken: () => Promise<string | null>;
  onDone: (result: { answer: string; citations: Citation[]; messageId?: string }) => void;
  onError?: (err: string) => void;
  // External abort signal — parent sets this to cancel mid-stream (session switch/unmount)
  abortSignal?: AbortSignal;
}

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000";

function normalizeCitation(citation: unknown): Citation {
  const raw = (citation ?? {}) as {
    file?: string;
    startLine?: number;
    endLine?: number;
    start_line?: number;
    end_line?: number;
    snippet?: string;
  };

  const start = raw.startLine ?? raw.start_line ?? 1;
  const end = raw.endLine ?? raw.end_line ?? start;

  return {
    file: raw.file ?? "unknown",
    startLine: Number.isFinite(start) ? Number(start) : 1,
    endLine: Number.isFinite(end) ? Number(end) : Number.isFinite(start) ? Number(start) : 1,
    snippet: raw.snippet ?? "",
  };
}

/**
 * StreamingText — opens a POST fetch SSE stream to the gateway.
 *
 * Key stability fixes (Phase 1):
 *  1. onDone / onError stored in refs — never trigger useEffect re-runs.
 *  2. mounted ref — prevents setState after unmount (avoids React Strict Mode double-fire).
 *  3. Accepts an external abortSignal from ChatPanel so the parent can cancel
 *     the stream on session switch or navigation away.
 */
export default function StreamingText({
  repoId,
  sessionId,
  question,
  getToken,
  onDone,
  onError,
  abortSignal,
}: StreamingTextProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(true);

  // ── Stable refs for callbacks — never listed as useCallback/useEffect deps ──
  // This is the core fix: callback props change identity every render (new
  // function ref), which would cause the useCallback to recreate stream() and
  // the useEffect to re-fire, opening a second SSE connection. Storing them in
  // refs gives us a stable reference while still calling the latest version.
  const onDoneRef  = useRef(onDone);
  const onErrorRef = useRef(onError);
  useEffect(() => { onDoneRef.current  = onDone;  }, [onDone]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Tracks whether this component instance is still mounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Internal abort controller — merged with the parent's signal if provided.
  const internalAbortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async () => {
    // Create a fresh internal controller for this run.
    const controller = new AbortController();
    internalAbortRef.current = controller;

    // Merge parent's abort signal: if parent aborts, abort ours too.
    if (abortSignal) {
      if (abortSignal.aborted) {
        controller.abort();
      } else {
        abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const token = await getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      let res: Response | null = null;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        res = await fetch(`${GATEWAY}/api/chat/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({ repoId, sessionId, question, topK: 5 }),
          signal: controller.signal,
        });

        // Phase 1 Fix: In React 18 Strict Mode, components mount, unmount (aborting fetch),
        // and remount immediately. If the server takes a few ms to process the abort and release
        // the activeStreams lock, the second mount's fetch hits a 409 Conflict.
        // We catch 409s here and retry with exponential backoff to smooth over this race condition.
        if (res.status === 409 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 300 * attempt));
          continue;
        }
        break;
      }

      if (!res || !res.ok || !res.body) {
        throw new Error(`Stream error: HTTP ${res?.status || "Unknown"}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let finalCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if ("token" in event) {
              fullAnswer += event.token;
              // Guard: don't update state after unmount
              if (mountedRef.current) {
                setText((prev) => prev + event.token);
              }
            } else if (event.done) {
              finalCitations = Array.isArray(event.citations)
                ? event.citations.map(normalizeCitation)
                : [];
              if (mountedRef.current) {
                setStreaming(false);
              }
              // Call the latest version of onDone via ref — always safe
              onDoneRef.current({
                answer: fullAnswer,
                citations: finalCitations,
                messageId: typeof event.message_id === "string" ? event.message_id : undefined,
              });
            } else if (event.error) {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            // Ignore non-JSON keepalive lines
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // Clean abort — no error shown; parent is handling state reset
        if (mountedRef.current) setStreaming(false);
        return;
      }
      if (mountedRef.current) setStreaming(false);
      const msg = err instanceof Error ? err.message : "Stream failed";
      onErrorRef.current?.(msg);
    }
  // ⚠️  Only stable, primitive values here — NOT onDone/onError.
  // Those are read via refs inside the function so they don't trigger re-runs.
  }, [repoId, sessionId, question, getToken, abortSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stream();
    // Cleanup: abort the internal controller on unmount or if deps change
    return () => {
      internalAbortRef.current?.abort();
    };
  }, [stream]);

  return (
    <span className="whitespace-pre-wrap break-words leading-relaxed" style={{ color: "var(--text)" }}>
      {text || <span style={{ color: "var(--text-faint)" }}>Thinking through your repository context...</span>}
      {streaming && (
        <span
          className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom blink-cursor"
          style={{ background: "var(--accent)" }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
