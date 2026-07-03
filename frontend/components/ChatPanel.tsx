"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { Send, Loader2, BookmarkCheck, Bookmark, AlertTriangle } from "lucide-react";
import { createApiClient } from "@/lib/api";
import StreamingText from "./StreamingText";
import CitationChip from "./CitationChip";
import type { Message, Citation, Session } from "@/lib/types";

// ── Single message bubble ─────────────────────────────────────────────────────

function MessageBubble({
  message,
  onToggleBookmark,
}: {
  message: Message;
  onToggleBookmark: (id: string) => void;
}) {
  const isUser = message.role === "USER";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6 slide-up`}
    >
      <div
        className="max-w-[85%] space-y-2"
        style={{ minWidth: 0 }}
      >
        {/* Role label */}
        <div
          className={`text-[11px] font-medium uppercase tracking-wider ${isUser ? "text-right" : "text-left"}`}
          style={{ color: "var(--text-faint)" }}
        >
          {isUser ? "You" : "RepoTalk"}
        </div>

        {/* Content bubble */}
        <div
          className="px-4 py-3 rounded-xl text-sm leading-relaxed"
          style={{
            background: isUser ? "linear-gradient(180deg,#2f6ff1 0%,#2457ca 100%)" : "var(--surface-2)",
            color: isUser ? "#fff" : "var(--text)",
            border: isUser ? "none" : "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="whitespace-pre-wrap break-words m-0" style={{ color: isUser ? "#fff" : "var(--text)" }}>
            {message.content}
          </p>
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.citations.map((c, i) => (
              <CitationChip key={i} citation={c} index={i} />
            ))}
          </div>
        )}

        {/* Actions row: Eval Score + Bookmark */}
        {!isUser && (
          <div className="flex justify-between items-center pt-2 mt-2" style={{ borderTop: "1px dashed var(--border)" }}>
            {/* RAGAS Eval Score */}
            {message.ragasScore ? (
              <div
                className="text-[11px] font-medium px-2 py-0.5 rounded-full flex gap-1.5 items-center cursor-help"
                style={{
                  background: message.ragasScore.overall === "high" ? "var(--success-muted)" : message.ragasScore.overall === "medium" ? "var(--warning-muted)" : "var(--error-muted)",
                  color: message.ragasScore.overall === "high" ? "var(--success)" : message.ragasScore.overall === "medium" ? "var(--warning)" : "var(--error)",
                  border: `1px solid ${message.ragasScore.overall === "high" ? "var(--success)" : message.ragasScore.overall === "medium" ? "var(--warning)" : "var(--error)"}40`
                }}
                title={`Faithfulness: ${message.ragasScore.faithfulness}\nRelevancy: ${message.ragasScore.answerRelevancy}\nContext Precision: ${message.ragasScore.contextPrecision}`}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                Eval: {message.ragasScore.overall?.toUpperCase()}
              </div>
            ) : (
              <div className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: "var(--text-faint)", background: "var(--surface-3)" }}>
                Evaluating...
              </div>
            )}

            <button
              onClick={() => onToggleBookmark(message.id)}
              className="btn btn-ghost btn-sm"
              aria-label={message.bookmarked ? "Remove bookmark" : "Bookmark this answer"}
              title={message.bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              {message.bookmarked ? (
                <BookmarkCheck size={14} style={{ color: "var(--accent)" }} />
              ) : (
                <Bookmark size={14} style={{ color: "var(--text-muted)" }} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Streaming message bubble ──────────────────────────────────────────────────

function StreamingBubble({
  repoId,
  sessionId,
  question,
  getToken,
  onDone,
  onError,
  abortSignal,
}: {
  repoId: string;
  sessionId: string;
  question: string;
  getToken: () => Promise<string | null>;
  onDone: (result: { answer: string; citations: Citation[]; messageId?: string }) => void;
  onError: (err: string) => void;
  abortSignal: AbortSignal;
}) {
  const [streamError, setStreamError] = useState<string | null>(null);

  // Always propagate the error to the parent so it can reset streaming=false,
  // otherwise the textarea stays permanently disabled.
  const handleError = (err: string) => {
    setStreamError(err);
    onError(err);
  };

  return (
    <div className="flex justify-start mb-6 slide-up">
      <div className="max-w-[85%] space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          RepoTalk
        </div>
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {streamError ? (
            <div className="flex items-center gap-2" style={{ color: "var(--error)" }}>
              <AlertTriangle size={14} />
              {streamError}
            </div>
          ) : (
            <StreamingText
              repoId={repoId}
              sessionId={sessionId}
              question={question}
              getToken={getToken}
              onDone={onDone}
              onError={handleError}
              abortSignal={abortSignal}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export interface ChatPanelProps {
  repoId: string;
  session: Session;
  lowChunkWarning?: boolean;
  onSessionUpdate?: () => void;
}

export default function ChatPanel({
  repoId,
  session,
  lowChunkWarning = false,
  onSessionUpdate,
}: ChatPanelProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>(session.messages ?? []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingQuestion, setStreamingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Stable API client — created once, never on every render ──────────────────
  const api = useMemo(() => createApiClient(getToken), [getToken]);

  // ── Phase 1: Synchronous submit guard ────────────────────────────────────────
  // useRef gives us a synchronous, render-independent flag. We set it to true
  // before any await, so rapid Enter presses / double-clicks see it immediately
  // and bail out — no waiting for React to re-render with streaming=true.
  const isSubmittingRef = useRef(false);

  // ── Phase 1: Unique stream key per submit ────────────────────────────────────
  // Using a counter instead of question text prevents React from reusing the
  // StreamingBubble when the same question is sent twice in a row.
  const streamKeyRef = useRef(0);
  const [streamKey, setStreamKey] = useState(0);

  // ── Phase 1: AbortController for in-flight stream ───────────────────────────
  // Stored in a ref so it can be accessed synchronously from effects.
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Phase 1: Track which session this panel is currently showing ─────────────
  // Prevents onDone from a stale stream from appending to the wrong session.
  const activeSessionIdRef = useRef(session.id);
  useEffect(() => {
    activeSessionIdRef.current = session.id;
  }, [session.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Phase 1: Abort + reset on session switch ─────────────────────────────────
  // When the user clicks a different session mid-stream, kill the old stream
  // immediately and reset all streaming state so the new session starts clean.
  useEffect(() => {
    // This effect runs when session.id changes (i.e. user switches sessions).
    // Abort any in-flight stream from the previous session.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Reset streaming state so the textarea re-enables for the new session.
    isSubmittingRef.current = false;
    setStreaming(false);
    setStreamingQuestion(null);
    setError(null);

    // Sync messages to the new session
    setMessages(session.messages ?? []);
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: session.messages is intentionally excluded — we only want this heavy
  // reset on session ID changes. Incremental message updates come from handleStreamDone.

  // ── Phase 1: Abort on component unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      isSubmittingRef.current = false;
    };
  }, []);

  // ── Phase 1: Poll for RAGAS evaluation scores ───────────────────────────────
  // Since evaluation runs in the background and completes after the stream ends,
  // we poll the session API lightly if any displayed assistant message is missing its score.
  useEffect(() => {
    const needsPolling = messages.some((m) => m.role === "ASSISTANT" && !m.ragasScore && !m.id.startsWith("optimistic"));
    if (!needsPolling) return;

    let isPolling = true;

    const poll = async () => {
      if (!isPolling) return;
      try {
        const updatedSession = await api.sessions.get(session.id);
        if (!isPolling) return;
        
        // Only update if we actually got new scores to avoid unnecessary re-renders
        const newScoreCount = updatedSession.messages?.filter(m => m.role === "ASSISTANT" && m.ragasScore).length ?? 0;
        const oldScoreCount = messages.filter(m => m.role === "ASSISTANT" && m.ragasScore).length;

        if (newScoreCount > oldScoreCount) {
          setMessages(updatedSession.messages ?? []);
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(poll, 3000);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [messages, session.id, api]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    const question = input.trim();
    if (!question) return;

    // ── SYNCHRONOUS guard — checked before any state update or await ──────────
    // This is the key fix for CP-02 / CP-03: `streaming` state update is async
    // (batched), so rapid Enter presses can pass the state check before React
    // re-renders. The ref is synchronous — it's set and read atomically in the
    // same JS call stack, so only the very first call goes through.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setInput("");
    setError(null);
    setStreaming(true);

    // Bump the stream key — guarantees React re-mounts StreamingBubble even if
    // the same question is submitted twice in a row (fixes CP-07).
    streamKeyRef.current += 1;
    const thisStreamKey = streamKeyRef.current;
    setStreamKey(thisStreamKey);
    setStreamingQuestion(question);

    // Create a fresh AbortController for this stream.
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Capture the session we're submitting for.
    const submittedSessionId = session.id;

    // Optimistic user message
    const optimisticUser: Message = {
      id: `optimistic-${Date.now()}`,
      role: "USER",
      content: question,
      citations: null,
      ragasScore: null,
      bookmarked: false,
      sessionId: submittedSessionId,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
  }, [input, session.id]);

  const handleStreamDone = useCallback(({
    answer,
    citations,
    messageId,
  }: {
    answer: string;
    citations: Citation[];
    messageId?: string;
  }) => {
    // ── Guard: ignore done events from stale streams ──────────────────────────
    // If the user switched sessions while this stream was in-flight, the
    // activeSessionIdRef will have moved on. Drop this result silently.
    if (activeSessionIdRef.current !== session.id) return;

    // Always clear streaming state so the textarea re-enables immediately.
    setStreaming(false);
    setStreamingQuestion(null);
    isSubmittingRef.current = false;

    const assistantMsg: Message = {
      id: messageId ?? `local-${Date.now()}`,
      role: "ASSISTANT",
      content: answer,
      citations,
      ragasScore: null,
      bookmarked: false,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
    };

    // Replace the optimistic user message + add the real assistant message.
    // We keep our local messages intact (don't wait for session refresh) to
    // avoid the optimistic-message-vs-refresh race (CP-05).
    setMessages((prev) => {
      // Strip the optimistic user message — the server version will arrive
      // on the next session refresh via onSessionUpdate.
      const withoutOptimistic = prev.filter((m) => !m.id.startsWith("optimistic-"));
      return [...withoutOptimistic, assistantMsg];
    });

    // Refresh parent session (fire-and-forget) — syncs DB IDs and bookmarks.
    onSessionUpdate?.();
  }, [session.id, onSessionUpdate]);

  // Called when the stream fails — always resets streaming so the textarea
  // re-enables. The error is also shown inside the StreamingBubble.
  const handleStreamError = useCallback((errMsg: string) => {
    setStreaming(false);
    setStreamingQuestion(null);
    isSubmittingRef.current = false;
    setError(errMsg);
  }, []);

  const handleToggleBookmark = async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
      )
    );
    try {
      await api.sessions.toggleBookmark(session.id, messageId);
    } catch { /* revert on fail is acceptable for Phase 2 */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Belt-and-suspenders: explicit streaming guard here in addition to the
      // ref-based guard in handleSubmit (CP-06).
      if (!isSubmittingRef.current) {
        handleSubmit();
      }
    }
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Low chunk warning */}
      {lowChunkWarning && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-sm flex-shrink-0"
          style={{
            background: "var(--warning-muted)",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
            color: "var(--warning)",
          }}
        >
          <AlertTriangle size={14} />
          This repo has a sparse index (&lt;10 chunks). Answers may be incomplete.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
              aria-hidden="true"
            >
              <Send size={22} style={{ color: "var(--accent)" }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Start the conversation
            </h3>
            <p className="text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>
              Ask anything about the codebase. Questions about architecture,
              specific functions, or how features are implemented all work well.
            </p>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
            {/* Streaming in progress */}
            {streaming && streamingQuestion && abortControllerRef.current && (
              <StreamingBubble
                key={`streaming-${streamKey}`}
                repoId={repoId}
                sessionId={session.id}
                question={streamingQuestion}
                getToken={getToken}
                onDone={handleStreamDone}
                onError={handleStreamError}
                abortSignal={abortControllerRef.current.signal}
              />
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        {error && (
          <div
            className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg"
            style={{ background: "var(--error-muted)", color: "var(--error)" }}
          >
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-3"
        >
          <textarea
            ref={inputRef}
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the codebase…"
            disabled={streaming}
            rows={1}
            className="input flex-1 resize-none"
            style={{
              minHeight: "44px",
              maxHeight: "140px",
              lineHeight: "1.5",
              paddingTop: "10px",
              paddingBottom: "10px",
            }}
            aria-label="Chat input"
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="btn btn-primary flex-shrink-0"
            disabled={streaming || !input.trim()}
            aria-label="Send message"
            style={{ height: "44px", padding: "0 16px" }}
          >
            {streaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
