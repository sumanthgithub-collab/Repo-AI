"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { Citation } from "@/lib/types";
import {
  initialRepoExplorerState,
  MOCK_SYMBOLS,
  parseSymbolsMockMode,
  repoExplorerReducer,
  type RepoExplorerState,
  type SymbolsMockMode,
} from "@/lib/repoExplorer";

const XL_BREAKPOINT = 1280;

function shouldAutoOpenSheet(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < XL_BREAKPOINT;
}

interface RepoWorkspaceContextValue {
  explorer: RepoExplorerState;
  symbolsMockMode: SymbolsMockMode;
  openCitation: (citation: Citation) => void;
  selectFilePath: (path: string) => void;
  selectSymbol: (symbol: import("@/lib/repoExplorer").RepoSymbol) => void;
  setActiveTab: (tab: RepoExplorerState["activeTab"]) => void;
  setContextSheetOpen: (open: boolean) => void;
  clearCodeView: () => void;
}

const RepoWorkspaceContext = createContext<RepoWorkspaceContextValue | null>(
  null
);

export function RepoWorkspaceProvider({
  children,
  symbolsMockMode: symbolsMockModeProp,
}: {
  children: ReactNode;
  /** When omitted, reads NEXT_PUBLIC_REPO_EXPLORER_SYMBOLS_MOCK */
  symbolsMockMode?: SymbolsMockMode;
}) {
  const symbolsMockMode =
    symbolsMockModeProp ??
    parseSymbolsMockMode(process.env.NEXT_PUBLIC_REPO_EXPLORER_SYMBOLS_MOCK);

  const [explorer, dispatch] = useReducer(
    repoExplorerReducer,
    undefined,
    initialRepoExplorerState
  );

  const mockStarted = useRef(false);

  useEffect(() => {
    mockStarted.current = false;
  }, [symbolsMockMode]);

  useEffect(() => {
    if (mockStarted.current) return;
    mockStarted.current = true;

    const run = async () => {
      switch (symbolsMockMode) {
        case "live": {
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "loading",
            symbols: [],
            error: null,
          });
          await new Promise((r) => setTimeout(r, 280));
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "empty",
            symbols: [],
            error: null,
          });
          break;
        }
        case "loading": {
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "loading",
            symbols: [],
            error: null,
          });
          break;
        }
        case "empty": {
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "loading",
            symbols: [],
            error: null,
          });
          await new Promise((r) => setTimeout(r, 500));
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "empty",
            symbols: [],
            error: null,
          });
          break;
        }
        case "error": {
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "loading",
            symbols: [],
            error: null,
          });
          await new Promise((r) => setTimeout(r, 450));
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "error",
            symbols: [],
            error: "Symbol index is not available for this repository yet.",
          });
          break;
        }
        case "ready": {
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "loading",
            symbols: [],
            error: null,
          });
          await new Promise((r) => setTimeout(r, 400));
          dispatch({
            type: "SET_SYMBOLS_STATE",
            loadState: "ready",
            symbols: MOCK_SYMBOLS,
            error: null,
          });
          break;
        }
        default: {
          const _exhaustive: never = symbolsMockMode;
          return _exhaustive;
        }
      }
    };

    void run();
  }, [symbolsMockMode]);

  const openCitation = useCallback((citation: Citation) => {
    dispatch({ type: "OPEN_CITATION", citation });
    if (shouldAutoOpenSheet()) {
      dispatch({ type: "SET_SHEET_OPEN", open: true });
    }
  }, []);

  const selectFilePath = useCallback((path: string) => {
    dispatch({ type: "SELECT_FILE", path });
    if (shouldAutoOpenSheet()) {
      dispatch({ type: "SET_SHEET_OPEN", open: true });
    }
  }, []);

  const selectSymbol = useCallback(
    (symbol: import("@/lib/repoExplorer").RepoSymbol) => {
      dispatch({ type: "SELECT_SYMBOL", symbol });
      if (shouldAutoOpenSheet()) {
        dispatch({ type: "SET_SHEET_OPEN", open: true });
      }
    },
    []
  );

  const setActiveTab = useCallback((tab: RepoExplorerState["activeTab"]) => {
    dispatch({ type: "SET_TAB", tab });
  }, []);

  const setContextSheetOpen = useCallback((open: boolean) => {
    dispatch({ type: "SET_SHEET_OPEN", open });
  }, []);

  const clearCodeView = useCallback(() => {
    dispatch({ type: "CLEAR_CODE_VIEW" });
  }, []);

  const value = useMemo(
    () => ({
      explorer,
      symbolsMockMode,
      openCitation,
      selectFilePath,
      selectSymbol,
      setActiveTab,
      setContextSheetOpen,
      clearCodeView,
    }),
    [
      explorer,
      symbolsMockMode,
      openCitation,
      selectFilePath,
      selectSymbol,
      setActiveTab,
      setContextSheetOpen,
      clearCodeView,
    ]
  );

  return (
    <RepoWorkspaceContext.Provider value={value}>
      {children}
    </RepoWorkspaceContext.Provider>
  );
}

export function useRepoWorkspace(): RepoWorkspaceContextValue {
  const ctx = useContext(RepoWorkspaceContext);
  if (!ctx) {
    throw new Error("useRepoWorkspace must be used within RepoWorkspaceProvider");
  }
  return ctx;
}
