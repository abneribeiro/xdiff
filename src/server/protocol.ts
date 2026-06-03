// Message contract shared between the Node server and the browser UI.

export type SymbolKind = "function" | "method" | "class" | "struct" | "interface";

export type SymbolChangeType = "added" | "modified" | "removed";

export interface SymbolChange {
  name: string;
  kind: SymbolKind;
  changeType: SymbolChangeType;
  /** Exported / public symbol — a signature change here may break callers. */
  isPublic: boolean;
  /** Parameter list changed between baseline and current (signature change). */
  signatureChanged: boolean;
}

export interface FileDiff {
  /** Path relative to the watched root, POSIX separators. */
  path: string;
  /** Previous path when the file was renamed/moved (commit view only). */
  oldPath?: string;
  /** Monaco language id (e.g. "typescript", "go", "plaintext"). */
  language: string;
  originalText: string;
  modifiedText: string;
  stats: { added: number; removed: number };
  /** Semantic summary of which definitions changed (empty if unsupported lang). */
  symbols: SymbolChange[];
  /** True when the only changes are inside comment nodes. */
  commentOnly: boolean;
  /** True when the only changes are whitespace. */
  whitespaceOnly: boolean;
  /** True when any public symbol's signature changed (drives the API-break alert). */
  publicSignatureChanged: boolean;
  /** Set when the file changed but its content can't be diffed in-browser. */
  skipped?: "binary" | "too-large";
}

/** One entry in a commit log (timeline / file history). */
export interface CommitMeta {
  sha: string;
  shortSha: string;
  author: string;
  /** ISO-8601 author date. */
  date: string;
  subject: string;
}

/** One occurrence of a symbol being created/changed/removed across history. */
export interface SymbolHistoryHit {
  sha: string;
  shortSha: string;
  date: string;
  subject: string;
  /** File (relative, POSIX) where the symbol changed in this commit. */
  path: string;
  changeType: SymbolChangeType;
}

/** One line matched by a global code/word search. */
export interface SearchHit {
  /** Path relative to the watched root, POSIX separators. */
  path: string;
  line: number;
  text: string;
}

export type ServerMessage =
  | { type: "init"; root: string; baseline: "git" | "snapshot"; ref: string; cached: boolean }
  | { type: "file:update"; file: FileDiff }
  | { type: "file:remove"; path: string }
  | { type: "refs"; branches: string[]; commits: CommitMeta[] }
  | { type: "log"; commits: CommitMeta[] }
  | { type: "fileHistory"; path: string; commits: CommitMeta[] }
  | { type: "symbolHistory"; name: string; hits: SymbolHistoryHit[] }
  | { type: "search"; query: string; results: SearchHit[] }
  /** A historical commit's diff, replacing the main view (kept out of the live cache). */
  | { type: "commit"; sha: string; subject: string; files: FileDiff[] };

export type ClientMessage =
  | { type: "ping" }
  /** Re-target the baseline to any git ref (branch/commit) and re-diff the tree. */
  | { type: "setBaseline"; ref: string; cached?: boolean }
  /** Request the list of branches + recent commits for the baseline dropdown. */
  | { type: "refs" }
  /** Request the recent commit timeline. */
  | { type: "log"; limit?: number }
  /** Request the commit history for a single file. */
  | { type: "fileHistory"; path: string; limit?: number }
  /** Request the diff a single commit introduced. */
  | { type: "showCommit"; sha: string }
  /** Find commits where a named symbol was created/changed/removed. */
  | { type: "symbolHistory"; name: string }
  /** Global code/word search across tracked files. */
  | { type: "search"; query: string; regex?: boolean; caseSensitive?: boolean };
