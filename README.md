# xdiff

Zero-config, real-time code diff tracker. Run it at the root of your project and
a browser tab shows live, as you save files  an editor-quality diff of every
change, with **semantic analysis**: not just *"line 42 changed"* but
*"function `calculateTax` modified"* and an alert when a **public API
signature** changes.

It's a lightweight, in-browser alternative to keeping `git diff` open in a
terminal, powered by the VS Code editor (Monaco) and tree-sitter.

## Usage

```bash
# at the root of your project
npx @abneribeiro/xdiff
```

That's it. xdiff starts a local server, opens your browser, and starts watching.
Press **Ctrl+C** to stop the server shuts down and frees all resources.

### Run from source (no install)

Until you've published your own build, you can run it straight from a clone:

```bash
git clone https://github.com/abneribeiro/xdiff.git
cd xdiff
npm install
npm run build
node dist/cli.js            # run inside any project: node /path/to/xdiff/dist/cli.js
```

### Options

| Flag           | Description                                               |
| -------------- | --------------------------------------------------------- |
| `--port <n>`   | Port to listen on (default: a random free port)           |
| `--ref <ref>`  | Git ref to diff against (default: `HEAD`)                 |
| `--cached`     | Diff against the git index instead of a commit            |
| `--no-open`    | Don't open the browser automatically                      |
| `-h, --help`   | Show help                                                 |

## How it works

- **Baseline** — in a git repo, diffs are computed against `HEAD` (or the index
  with `--cached`); outside git, against a snapshot taken when xdiff started
  (i.e. "changes since launch").
- **Watching** — `chokidar` watches the tree, automatically skipping heavy
  directories (`node_modules`, `dist`, `.git`, …) and everything in your
  `.gitignore`.
- **Diff** — Monaco renders the visual diff and collapses unchanged regions
  (keeping ~5 lines of context); the server computes line stats and maps changed
  ranges to definitions.
- **Semantics** — `web-tree-sitter` parses each changed file (TypeScript/JS/TSX
  and Go are bundled by default) to report which functions/methods/classes
  changed, whether a signature changed, and whether the symbol is public
  (exported in TS/JS, capitalized in Go).

## Changed-files view

The **Changed** sidebar tab groups files into a collapsible directory tree
(GitHub-style, with single-child folders compressed and per-folder
`+`/`−` rollups). Each row shows line stats, a proportional add/remove bar, the
top changed symbol, and a **viewed** checkbox so you can tick off files as you
review them viewed state is remembered per baseline. Deleted tracked files
appear as full deletions, and binary/oversized files are flagged instead of
silently hidden.

Two noise filters can be toggled at the top of the tab:

- **Ignore whitespace** — hides whitespace-only changes (also sets Monaco's
  `ignoreTrimWhitespace`).
- **Ignore comment-only changes** — hides files whose changes fall entirely
  within comments.

## Keyboard shortcuts

Press **?** for an in-app cheat sheet. The bindings:

| Key      | Action                          |
| -------- | ------------------------------- |
| `j`      | Next file                       |
| `k`      | Previous file                   |
| `n`      | Next change within the file     |
| `p`      | Previous change within the file |
| `v`      | Mark the active file viewed     |
| `s`      | Toggle side-by-side / inline    |
| `/`      | Jump to code search             |
| `?`      | Toggle the shortcuts overlay    |
| `Esc`    | Close the overlay               |

## Time Machine (git exploration)

In a git repo the UI doubles as a history browser:

- **Baseline selector** (header) — diff the working tree against any branch or
  recent commit, not just `HEAD`. Pick `main` to see your whole feature branch at
  once, or `:index` to diff the staged index. Commit diffs detect **renames**
  (shown as `old → new`).
- **Timeline** (sidebar tab) — the recent commit log; click a commit to view
  exactly what it introduced.
- **File history** — the ⏱ button on a file shows only the commits that touched
  it; click one to see that revision's diff.
- **Symbol history** — hover a file, click a changed symbol, and xdiff walks git
  history (pickaxe + tree-sitter) to find the commits where that **definition**
  was created, modified, or removed.
- **Search** (sidebar tab) — `git grep` across tracked files with optional
  **regex** and **case-sensitive** toggles; click a hit to jump to that file's
  history.

## Development

```bash
npm install
npm run build      # builds the Monaco UI (vite) + the CLI/server (tsup)
npm test           # vitest unit tests (differ, ignore, semantic, git, file tree)
node dist/cli.js   # run the built CLI
```

Source layout:

- `src/cli.ts` — CLI entry (args, startup, browser, Ctrl+C cleanup)
- `src/server/` — watcher, ignore rules, git/snapshot baseline, differ, ws hub
- `src/server/semantic/` — tree-sitter loader, queries, hunk→symbol analysis
- `src/web/` — Monaco diff UI, file tree, metrics bar, filters

## License

MIT
