/**
 * RepoTalk Frontend — Typed API Client
 * All calls go to the Node.js Gateway. Never calls ai_service directly.
 * Clerk token is attached per request via the provided getToken function.
 */

import type {
  Repo,
  Session,
  Message,
  ChatQueryResponse,
  CreateRepoResponse,
  CreateSessionResponse,
  IngestStatus,
} from "./types";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000";

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${GATEWAY}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch { /* non-json error body */ }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

// ── Repo APIs ─────────────────────────────────────────────────────────────────

export function createApiClient(getToken: () => Promise<string | null>) {
  return {
    // ── Repos ────────────────────────────────────────────────────────────────

    repos: {
      list: () =>
        apiFetch<Repo[]>("/api/repos", getToken),

      get: (repoId: string) =>
        apiFetch<Repo>(`/api/repos/${repoId}`, getToken),

      create: (githubUrl: string, languages: string[]) =>
        apiFetch<CreateRepoResponse>("/api/repos", getToken, {
          method: "POST",
          body: JSON.stringify({ githubUrl, languages }),
        }),

      getStatus: (repoId: string) =>
        apiFetch<IngestStatus>(`/api/repos/${repoId}/status`, getToken),

      delete: (repoId: string) =>
        apiFetch<{ deleted: boolean }>(`/api/repos/${repoId}`, getToken, {
          method: "DELETE",
        }),
    },

    // ── Sessions ─────────────────────────────────────────────────────────────

    sessions: {
      list: (repoId: string) =>
        apiFetch<Session[]>(`/api/sessions?repoId=${repoId}`, getToken),

      get: (sessionId: string) =>
        apiFetch<Session>(`/api/sessions/${sessionId}`, getToken),

      create: (repoId: string, title?: string) =>
        apiFetch<CreateSessionResponse>("/api/sessions", getToken, {
          method: "POST",
          body: JSON.stringify({ repoId, title }),
        }),

      delete: (sessionId: string) =>
        apiFetch<{ deleted: boolean }>(`/api/sessions/${sessionId}`, getToken, {
          method: "DELETE",
        }),

      saveMessage: (
        sessionId: string,
        role: "USER" | "ASSISTANT",
        content: string,
        citations?: unknown[]
      ) =>
        apiFetch<Message>(`/api/sessions/${sessionId}/messages`, getToken, {
          method: "POST",
          body: JSON.stringify({ role, content, citations }),
        }),

      toggleBookmark: (sessionId: string, messageId: string) =>
        apiFetch<Message>(
          `/api/sessions/${sessionId}/messages/${messageId}/bookmark`,
          getToken,
          { method: "PATCH" }
        ),

      getBookmarks: () =>
        apiFetch<import("./types").BookmarkedMessage[]>("/api/sessions/bookmarks", getToken),
    },

    // ── Chat ─────────────────────────────────────────────────────────────────

    chat: {
      query: (
        repoId: string,
        question: string,
        sessionId: string,
        topK = 5
      ) =>
        apiFetch<ChatQueryResponse>("/api/chat/query", getToken, {
          method: "POST",
          body: JSON.stringify({ repoId, question, sessionId, topK }),
        }),

      /**
       * streamQuery — returns a ReadableStream of the raw fetch body.
       * The caller is responsible for reading SSE events line-by-line.
       */
      streamQuery: async (
        repoId: string,
        question: string,
        sessionId: string,
        topK = 5
      ): Promise<ReadableStream<Uint8Array>> => {
        const token = await getToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${GATEWAY}/api/chat/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({ repoId, question, sessionId, topK }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Stream failed: HTTP ${res.status}`);
        }

        return res.body;
      },
    },

    // ── Billing ──────────────────────────────────────────────────────────────

    billing: {
      status: () =>
        apiFetch<import("./types").BillingStatus>("/api/stripe/status", getToken),
        
      portal: () =>
        apiFetch<{ url: string }>("/api/stripe/portal", getToken, { method: "POST" }),
        
      checkout: (planId: string) =>
        apiFetch<{ url: string }>("/api/stripe/checkout", getToken, {
          method: "POST",
          body: JSON.stringify({ planId }),
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
