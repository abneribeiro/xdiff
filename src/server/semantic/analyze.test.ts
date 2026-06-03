import { describe, it, expect, beforeAll } from "vitest";
import { createAnalyzer, type Analyzer } from "./analyze.js";
import { computeDiff } from "../differ.js";

const analyzer: Analyzer = createAnalyzer();

async function analyze(path: string, original: string, modified: string) {
  const { changedRanges } = computeDiff(original, modified);
  return analyzer.analyze(path, original, modified, changedRanges);
}

describe("semantic analyzer", () => {
  beforeAll(() => analyzer.ready());

  it("detects a public TS function signature change", async () => {
    const original = "export function add(a, b) {\n  return a + b;\n}\n";
    const modified = "export function add(a, b, c) {\n  return a + b + c;\n}\n";
    const r = await analyze("/p/math.ts", original, modified);
    const add = r.symbols.find((s) => s.name === "add");
    expect(add).toMatchObject({ kind: "function", changeType: "modified", isPublic: true, signatureChanged: true });
    expect(r.publicSignatureChanged).toBe(true);
  });

  it("treats a non-exported TS change as private", async () => {
    const original = "function helper(a) {\n  return a;\n}\n";
    const modified = "function helper(a, b) {\n  return a + b;\n}\n";
    const r = await analyze("/p/util.ts", original, modified);
    const helper = r.symbols.find((s) => s.name === "helper");
    expect(helper?.isPublic).toBe(false);
    expect(r.publicSignatureChanged).toBe(false);
  });

  it("uses Go capitalization for public visibility", async () => {
    const original = "package main\nfunc Add(a int) int {\n\treturn a\n}\n";
    const modified = "package main\nfunc Add(a, b int) int {\n\treturn a + b\n}\n";
    const r = await analyze("/p/math.go", original, modified);
    const add = r.symbols.find((s) => s.name === "Add");
    expect(add).toMatchObject({ kind: "function", isPublic: true, signatureChanged: true });
    expect(r.publicSignatureChanged).toBe(true);
  });

  it("flags newly added functions", async () => {
    const original = "function a() {}\n";
    const modified = "function a() {}\nfunction b() {}\n";
    const r = await analyze("/p/x.ts", original, modified);
    expect(r.symbols.find((s) => s.name === "b")?.changeType).toBe("added");
  });

  it("flags removed functions", async () => {
    const original = "function a() {}\nfunction b() {}\n";
    const modified = "function a() {}\n";
    const r = await analyze("/p/x.ts", original, modified);
    expect(r.symbols.find((s) => s.name === "b")?.changeType).toBe("removed");
  });

  it("detects comment-only changes", async () => {
    const original = "function f() {\n  // hello\n  return 1;\n}\n";
    const modified = "function f() {\n  // goodbye world\n  return 1;\n}\n";
    const r = await analyze("/p/c.ts", original, modified);
    expect(r.commentOnly).toBe(true);
  });

  it("returns empty for unsupported languages", async () => {
    const r = await analyze("/p/notes.md", "# a\n", "# b\n");
    expect(r.symbols).toHaveLength(0);
    expect(r.commentOnly).toBe(false);
  });
});
