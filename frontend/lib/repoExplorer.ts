/**
 * Repo workspace explorer — client state for file tree, symbols, and code viewer.
 * Backend wiring can replace mock symbol loading without changing consumers.
 */

import type { Citation } from "@/lib/types";

// ── Symbols ───────────────────────────────────────────────────────────────────

export type SymbolsLoadState = "idle" | "loading" | "ready" | "empty" | "error";

export interface RepoSymbol {
  name: string;
  kind: string;
  filePath: string;
  line: number;
}

/** Mock / dev override via NEXT_PUBLIC_REPO_EXPLORER_SYMBOLS_MOCK */
export type SymbolsMockMode =
  | "live"
  | "loading"
  | "empty"
  | "error"
  | "ready";

export function parseSymbolsMockMode(
  raw: string | undefined
): SymbolsMockMode {
  if (
    raw === "loading" ||
    raw === "empty" ||
    raw === "error" ||
    raw === "ready"
  ) {
    return raw;
  }
  return "live";
}

export const MOCK_SYMBOLS: RepoSymbol[] = [
  { name: "ChatPage", kind: "component", filePath: "app/chat/[repoId]/page.tsx", line: 22 },
  { name: "createApiClient", kind: "function", filePath: "lib/api.ts", line: 12 },
  { name: "Session", kind: "interface", filePath: "lib/types.ts", line: 38 },
  { name: "handleSubmit", kind: "method", filePath: "components/ChatPanel.tsx", line: 172 },
];

// ── Mock file tree (replace with API-driven tree later) ─────────────────────

export interface MockTreeNode {
  name: string;
  path: string;
  children?: MockTreeNode[];
}

export const MOCK_FILE_TREE: MockTreeNode[] = [
  {
    name: "app",
    path: "app",
    children: [
      { name: "layout.tsx", path: "app/layout.tsx" },
      { name: "page.tsx", path: "app/page.tsx" },
      {
        name: "chat",
        path: "app/chat",
        children: [
          { name: "[repoId]", path: "app/chat/[repoId]", children: [{ name: "page.tsx", path: "app/chat/[repoId]/page.tsx" }] },
        ],
      },
    ],
  },
  {
    name: "components",
    path: "components",
    children: [
      { name: "ChatPanel.tsx", path: "components/ChatPanel.tsx" },
      { name: "CitationChip.tsx", path: "components/CitationChip.tsx" },
      { name: "Navbar.tsx", path: "components/Navbar.tsx" },
    ],
  },
  {
    name: "lib",
    path: "lib",
    children: [
      { name: "api.ts", path: "lib/api.ts" },
      { name: "types.ts", path: "lib/types.ts" },
    ],
  },
];

// ── Reducer state ───────────────────────────────────────────────────────────

export type ExplorerTab = "files" | "symbols" | "code";

export type CodeDisplayMode = "none" | "citation" | "file";

export interface RepoExplorerState {
  symbolsLoadState: SymbolsLoadState;
  symbols: RepoSymbol[];
  symbolsError: string | null;
  selectedFilePath: string | null;
  highlightedRange: { startLine: number; endLine: number } | null;
  codeDisplayMode: CodeDisplayMode;
  citationSnippet: string | null;
  /** First source line for the first rendered row (citation view) */
  citationAnchorLine: number | null;
  activeTab: ExplorerTab;
  contextSheetOpen: boolean;
}

export const initialRepoExplorerState = (): RepoExplorerState => ({
  symbolsLoadState: "idle",
  symbols: [],
  symbolsError: null,
  selectedFilePath: null,
  highlightedRange: null,
  codeDisplayMode: "none",
  citationSnippet: null,
  citationAnchorLine: null,
  activeTab: "files",
  contextSheetOpen: false,
});

export type RepoExplorerAction =
  | { type: "OPEN_CITATION"; citation: Citation }
  | { type: "SELECT_FILE"; path: string }
  | { type: "SELECT_SYMBOL"; symbol: RepoSymbol }
  | { type: "SET_TAB"; tab: ExplorerTab }
  | { type: "SET_SHEET_OPEN"; open: boolean }
  | {
      type: "SET_SYMBOLS_STATE";
      loadState: SymbolsLoadState;
      symbols?: RepoSymbol[];
      error?: string | null;
    }
  | { type: "CLEAR_CODE_VIEW" };

export function repoExplorerReducer(
  state: RepoExplorerState,
  action: RepoExplorerAction
): RepoExplorerState {
  switch (action.type) {
    case "OPEN_CITATION": {
      const { citation } = action;
      return {
        ...state,
        selectedFilePath: citation.file,
        highlightedRange: {
          startLine: citation.startLine,
          endLine: citation.endLine,
        },
        codeDisplayMode: "citation",
        citationSnippet: citation.snippet,
        citationAnchorLine: citation.startLine,
        activeTab: "code",
      };
    }
    case "SELECT_FILE":
      return {
        ...state,
        selectedFilePath: action.path,
        highlightedRange: null,
        codeDisplayMode: "file",
        citationSnippet: null,
        citationAnchorLine: null,
        activeTab: "code",
      };
    case "SELECT_SYMBOL":
      return {
        ...state,
        selectedFilePath: action.symbol.filePath,
        highlightedRange: {
          startLine: action.symbol.line,
          endLine: action.symbol.line,
        },
        codeDisplayMode: "file",
        citationSnippet: null,
        citationAnchorLine: null,
        activeTab: "code",
      };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_SHEET_OPEN":
      return { ...state, contextSheetOpen: action.open };
    case "SET_SYMBOLS_STATE":
      return {
        ...state,
        symbolsLoadState: action.loadState,
        symbols: action.symbols ?? state.symbols,
        symbolsError:
          action.error === undefined ? state.symbolsError : action.error,
      };
    case "CLEAR_CODE_VIEW":
      return {
        ...state,
        codeDisplayMode: "none",
        citationSnippet: null,
        citationAnchorLine: null,
        highlightedRange: null,
      };
  }
}
