import { describe, it, expect } from "vitest";
import { computeDiff } from "./differ.js";

describe("computeDiff", () => {
  it("reports identical for equal text", () => {
    const r = computeDiff("a\nb\n", "a\nb\n");
    expect(r.identical).toBe(true);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
  });

  it("counts pure additions and their line range", () => {
    const r = computeDiff("a\nb\n", "a\nb\nc\n");
    expect(r.identical).toBe(false);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.changedRanges).toContainEqual({ startLine: 3, endLine: 3 });
  });

  it("counts modifications as removed + added", () => {
    const r = computeDiff("a\nb\nc\n", "a\nX\nc\n");
    expect(r.added).toBe(1);
    expect(r.removed).toBe(1);
  });

  it("flags whitespace-only changes", () => {
    const r = computeDiff("function f(){return 1}\n", "function f() {\n  return 1\n}\n");
    expect(r.identical).toBe(false);
    expect(r.whitespaceOnly).toBe(true);
  });

  it("does not flag semantic changes as whitespace-only", () => {
    const r = computeDiff("return 1\n", "return 2\n");
    expect(r.whitespaceOnly).toBe(false);
  });
});
