import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { Git } from "./git.js";

const repoRoot = resolve(__dirname, "..", "..");
const git = new Git(repoRoot);

describe("Git history (against this repo)", () => {
  it("detects a git repository", () => {
    expect(git.available).toBe(true);
  });

  it("lists branches", () => {
    expect(git.listBranches().length).toBeGreaterThan(0);
  });

  it("returns recent commits with metadata", () => {
    const commits = git.recentCommits(5);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]!.sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(commits[0]!.subject.length).toBeGreaterThan(0);
  });

  it("returns history for a tracked file", () => {
    const commits = git.fileHistory("src/server/index.ts");
    expect(commits.length).toBeGreaterThan(0);
  });

  it("returns structured file entries for a commit", () => {
    // Use a commit that actually touched this file, so the test doesn't depend
    // on how the repo's own history happens to be organized.
    const touching = git.fileHistory("src/server/index.ts").at(0)!;
    const entries = git.commitFiles(touching.sha);
    expect(entries.some((e) => e.path === "src/server/index.ts")).toBe(true);
    expect(entries.every((e) => ["added", "modified", "removed", "renamed"].includes(e.status))).toBe(true);
  });

  it("reads file content at a ref", () => {
    const head = git.fileAtRef("HEAD", "package.json");
    expect(head).toContain("\"xdiff\"");
  });

  it("searches code with git grep", () => {
    const hits = git.searchCode("startServer");
    expect(hits.some((h) => h.path === "src/server/index.ts")).toBe(true);
  });

  it("supports regex search", () => {
    const hits = git.searchCode("start[A-Z]\\w+", { regex: true });
    expect(hits.some((h) => h.text.includes("startServer"))).toBe(true);
  });

  it("is case-insensitive by default but exact when caseSensitive", () => {
    // Built at runtime so this test file doesn't itself contain the upper-cased
    // form (git grep scans the working tree, including this file).
    const upper = "startServer".toUpperCase();
    expect(git.searchCode(upper).length).toBeGreaterThan(0);
    expect(git.searchCode(upper, { caseSensitive: true }).length).toBe(0);
  });

  it("finds symbol history via pickaxe + tree-sitter", async () => {
    const hits = await git.symbolHistory("startServer");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.changeType).toBeDefined();
  });
});
