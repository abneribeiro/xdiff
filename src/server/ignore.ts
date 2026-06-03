import { readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ignore, { type Ignore } from "ignore";

// Heavy / generated directories we never want to watch, regardless of
// .gitignore. Keeps the CPU calm even in projects that commit these.
const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  "coverage",
  ".idea",
  ".vscode",
  "__pycache__",
  ".venv",
  ".DS_Store",
];

export interface IgnoreMatcher {
  /** True when the absolute path should be excluded from watching/diffing. */
  isIgnored(absPath: string): boolean;
}

function toPosixRelative(root: string, absPath: string): string | null {
  const rel = relative(root, absPath);
  // Outside the root, or the root itself.
  if (rel === "" || rel.startsWith("..")) return null;
  return sep === "/" ? rel : rel.split(sep).join("/");
}

export function createIgnoreMatcher(root: string): IgnoreMatcher {
  const ig: Ignore = ignore();
  ig.add(DEFAULT_IGNORES.map((d) => `${d}/`));
  ig.add(DEFAULT_IGNORES); // also match as files/exact names

  const gitignorePath = join(root, ".gitignore");
  if (existsSync(gitignorePath)) {
    try {
      ig.add(readFileSync(gitignorePath, "utf8"));
    } catch {
      // Unreadable .gitignore — fall back to defaults only.
    }
  }

  return {
    isIgnored(absPath: string): boolean {
      const rel = toPosixRelative(root, absPath);
      if (rel === null) return false; // never ignore the root dir itself
      return ig.ignores(rel);
    },
  };
}
