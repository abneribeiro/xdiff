import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIgnoreMatcher } from "./ignore.js";

describe("createIgnoreMatcher", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "xdiff-ignore-"));
    writeFileSync(join(root, ".gitignore"), "secret.txt\nlogs/\n");
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("ignores default heavy directories", () => {
    const m = createIgnoreMatcher(root);
    expect(m.isIgnored(join(root, "node_modules", "x", "index.js"))).toBe(true);
    expect(m.isIgnored(join(root, "dist", "out.js"))).toBe(true);
    expect(m.isIgnored(join(root, ".git", "HEAD"))).toBe(true);
  });

  it("respects .gitignore patterns", () => {
    const m = createIgnoreMatcher(root);
    expect(m.isIgnored(join(root, "secret.txt"))).toBe(true);
    expect(m.isIgnored(join(root, "logs", "today.log"))).toBe(true);
  });

  it("does not ignore normal source files", () => {
    const m = createIgnoreMatcher(root);
    expect(m.isIgnored(join(root, "src", "app.ts"))).toBe(false);
  });

  it("never ignores the root itself", () => {
    const m = createIgnoreMatcher(root);
    expect(m.isIgnored(root)).toBe(false);
  });
});
