/**
 * RepoTalk — Shared TypeScript Types
 * Single source of truth for all data shapes flowing between frontend and gateway.
 */

// ── Repo ──────────────────────────────────────────────────────────────────────

export type RepoStatus = "PENDING" | "INGESTING" | "READY" | "ERROR";

export interface Repo {
  id: string;
  githubUrl: string;
  name: string;
  languages: string[];
  framework: string | null;
  status: RepoStatus;
  chunkCount: number;
  errorMsg: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number };
}

// ── Ingestion Status (from AI service, proxied through gateway) ───────────────

export interface IngestStatus {
  repo_id: string;
  status: "pending" | "cloning" | "parsing" | "embedding" | "done" | "error";
  current_stage: string;
  total_chunks: number;
  embedded_chunks: number;
  progress_pct: number;
  error?: string;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string | null;
  repoId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  _count?: { messages: number };
}

// ── Message ───────────────────────────────────────────────────────────────────

export type MessageRole = "USER" | "ASSISTANT";

export interface Citation {
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface RagasScore {
  faithfulness?: number;
  answerRelevancy?: number;
  contextPrecision?: number;
  overall?: "high" | "medium" | "low" | string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  citations: Citation[] | null;
  ragasScore: RagasScore | null;
  bookmarked: boolean;
  sessionId: string;
  createdAt: string;
}

// ── API Response shapes ────────────────────────────────────────────────────────

export interface ChatQueryResponse {
  answer: string;
  citations: Citation[];
  model_used: string;
  session_id?: string;
  message_id?: string;
}

export interface CreateSessionResponse {
  id: string;
  repoId: string;
  title: string | null;
  createdAt: string;
}

export interface CreateRepoResponse {
  repoId: string;
  status: string;
  message: string;
}

export interface BillingStatus {
  plan: string;
  subscription?: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
}

export interface BookmarkedMessage extends Message {
  session: {
    id: string;
    title: string | null;
    repo: {
      id: string;
      name: string;
    };
  };
}

export interface SuggestedQuestion {
  id: string;
  label?: string;
  question: string;
  category: string;
}

export interface RepoPersona {
  repo_name: string;
  repo_type: string;
  expertise_level: string;
  dominant_language: string;
  architecture_style: string;
  total_files?: number;
  total_chunks?: number;
  frameworks?: string[];
  stack?: string[];
  architecture_overview?: string;
  key_entry_points?: string[];
  suggested_questions: SuggestedQuestion[];
  onboarding_guide?: string;
  file_tree?: string;
}
