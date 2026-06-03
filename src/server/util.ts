import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

/** Skip files larger than this — diffing/parsing them is rarely useful and costly. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface ReadResult {
  text: string | null;
  /** Reason text is null: too large, binary, or unreadable. */
  skip?: "too-large" | "binary" | "error";
}

export function readTextFile(absPath: string, maxBytes = MAX_FILE_BYTES): ReadResult {
  try {
    const st = statSync(absPath);
    if (!st.isFile()) return { text: null, skip: "error" };
    if (st.size > maxBytes) return { text: null, skip: "too-large" };
    const buf = readFileSync(absPath);
    if (isBinary(buf)) return { text: null, skip: "binary" };
    return { text: buf.toString("utf8") };
  } catch {
    return { text: null, skip: "error" };
  }
}

/** Heuristic: a NUL byte in the first 8KB means binary. */
function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// Extension → Monaco language id. Also used to pick a tree-sitter grammar.
const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".go": "go",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".py": "python",
  ".rs": "rust",
  ".java": "java",
  ".sh": "shell",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
};

export function languageOf(absPath: string): string {
  return EXT_LANG[extname(absPath).toLowerCase()] ?? "plaintext";
}
