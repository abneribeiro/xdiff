import { execFileSync } from "node:child_process";
import { relative, sep, join } from "node:path";
import { readdirSync } from "node:fs";
import type { IgnoreMatcher } from "./ignore.js";
import { readTextFile } from "./util.js";

export type BaselineMode = "git" | "snapshot";

function fromPosix(p: string): string {
  return sep === "/" ? p : p.split("/").join(sep);
}

export interface BaselineOptions {
  /** Git ref to diff against (default "HEAD"). Ignored in snapshot mode. */
  ref?: string;
  /** Compare against the index instead of working tree's committed state. */
  cached?: boolean;
}

function tryGit(root: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * Resolves the "original" content for any file:
 *  - git repo  → content of the given ref (default HEAD); empty for new/untracked files.
 *  - otherwise → content captured by an initial scan at startup ("changes since launch").
 */
export class Baseline {
  readonly mode: BaselineMode;
  ref: string;
  cached: boolean;
  private gitRoot: string | null = null;
  private snapshot = new Map<string, string>();

  private constructor(
    private root: string,
    ref: string,
    cached: boolean,
  ) {
    this.ref = ref;
    this.cached = cached;
    const gitRoot = tryGit(root, ["rev-parse", "--show-toplevel"]);
    if (gitRoot) {
      this.gitRoot = gitRoot.trim();
      this.mode = "git";
    } else {
      this.mode = "snapshot";
    }
  }

  static create(root: string, matcher: IgnoreMatcher, opts: BaselineOptions = {}): Baseline {
    const b = new Baseline(root, opts.ref ?? "HEAD", opts.cached ?? false);
    if (b.mode === "snapshot") b.scan(root, matcher);
    return b;
  }

  /** Walk the tree once, recording current file contents as the baseline. */
  private scan(dir: string, matcher: IgnoreMatcher): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (matcher.isIgnored(abs)) continue;
      if (e.isDirectory()) {
        this.scan(abs, matcher);
      } else if (e.isFile()) {
        const { text } = readTextFile(abs);
        if (text !== null) this.snapshot.set(abs, text);
      }
    }
  }

  /** Re-target the git baseline to a new ref/index (no-op in snapshot mode). */
  setRef(ref: string, cached = false): void {
    if (this.mode !== "git") return;
    this.ref = ref;
    this.cached = cached;
  }

  /**
   * Absolute paths of every file that differs from the current baseline.
   * Git mode only: tracked changes (`git diff --name-only`) plus untracked files,
   * filtered through the ignore matcher. Returns [] in snapshot mode.
   */
  changedPaths(matcher: IgnoreMatcher): string[] {
    if (this.mode !== "git") return [];
    const base = this.gitRoot ?? this.root;
    const diffArgs = this.cached
      ? ["diff", "--name-only", "--cached"]
      : ["diff", "--name-only", this.ref];
    const tracked = tryGit(base, diffArgs) ?? "";
    const untracked = tryGit(base, ["ls-files", "--others", "--exclude-standard"]) ?? "";

    const out = new Set<string>();
    for (const rel of `${tracked}\n${untracked}`.split("\n")) {
      if (!rel.trim()) continue;
      const abs = join(base, fromPosix(rel.trim()));
      if (!matcher.isIgnored(abs)) out.add(abs);
    }
    return [...out];
  }

  /** Original content for a file. Returns "" when the file is new (no baseline). */
  getOriginal(absPath: string): string {
    if (this.mode === "snapshot") {
      return this.snapshot.get(absPath) ?? "";
    }
    const base = this.gitRoot ?? this.root;
    const rel = toPosix(relative(base, absPath));
    const spec = this.cached ? `:${rel}` : `${this.ref}:${rel}`;
    const out = tryGit(base, ["show", spec]);
    return out ?? ""; // not in ref (new/untracked) → empty baseline
  }
}
