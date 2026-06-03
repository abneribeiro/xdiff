import { describe, it, expect } from "vitest";
import { buildTree, flattenVisible, type TreeDir } from "./tree.js";
import type { FileDiff } from "../../server/protocol.js";

function fd(path: string, added = 1, removed = 0): FileDiff {
  return {
    path,
    language: "typescript",
    originalText: "",
    modifiedText: "",
    stats: { added, removed },
    symbols: [],
    commentOnly: false,
    whitespaceOnly: false,
    publicSignatureChanged: false,
  };
}

describe("buildTree", () => {
  it("groups files under directories with rolled-up stats", () => {
    const tree = buildTree([fd("src/a.ts", 2, 1), fd("src/b.ts", 3, 0), fd("README.md", 1, 1)]);
    expect(tree).toHaveLength(2); // src/ dir, then README.md file
    const src = tree[0] as TreeDir;
    expect(src.type).toBe("dir");
    expect(src.name).toBe("src");
    expect(src.fileCount).toBe(2);
    expect(src.added).toBe(5);
    expect(src.removed).toBe(1);
    expect(tree[1]!.type).toBe("file");
  });

  it("compresses single-child directory chains", () => {
    const tree = buildTree([fd("src/web/components/X.tsx")]);
    const dir = tree[0] as TreeDir;
    expect(dir.name).toBe("src/web/components");
    expect(dir.children).toHaveLength(1);
    expect(dir.children[0]!.type).toBe("file");
  });

  it("flattenVisible lists files in display order and skips collapsed folders", () => {
    const tree = buildTree([fd("src/a.ts"), fd("src/b.ts"), fd("root.ts")]);
    expect(flattenVisible(tree, new Set())).toEqual(["src/a.ts", "src/b.ts", "root.ts"]);
    expect(flattenVisible(tree, new Set(["src"]))).toEqual(["root.ts"]);
  });
});
