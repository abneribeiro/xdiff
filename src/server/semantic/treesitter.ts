import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { Parser, Language, Query } from "web-tree-sitter";

const require = createRequire(import.meta.url);

// Resolve the directory of the bundled prebuilt grammars.
function wasmsDir(): string {
  return join(dirname(require.resolve("tree-sitter-wasms/package.json")), "out");
}

// File extension → grammar key (also the queries.ts key).
const EXT_GRAMMAR: Record<string, string> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".go": "go",
};

// grammar key → wasm filename in tree-sitter-wasms/out.
const GRAMMAR_WASM: Record<string, string> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  go: "tree-sitter-go.wasm",
};

export function grammarKeyFor(absPath: string): string | null {
  return EXT_GRAMMAR[extname(absPath).toLowerCase()] ?? null;
}

let initPromise: Promise<void> | null = null;
const languages = new Map<string, Language>();

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      // Help emscripten locate the core wasm regardless of cwd.
      locateFile: (file: string) =>
        join(dirname(require.resolve("web-tree-sitter")), file),
    });
  }
  return initPromise;
}

async function loadLanguage(key: string): Promise<Language | null> {
  const cached = languages.get(key);
  if (cached) return cached;
  const file = GRAMMAR_WASM[key];
  if (!file) return null;
  const bytes = readFileSync(join(wasmsDir(), file));
  const lang = await Language.load(new Uint8Array(bytes));
  languages.set(key, lang);
  return lang;
}

export interface LoadedGrammar {
  key: string;
  language: Language;
  parser: Parser;
  query: Query;
}

const grammars = new Map<string, LoadedGrammar | null>();

/** Returns a ready parser+query for the file's language, or null if unsupported. */
export async function getGrammar(
  absPath: string,
  querySource: Record<string, string>,
): Promise<LoadedGrammar | null> {
  const key = grammarKeyFor(absPath);
  if (!key) return null;
  if (grammars.has(key)) return grammars.get(key)!;

  await ensureInit();
  const language = await loadLanguage(key);
  const src = querySource[key];
  if (!language || !src) {
    grammars.set(key, null);
    return null;
  }
  const parser = new Parser();
  parser.setLanguage(language);
  const query = new Query(language, src);
  const loaded: LoadedGrammar = { key, language, parser, query };
  grammars.set(key, loaded);
  return loaded;
}

export async function initTreeSitter(): Promise<void> {
  await ensureInit();
}
