import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep, extname, normalize } from "node:path";
import { WebSocketServer, WebSocket } from "ws";

import { createIgnoreMatcher } from "./ignore.js";
import { Baseline } from "./baseline.js";
import { Git } from "./git.js";
import { ProjectWatcher } from "./watcher.js";
import { computeDiff } from "./differ.js";
import { createAnalyzer } from "./semantic/analyze.js";
import { readTextFile, languageOf } from "./util.js";
import type { FileDiff, ServerMessage, ClientMessage } from "./protocol.js";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "web");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface ServerOptions {
  root: string;
  port: number;
  ref?: string;
  cached?: boolean;
}

export interface ServerHandle {
  port: number;
  baselineMode: "git" | "snapshot";
  close: () => Promise<void>;
}

export async function startServer(opts: ServerOptions): Promise<ServerHandle> {
  const { root } = opts;
  const matcher = createIgnoreMatcher(root);
  const baseline = Baseline.create(root, matcher, { ref: opts.ref, cached: opts.cached });
  const git = new Git(root);
  const analyzer = createAnalyzer();
  await analyzer.ready();

  /** Current diff per relative path, replayed to newly connected clients. */
  const cache = new Map<string, FileDiff>();
  const clients = new Set<WebSocket>();

  function toRel(absPath: string): string {
    const rel = relative(root, absPath);
    return sep === "/" ? rel : rel.split(sep).join("/");
  }

  function broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  /** Assemble a FileDiff from two texts. `relPath` drives language + grammar. */
  async function makeFileDiff(
    relPath: string,
    original: string,
    modified: string,
    opts: { oldPath?: string; keepIdentical?: boolean } = {},
  ): Promise<FileDiff | null> {
    const diff = computeDiff(original, modified);
    if (diff.identical && !opts.keepIdentical) return null;

    const semantic = await analyzer.analyze(relPath, original, modified, diff.changedRanges);
    return {
      path: relPath,
      oldPath: opts.oldPath,
      language: languageOf(relPath),
      originalText: original,
      modifiedText: modified,
      stats: { added: diff.added, removed: diff.removed },
      symbols: semantic.symbols,
      commentOnly: semantic.commentOnly,
      whitespaceOnly: diff.whitespaceOnly,
      publicSignatureChanged: semantic.publicSignatureChanged,
    };
  }

  /** A changed file we can't diff in-browser (binary / oversized). */
  function skippedDiff(relPath: string, skip: "binary" | "too-large"): FileDiff {
    return {
      path: relPath,
      language: languageOf(relPath),
      originalText: "",
      modifiedText: "",
      stats: { added: 0, removed: 0 },
      symbols: [],
      commentOnly: false,
      whitespaceOnly: false,
      publicSignatureChanged: false,
      skipped: skip,
    };
  }

  /** Live diff: current file on disk vs the active baseline. */
  async function buildDiff(absPath: string): Promise<FileDiff | null> {
    const cur = readTextFile(absPath);
    const relPath = toRel(absPath);
    if (cur.text === null) {
      // Deleted on disk but present in the baseline → show a full deletion.
      if (!existsSync(absPath)) {
        const original = baseline.getOriginal(absPath);
        return original === "" ? null : makeFileDiff(relPath, original, "");
      }
      // Exists but isn't diffable as text — surface it rather than hiding it.
      if (cur.skip === "binary" || cur.skip === "too-large") return skippedDiff(relPath, cur.skip);
      return null; // unreadable
    }
    return makeFileDiff(relPath, baseline.getOriginal(absPath), cur.text);
  }

  function initMessage(): ServerMessage {
    return { type: "init", root, baseline: baseline.mode, ref: baseline.ref, cached: baseline.cached };
  }

  /** Recompute the whole changed set against the current baseline and sync clients. */
  async function rebuildAll(): Promise<void> {
    const next = new Map<string, FileDiff>();
    for (const abs of baseline.changedPaths(matcher)) {
      const fd = await buildDiff(abs);
      if (fd) next.set(fd.path, fd);
    }
    for (const rel of cache.keys()) {
      if (!next.has(rel)) broadcast({ type: "file:remove", path: rel });
    }
    cache.clear();
    for (const [rel, fd] of next) {
      cache.set(rel, fd);
      broadcast({ type: "file:update", file: fd });
    }
  }

  /** Build the diff a single commit introduced (parent → commit). */
  async function buildCommit(sha: string): Promise<ServerMessage> {
    const files: FileDiff[] = [];
    for (const entry of git.commitFiles(sha)) {
      const before = entry.status === "added" ? "" : git.fileAtRef(`${sha}^`, entry.oldPath ?? entry.path);
      const after = entry.status === "removed" ? "" : git.fileAtRef(sha, entry.path);
      const fd = await makeFileDiff(entry.path, before, after, {
        oldPath: entry.oldPath,
        keepIdentical: entry.status === "renamed",
      });
      if (fd) files.push(fd);
    }
    const meta = git.commitMeta(sha);
    return { type: "commit", sha, subject: meta?.subject ?? sha, files };
  }

  async function onClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    const send = (m: ServerMessage) => ws.send(JSON.stringify(m));
    switch (msg.type) {
      case "ping":
        break;
      case "setBaseline":
        if (baseline.mode !== "git") break;
        baseline.setRef(msg.ref, msg.cached ?? false);
        broadcast(initMessage());
        await rebuildAll();
        break;
      case "refs":
        send({ type: "refs", branches: git.listBranches(), commits: git.recentCommits() });
        break;
      case "log":
        send({ type: "log", commits: git.recentCommits(msg.limit ?? 50) });
        break;
      case "fileHistory":
        send({ type: "fileHistory", path: msg.path, commits: git.fileHistory(msg.path, msg.limit ?? 50) });
        break;
      case "showCommit":
        send(await buildCommit(msg.sha));
        break;
      case "symbolHistory":
        send({ type: "symbolHistory", name: msg.name, hits: await git.symbolHistory(msg.name) });
        break;
      case "search":
        send({
          type: "search",
          query: msg.query,
          results: git.searchCode(msg.query, { regex: msg.regex, caseSensitive: msg.caseSensitive }),
        });
        break;
    }
  }

  async function onChange(absPath: string): Promise<void> {
    const fd = await buildDiff(absPath);
    const rel = toRel(absPath);
    if (!fd) {
      // File reverted to baseline (or unreadable) — drop it if present.
      if (cache.delete(rel)) broadcast({ type: "file:remove", path: rel });
      return;
    }
    cache.set(rel, fd);
    broadcast({ type: "file:update", file: fd });
  }

  async function onRemove(absPath: string): Promise<void> {
    const rel = toRel(absPath);
    // In git mode a deleted *tracked* file is itself a change worth showing as a
    // full deletion against the baseline; only drop it when there's no baseline.
    if (baseline.mode === "git") {
      const fd = await buildDiff(absPath);
      if (fd) {
        cache.set(rel, fd);
        broadcast({ type: "file:update", file: fd });
        return;
      }
    }
    if (cache.delete(rel)) broadcast({ type: "file:remove", path: rel });
  }

  const watcher = new ProjectWatcher(root, matcher, {
    onChange: (p) => void onChange(p),
    onRemove: (p) => void onRemove(p),
  });

  // Seed the initial view with everything already differing from the baseline
  // (git mode), so the UI is useful on open — not only after the next save.
  await rebuildAll();

  const http: Server = createServer((req, res) => {
    void serveStatic(req.url ?? "/", res);
  });

  const wss = new WebSocketServer({ server: http });
  // Liveness flag set on pong; cleared each heartbeat tick. Dead sockets (e.g. a
  // laptop that slept) are terminated so `clients` doesn't leak broadcast targets.
  const alive = new WeakMap<WebSocket, boolean>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("close", () => clients.delete(ws));
    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        return; // ignore malformed frame
      }
      void onClientMessage(ws, msg);
    });
    ws.send(JSON.stringify(initMessage()));
    for (const fd of cache.values()) {
      ws.send(JSON.stringify({ type: "file:update", file: fd } satisfies ServerMessage));
    }
  });

  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      alive.set(ws, false);
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30_000);
  heartbeat.unref?.();

  await new Promise<void>((resolve) => http.listen(opts.port, resolve));
  const addr = http.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;

  return {
    port,
    baselineMode: baseline.mode,
    async close() {
      clearInterval(heartbeat);
      await watcher.close();
      for (const ws of clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

async function serveStatic(urlPath: string, res: import("node:http").ServerResponse): Promise<void> {
  // Strip query string; default to index.html; prevent path traversal.
  let pathname = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  if (pathname === "/" || pathname === "") pathname = "/index.html";
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(WEB_ROOT, safe);
  // Confine to WEB_ROOT: equal, or a descendant (guard against sibling prefixes).
  if (filePath !== WEB_ROOT && !filePath.startsWith(WEB_ROOT + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(body);
  } catch {
    // SPA fallback to index.html for unknown routes.
    try {
      const body = await readFile(join(WEB_ROOT, "index.html"));
      res.writeHead(200, { "content-type": CONTENT_TYPES[".html"]! });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
}
