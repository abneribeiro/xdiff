import type { FileDiff } from "../../server/protocol";

// Groups the flat list of changed files into a collapsible directory tree, the
// way GitHub's "Files changed" tab does. Single-child directory chains are
// compressed ("src/web/components") and each folder carries rolled-up stats.

export interface TreeFile {
  type: "file";
  /** Basename shown in the row. */
  name: string;
  file: FileDiff;
}

export interface TreeDir {
  type: "dir";
  /** Display segment(s); compressed chains join with "/". */
  name: string;
  /** Full POSIX path of the directory, used as the collapse key. */
  path: string;
  children: TreeNode[];
  added: number;
  removed: number;
  fileCount: number;
}

export type TreeNode = TreeDir | TreeFile;

function newDir(name: string, path: string): TreeDir {
  return { type: "dir", name, path, children: [], added: 0, removed: 0, fileCount: 0 };
}

export function buildTree(files: FileDiff[]): TreeNode[] {
  const root = newDir("", "");
  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop() ?? file.path;
    let dir = root;
    let acc = "";
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = dir.children.find((c): c is TreeDir => c.type === "dir" && c.path === acc);
      if (!next) {
        next = newDir(seg, acc);
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ type: "file", name: fileName, file });
  }
  rollup(root);
  compress(root);
  sortTree(root);
  return root.children;
}

function rollup(dir: TreeDir): void {
  let added = 0;
  let removed = 0;
  let files = 0;
  for (const child of dir.children) {
    if (child.type === "file") {
      added += child.file.stats.added;
      removed += child.file.stats.removed;
      files += 1;
    } else {
      rollup(child);
      added += child.added;
      removed += child.removed;
      files += child.fileCount;
    }
  }
  dir.added = added;
  dir.removed = removed;
  dir.fileCount = files;
}

/** Collapse "a → b → c" chains (dirs with a single dir child) into one node. */
function compress(dir: TreeDir): void {
  for (const child of dir.children) {
    if (child.type !== "dir") continue;
    while (child.children.length === 1 && child.children[0]!.type === "dir") {
      const only = child.children[0] as TreeDir;
      child.name = `${child.name}/${only.name}`;
      child.path = only.path;
      child.children = only.children;
    }
    compress(child);
  }
}

/** Directories first, then files, each alphabetical. */
function sortTree(dir: TreeDir): void {
  dir.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of dir.children) if (c.type === "dir") sortTree(c);
}

/** File paths in display order, skipping anything inside a collapsed folder. */
export function flattenVisible(nodes: TreeNode[], collapsed: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode[]): void => {
    for (const n of list) {
      if (n.type === "file") out.push(n.file.path);
      else if (!collapsed.has(n.path)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
