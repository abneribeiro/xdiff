import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useKeyboard } from "./hooks/useKeyboard";
import { Header } from "./components/Header";
import { Sidebar, type SidebarTab, type TimelineFocus } from "./components/Sidebar";
import { MonacoDiff, type MonacoDiffHandle } from "./components/MonacoDiff";
import { Footer } from "./components/Footer";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import type { SearchOptions } from "./components/SearchPanel";
import { sortFiles } from "./lib/symbols";
import { buildTree, flattenVisible } from "./lib/tree";
import { isFiltered, type FilterState } from "./ui/filters";
import { load, save } from "./lib/storage";

export function App(): JSX.Element {
  const { state, send, connected } = useWebSocket();
  const [filters, setFilters] = useState<FilterState>(() =>
    load("filters", { whitespace: false, comments: false }),
  );
  const [sideBySide, setSideBySide] = useState<boolean>(() => load("sideBySide", true));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(load<string[]>("collapsed", [])));
  const [viewedByRef, setViewedByRef] = useState<Record<string, string[]>>(() => load("viewed", {}));
  const [tab, setTab] = useState<SidebarTab>("files");
  const [focus, setFocus] = useState<TimelineFocus>("recent");
  const [mode, setMode] = useState<"live" | "commit">("live");
  const [active, setActive] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [searchFocus, setSearchFocus] = useState(0);
  const diffRef = useRef<MonacoDiffHandle>(null);

  // Persist UI preferences across sessions.
  useEffect(() => save("filters", filters), [filters]);
  useEffect(() => save("sideBySide", sideBySide), [sideBySide]);
  useEffect(() => save("collapsed", [...collapsed]), [collapsed]);
  useEffect(() => save("viewed", viewedByRef), [viewedByRef]);

  // "Viewed" is scoped to the active baseline — switching refs is a fresh review.
  const refKey = state.baseline
    ? `${state.baseline.mode}:${state.baseline.ref}:${state.baseline.cached}`
    : "none";
  const viewed = useMemo(() => new Set(viewedByRef[refKey] ?? []), [viewedByRef, refKey]);

  // Files for the current view: a historical commit's diff, or the live set.
  const viewFiles = useMemo(
    () => (mode === "commit" && state.commitView ? state.commitView.files : sortFiles(Object.values(state.files))),
    [mode, state.commitView, state.files],
  );
  const visible = useMemo(() => viewFiles.filter((f) => !isFiltered(f, filters)), [viewFiles, filters]);
  const tree = useMemo(() => buildTree(visible), [visible]);
  const orderedPaths = useMemo(() => flattenVisible(tree, collapsed), [tree, collapsed]);
  const viewedCount = useMemo(
    () => visible.reduce((n, f) => n + (viewed.has(f.path) ? 1 : 0), 0),
    [visible, viewed],
  );

  // Keep a valid selection as the visible set changes.
  useEffect(() => {
    if (active && visible.some((f) => f.path === active)) return;
    setActive(visible[0]?.path ?? null);
  }, [visible, active]);

  // When a freshly requested commit diff arrives, switch into the historical view.
  useEffect(() => {
    if (state.commitView && mode === "commit") setActive(state.commitView.files[0]?.path ?? null);
  }, [state.commitView, mode]);

  const activeFile = visible.find((f) => f.path === active) ?? null;

  const selectBaseline = (ref: string, cached: boolean): void => {
    setMode("live");
    send({ type: "setBaseline", ref, cached });
  };
  const showCommit = (sha: string): void => {
    setMode("commit");
    send({ type: "showCommit", sha });
  };
  const showFileHistory = (path: string): void => {
    setTab("timeline");
    setFocus("file");
    send({ type: "fileHistory", path });
  };
  const showSymbolHistory = (name: string): void => {
    setTab("timeline");
    setFocus("symbol");
    send({ type: "symbolHistory", name });
  };
  const openTab = (next: SidebarTab): void => {
    setTab(next);
    if (next === "timeline") {
      setFocus("recent");
      send({ type: "log" });
    }
    if (next === "files" && !state.refs) send({ type: "refs" });
    if (next === "search") setSearchFocus((n) => n + 1);
  };

  const toggleDir = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  const toggleViewed = (path: string): void =>
    setViewedByRef((prev) => {
      const cur = new Set(prev[refKey] ?? []);
      cur.has(path) ? cur.delete(path) : cur.add(path);
      return { ...prev, [refKey]: [...cur] };
    });

  const moveSelection = (delta: 1 | -1): void => {
    if (orderedPaths.length === 0) return;
    const idx = active ? orderedPaths.indexOf(active) : -1;
    const next =
      idx === -1
        ? delta === 1
          ? 0
          : orderedPaths.length - 1
        : Math.min(Math.max(idx + delta, 0), orderedPaths.length - 1);
    setActive(orderedPaths[next] ?? null);
  };

  useKeyboard({
    j: (e) => {
      e.preventDefault();
      moveSelection(1);
    },
    k: (e) => {
      e.preventDefault();
      moveSelection(-1);
    },
    n: () => diffRef.current?.nextChange(),
    p: () => diffRef.current?.prevChange(),
    s: () => setSideBySide((v) => !v),
    v: () => {
      if (active) toggleViewed(active);
    },
    "/": (e) => {
      e.preventDefault();
      setTab("search");
      setSearchFocus((nx) => nx + 1);
    },
    "?": () => setShowHelp((v) => !v),
    Escape: () => setShowHelp(false),
  });

  return (
    <div className={styles.app}>
      <Header
        baseline={state.baseline}
        refs={state.refs}
        files={viewFiles}
        sideBySide={sideBySide}
        onToggleSideBySide={() => setSideBySide((v) => !v)}
        onRequestRefs={() => send({ type: "refs" })}
        onSelectBaseline={selectBaseline}
        commitView={mode === "commit" ? state.commitView : null}
        onBackToLive={() => setMode("live")}
      />
      <div className={styles.body}>
        <Sidebar
          tab={tab}
          onTab={openTab}
          focus={focus}
          onFocus={setFocus}
          filters={filters}
          onFilters={setFilters}
          tree={tree}
          active={active}
          viewed={viewed}
          collapsed={collapsed}
          onToggleDir={toggleDir}
          onToggleViewed={toggleViewed}
          onSelect={setActive}
          onFileHistory={showFileHistory}
          onSymbolHistory={showSymbolHistory}
          timeline={state.timeline}
          fileHistory={state.fileHistory}
          symbolHistory={state.symbolHistory}
          search={state.search}
          onSearch={(query: string, opts: SearchOptions) =>
            send({ type: "search", query, regex: opts.regex, caseSensitive: opts.caseSensitive })
          }
          searchFocus={searchFocus}
          onShowCommit={showCommit}
        />
        <main className={styles.diff}>
          {activeFile ? (
            activeFile.skipped ? (
              <div className={styles.empty}>
                {activeFile.skipped === "binary" ? "Binary file — not shown" : "File too large to diff"}
              </div>
            ) : (
              <MonacoDiff
                ref={diffRef}
                file={activeFile}
                sideBySide={sideBySide}
                ignoreWhitespace={filters.whitespace}
              />
            )
          ) : (
            <div className={styles.empty}>Save a file to see changes…</div>
          )}
        </main>
      </div>
      <Footer
        connected={connected}
        changedCount={visible.length}
        viewedCount={viewedCount}
        lastUpdateAt={state.lastUpdateAt}
      />
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
