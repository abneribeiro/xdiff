import type { Node, Tree, Language } from "web-tree-sitter";
import { Query } from "web-tree-sitter";
import type { SymbolChange, SymbolKind } from "../protocol.js";
import type { LineRange } from "../differ.js";
import { getGrammar, initTreeSitter, type LoadedGrammar } from "./treesitter.js";
import { QUERIES } from "./queries.js";

export interface SemanticResult {
  symbols: SymbolChange[];
  commentOnly: boolean;
  publicSignatureChanged: boolean;
}

export const EMPTY_SEMANTIC: SemanticResult = {
  symbols: [],
  commentOnly: false,
  publicSignatureChanged: false,
};

export interface Analyzer {
  ready(): Promise<void>;
  analyze(
    absPath: string,
    original: string,
    modified: string,
    changedRanges: LineRange[],
  ): Promise<SemanticResult>;
}

export interface Def {
  name: string;
  kind: SymbolKind;
  startRow: number; // 0-based, inclusive
  endRow: number; // 0-based, inclusive
  paramsText: string;
  isPublic: boolean;
}

function kindFromDef(def: Node): SymbolKind {
  switch (def.type) {
    case "method_definition":
    case "method_declaration":
      return "method";
    case "class_declaration":
      return "class";
    case "interface_declaration":
      return "interface";
    case "type_spec":
      return def.childForFieldName("type")?.type === "struct_type" ? "struct" : "interface";
    default:
      return "function"; // function_declaration, variable_declarator (arrow)
  }
}

function isPublic(grammarKey: string, def: Node, name: Node): boolean {
  if (grammarKey === "go") {
    const first = name.text[0] ?? "";
    return first >= "A" && first <= "Z";
  }
  // TS/JS: exported if an ancestor is an export statement.
  let n: Node | null = def;
  for (let i = 0; i < 4 && n; i++) {
    if (n.type === "export_statement") return true;
    n = n.parent;
  }
  return false;
}

export function extractDefs(tree: Tree, grammar: LoadedGrammar): Def[] {
  const defs: Def[] = [];
  for (const match of grammar.query.matches(tree.rootNode)) {
    let defNode: Node | undefined;
    let nameNode: Node | undefined;
    let paramsNode: Node | undefined;
    for (const cap of match.captures) {
      if (cap.name === "def") defNode = cap.node;
      else if (cap.name === "name") nameNode = cap.node;
      else if (cap.name === "params") paramsNode = cap.node;
    }
    if (!defNode || !nameNode) continue;
    defs.push({
      name: nameNode.text,
      kind: kindFromDef(defNode),
      startRow: defNode.startPosition.row,
      endRow: defNode.endPosition.row,
      paramsText: paramsNode?.text ?? "",
      isPublic: isPublic(grammar.key, defNode, nameNode),
    });
  }
  return defs;
}

/** Innermost def whose row span contains the start of a changed range. */
function enclosingDef(defs: Def[], range: LineRange): Def | null {
  const row = range.startLine - 1;
  let best: Def | null = null;
  for (const d of defs) {
    if (d.startRow <= row && row <= d.endRow) {
      if (!best || d.endRow - d.startRow < best.endRow - best.startRow) best = d;
    }
  }
  return best;
}

// Cache one comment query per grammar key (for comment-only detection).
const commentQueries = new Map<string, Query>();
function commentQuery(key: string, language: Language): Query {
  let q = commentQueries.get(key);
  if (!q) {
    q = new Query(language, "(comment) @c");
    commentQueries.set(key, q);
  }
  return q;
}

function isCommentOnly(tree: Tree, grammar: LoadedGrammar, ranges: LineRange[]): boolean {
  if (ranges.length === 0) return false;
  const spans = commentQuery(grammar.key, grammar.language)
    .matches(tree.rootNode)
    .flatMap((m) => m.captures.map((c) => [c.node.startPosition.row, c.node.endPosition.row] as const));
  return ranges.every((r) => {
    const start = r.startLine - 1;
    const end = r.endLine - 1;
    return spans.some(([s, e]) => s <= start && end <= e);
  });
}

function treeSitterAnalyzer(): Analyzer {
  return {
    async ready() {
      await initTreeSitter();
    },
    async analyze(absPath, original, modified, changedRanges) {
      const grammar = await getGrammar(absPath, QUERIES);
      if (!grammar) return EMPTY_SEMANTIC;

      const modTree = grammar.parser.parse(modified);
      const origTree = grammar.parser.parse(original);
      if (!modTree || !origTree) return EMPTY_SEMANTIC;

      try {
        const modDefs = extractDefs(modTree, grammar);
        const origDefs = extractDefs(origTree, grammar);
        const origByName = new Map(origDefs.map((d) => [d.name, d]));
        const modNames = new Set(modDefs.map((d) => d.name));

        const changed = new Map<string, SymbolChange>();

        // Defs in the modified file touched by a change.
        for (const range of changedRanges) {
          const def = enclosingDef(modDefs, range);
          if (!def) continue;
          const prev = origByName.get(def.name);
          const sigChanged = prev ? prev.paramsText !== def.paramsText : false;
          changed.set(def.name + ":" + def.kind, {
            name: def.name,
            kind: def.kind,
            changeType: prev ? "modified" : "added",
            isPublic: def.isPublic,
            signatureChanged: sigChanged,
          });
        }

        // Defs that existed before but are gone now → removed.
        for (const d of origDefs) {
          if (!modNames.has(d.name)) {
            changed.set(d.name + ":" + d.kind, {
              name: d.name,
              kind: d.kind,
              changeType: "removed",
              isPublic: d.isPublic,
              signatureChanged: false,
            });
          }
        }

        const symbols = [...changed.values()];
        const publicSignatureChanged = symbols.some(
          (s) => s.isPublic && (s.signatureChanged || s.changeType === "removed"),
        );
        const commentOnly = isCommentOnly(modTree, grammar, changedRanges);
        return { symbols, commentOnly, publicSignatureChanged };
      } finally {
        modTree.delete();
        origTree.delete();
      }
    },
  };
}

export function createAnalyzer(): Analyzer {
  return treeSitterAnalyzer();
}
