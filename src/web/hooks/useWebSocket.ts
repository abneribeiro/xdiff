import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  ClientMessage,
  ServerMessage,
  FileDiff,
  CommitMeta,
  SymbolHistoryHit,
  SearchHit,
} from "../../server/protocol";

export interface BaselineInfo {
  mode: "git" | "snapshot";
  ref: string;
  cached: boolean;
}

export interface CommitView {
  sha: string;
  subject: string;
  files: FileDiff[];
}

export interface WsState {
  /** Live changed files keyed by path. */
  files: Record<string, FileDiff>;
  baseline: BaselineInfo | null;
  refs: { branches: string[]; commits: CommitMeta[] } | null;
  timeline: CommitMeta[];
  fileHistory: { path: string; commits: CommitMeta[] } | null;
  symbolHistory: { name: string; hits: SymbolHistoryHit[] } | null;
  search: { query: string; results: SearchHit[] } | null;
  commitView: CommitView | null;
  /** Epoch ms of the most recent live file change, for the footer's "last save". */
  lastUpdateAt: number | null;
}

const initialState: WsState = {
  files: {},
  baseline: null,
  refs: null,
  timeline: [],
  fileHistory: null,
  symbolHistory: null,
  search: null,
  commitView: null,
  lastUpdateAt: null,
};

function reducer(state: WsState, msg: ServerMessage): WsState {
  switch (msg.type) {
    case "init":
      return { ...state, baseline: { mode: msg.baseline, ref: msg.ref, cached: msg.cached } };
    case "file:update":
      return {
        ...state,
        files: { ...state.files, [msg.file.path]: msg.file },
        lastUpdateAt: Date.now(),
      };
    case "file:remove": {
      const next = { ...state.files };
      delete next[msg.path];
      return { ...state, files: next };
    }
    case "refs":
      return { ...state, refs: { branches: msg.branches, commits: msg.commits } };
    case "log":
      return { ...state, timeline: msg.commits };
    case "fileHistory":
      return { ...state, fileHistory: { path: msg.path, commits: msg.commits } };
    case "symbolHistory":
      return { ...state, symbolHistory: { name: msg.name, hits: msg.hits } };
    case "search":
      return { ...state, search: { query: msg.query, results: msg.results } };
    case "commit":
      return { ...state, commitView: { sha: msg.sha, subject: msg.subject, files: msg.files } };
    default:
      return state;
  }
}

export function useWebSocket(): { state: WsState; send: (m: ClientMessage) => void; connected: boolean } {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let backoff = 1000; // grows on repeated failures, capped at 10s
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect(): void {
      const ws = new WebSocket(`ws://${location.host}`);
      wsRef.current = ws;
      ws.addEventListener("open", () => {
        setConnected(true);
        backoff = 1000; // reset once a connection succeeds
        // Application-level keepalive so idle proxies don't drop the socket.
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      });
      ws.addEventListener("message", (ev) => {
        try {
          dispatch(JSON.parse(ev.data as string) as ServerMessage);
        } catch {
          /* ignore malformed frame */
        }
      });
      ws.addEventListener("close", () => {
        setConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!closed) {
          reconnectTimer = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 10_000);
        }
      });
      ws.addEventListener("error", () => ws.close());
    }
    connect();
    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((m: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }, []);

  return { state, send, connected };
}
