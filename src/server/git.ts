import { execFileSync } from "node:child_process";
import { relative, sep } from "node:path";
import type { CommitMeta, SymbolHistoryHit, SearchHit } from "./protocol.js";
import { getGrammar, initTreeSitter, type LoadedGrammar } from "./semantic/treesitter.js";
import { extractDefs, type Def } from "./semantic/analyze.js";
import { QUERIES } from "./semantic/queries.js";

const SEP = "\x1f"; // unit separator between log fields
const LOG_FORMAT = `%H${SEP}%h${SEP}%an${SEP}%aI${SEP}%s`;

/** Extensions tree-sitter can parse — bounds the cost of symbol history. */
const CODE_PATHSPECS = ["*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs", "*.go"];

export type CommitFileStatus = "added" | "modified" | "removed" | "renamed";

/** One file touched by a commit, with rename source when applicable. */
export interface CommitFileEntry {
  status: CommitFileStatus;
  /** Watched-root-relative path (POSIX) of the file after the commit. */
  path: string;
  /** Previous path for renames. */
  oldPath?: string;
}

function statusWord(code: string): CommitFileStatus {
  if (code === "A") return "added";
  if (code === "D") return "removed";
  return "modified";
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * Git history access for the Time Machine features. All paths exchanged with
 * callers are relative to the *watched root* (POSIX); internally they are
 * translated to repo-root-relative paths and all commands run from the git root,
 * so git's own repo-relative output maps back cleanly.
 */
export class Git {
  readonly available: boolean;
  private gitRoot = "";
  /** POSIX path from the git root down to the watched root ("" when equal). */
  private prefix = "";

  constructor(private root: string) {
    const top = this.run(["rev-parse", "--show-toplevel"], root);
    if (top === null) {
      this.available = false;
      return;
    }
    this.available = true;
    this.gitRoot = top.trim();
    const rel = toPosix(relative(this.gitRoot, root));
    this.prefix = rel === "" || rel.startsWith("..") ? "" : rel;
  }

  private run(args: string[], cwd = this.gitRoot): string | null {
    try {
      return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return null;
    }
  }

  private toRepoPath(relToRoot: string): string {
    return this.prefix ? `${this.prefix}/${relToRoot}` : relToRoot;
  }

  /** Repo-relative → watched-root-relative, or null if outside the watched root. */
  private fromRepoPath(repoRel: string): string | null {
    if (!this.prefix) return repoRel;
    if (repoRel === this.prefix) return "";
    return repoRel.startsWith(this.prefix + "/") ? repoRel.slice(this.prefix.length + 1) : null;
  }

  private parseLog(out: string | null): CommitMeta[] {
    if (!out) return [];
    const commits: CommitMeta[] = [];
    for (const line of out.split("\n")) {
      if (!line) continue;
      const [sha, shortSha, author, date, ...rest] = line.split(SEP);
      if (!sha) continue;
      commits.push({ sha, shortSha: shortSha ?? "", author: author ?? "", date: date ?? "", subject: rest.join(SEP) });
    }
    return commits;
  }

  listBranches(): string[] {
    const out = this.run(["branch", "--format=%(refname:short)", "--sort=-committerdate"]);
    if (!out) return [];
    return out.split("\n").map((b) => b.trim()).filter(Boolean);
  }

  recentCommits(limit = 50): CommitMeta[] {
    return this.parseLog(this.run(["log", `-n${limit}`, `--format=${LOG_FORMAT}`]));
  }

  fileHistory(relToRoot: string, limit = 50): CommitMeta[] {
    return this.parseLog(
      this.run(["log", `-n${limit}`, `--format=${LOG_FORMAT}`, "--", this.toRepoPath(relToRoot)]),
    );
  }

  /**
   * Files changed by a commit, as watched-root-relative paths (outside dropped).
   * `-M` detects renames so a moved file is reported once with its `oldPath`.
   */
  commitFiles(sha: string): CommitFileEntry[] {
    const out = this.run(["diff-tree", "--no-commit-id", "--name-status", "-M", "-r", "--root", sha]);
    if (!out) return [];
    const files: CommitFileEntry[] = [];
    for (const line of out.split("\n")) {
      if (!line) continue;
      const parts = line.split("\t");
      const code = parts[0] ?? "";
      const status = code[0] ?? "";
      if (status === "R" || status === "C") {
        const oldRel = this.fromRepoPath(parts[1] ?? "");
        const newRel = this.fromRepoPath(parts[2] ?? "");
        if (newRel !== null) files.push({ status: "renamed", path: newRel, oldPath: oldRel ?? undefined });
      } else {
        const rel = this.fromRepoPath(parts[1] ?? "");
        if (rel !== null) files.push({ status: statusWord(status), path: rel });
      }
    }
    return files;
  }

  commitMeta(sha: string): CommitMeta | null {
    return this.parseLog(this.run(["log", "-n1", `--format=${LOG_FORMAT}`, sha]))[0] ?? null;
  }

  /** Content of a watched-root file at a ref. Empty string when absent at that ref. */
  fileAtRef(ref: string, relToRoot: string): string {
    const out = this.run(["show", `${ref}:${this.toRepoPath(relToRoot)}`]);
    return out ?? "";
  }

  searchCode(query: string, opts: { regex?: boolean; caseSensitive?: boolean } = {}, limit = 200): SearchHit[] {
    if (!query.trim()) return [];
    const args = ["grep", "-n", "-I"];
    args.push(opts.regex ? "-E" : "-F");
    if (!opts.caseSensitive) args.push("-i");
    args.push("-e", query);
    if (this.prefix) args.push("--", this.prefix);
    const out = this.run(args);
    if (!out) return [];
    const results: SearchHit[] = [];
    for (const line of out.split("\n")) {
      if (!line || results.length >= limit) break;
      // format: path:line:text
      const first = line.indexOf(":");
      const second = line.indexOf(":", first + 1);
      if (first < 0 || second < 0) continue;
      const rel = this.fromRepoPath(line.slice(0, first));
      if (rel === null) continue;
      const lineNo = Number.parseInt(line.slice(first + 1, second), 10);
      if (Number.isNaN(lineNo)) continue;
      results.push({ path: rel, line: lineNo, text: line.slice(second + 1) });
    }
    return results;
  }

  /**
   * Commits where a named symbol's *definition* was added, modified, or removed.
   * Pickaxe (-S) narrows to commits that touch the identifier; tree-sitter then
   * confirms the definition (not just a call site) actually changed.
   */
  async symbolHistory(name: string, limit = 30): Promise<SymbolHistoryHit[]> {
    if (!this.available || !name.trim()) return [];
    await initTreeSitter();

    const out = this.run([
      "log",
      `-n${limit}`,
      `-S${name}`,
      `--format=__C__${LOG_FORMAT}`,
      "--name-only",
      "--",
      ...CODE_PATHSPECS,
    ]);
    if (!out) return [];

    // Parse interleaved "commit header / file list" blocks.
    const blocks: { meta: CommitMeta; files: string[] }[] = [];
    let current: { meta: CommitMeta; files: string[] } | null = null;
    for (const raw of out.split("\n")) {
      if (raw.startsWith("__C__")) {
        const meta = this.parseLog(raw.slice("__C__".length))[0];
        current = meta ? { meta, files: [] } : null;
        if (current) blocks.push(current);
      } else if (raw && current) {
        current.files.push(raw);
      }
    }

    const hits: SymbolHistoryHit[] = [];
    for (const { meta, files } of blocks) {
      for (const repoRel of files) {
        const rel = this.fromRepoPath(repoRel);
        if (rel === null) continue;
        const change = await this.classifySymbolChange(meta.sha, rel, name);
        if (change) {
          hits.push({ ...meta, path: rel, changeType: change });
          break; // one hit per commit is enough for the timeline
        }
      }
    }
    return hits;
  }

  private async classifySymbolChange(
    sha: string,
    relToRoot: string,
    name: string,
  ): Promise<SymbolHistoryHit["changeType"] | null> {
    const grammar = await getGrammar(relToRoot, QUERIES);
    if (!grammar) return null;
    const before = this.fileAtRef(`${sha}^`, relToRoot);
    const after = this.fileAtRef(sha, relToRoot);
    const defBefore = findDef(before, grammar, name);
    const defAfter = findDef(after, grammar, name);
    if (!defBefore && defAfter) return "added";
    if (defBefore && !defAfter) return "removed";
    if (defBefore && defAfter) {
      const changed =
        defBefore.def.paramsText !== defAfter.def.paramsText || defBefore.text !== defAfter.text;
      return changed ? "modified" : null;
    }
    return null;
  }
}

function findDef(source: string, grammar: LoadedGrammar, name: string): { def: Def; text: string } | null {
  if (!source) return null;
  const tree = grammar.parser.parse(source);
  if (!tree) return null;
  try {
    const def = extractDefs(tree, grammar).find((d) => d.name === name);
    if (!def) return null;
    const lines = source.split("\n").slice(def.startRow, def.endRow + 1).join("\n");
    return { def, text: lines };
  } finally {
    tree.delete();
  }
}
