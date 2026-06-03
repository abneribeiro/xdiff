import type { FileDiff, SymbolKind } from "../../server/protocol";

/** Map a tree-sitter symbol kind to the short prototype tag (fn/in/ty/cl). */
export function tagFor(kind: SymbolKind): "fn" | "in" | "ty" | "cl" {
  switch (kind) {
    case "function":
    case "method":
      return "fn";
    case "interface":
      return "in";
    case "class":
      return "cl";
    case "struct":
      return "ty";
    default:
      return "ty";
  }
}

const VERB: Record<string, string> = {
  added: "added",
  removed: "removed",
  modified: "modified",
};

/** One-line summary of the first changed symbol, e.g. "function foo modified +2". */
export function symbolSummary(file: FileDiff): string {
  if (file.symbols.length === 0) return "";
  const first = file.symbols[0]!;
  const more = file.symbols.length > 1 ? ` +${file.symbols.length - 1}` : "";
  return `${first.kind} ${first.name} ${VERB[first.changeType] ?? ""}${more}`;
}

export function sortFiles(files: FileDiff[]): FileDiff[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}
