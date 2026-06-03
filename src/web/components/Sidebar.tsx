import styles from "./Sidebar.module.css";
import type { CommitMeta, SymbolHistoryHit, SearchHit } from "../../server/protocol";
import type { FilterState } from "../ui/filters";
import type { TreeNode } from "../lib/tree";
import { FilterToggles } from "./FilterToggles";
import { FileTree } from "./FileTree";
import { CommitList, type CommitItem } from "./CommitList";
import { SearchPanel, type SearchOptions } from "./SearchPanel";

export type SidebarTab = "files" | "timeline" | "search";
export type TimelineFocus = "recent" | "file" | "symbol";

interface Props {
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  focus: TimelineFocus;
  onFocus: (f: TimelineFocus) => void;
  filters: FilterState;
  onFilters: (f: FilterState) => void;
  /** Pre-built, filtered directory tree of the changed files. */
  tree: TreeNode[];
  active: string | null;
  viewed: ReadonlySet<string>;
  collapsed: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  onToggleViewed: (path: string) => void;
  onSelect: (path: string) => void;
  onFileHistory: (path: string) => void;
  onSymbolHistory: (name: string) => void;
  timeline: CommitMeta[];
  fileHistory: { path: string; commits: CommitMeta[] } | null;
  symbolHistory: { name: string; hits: SymbolHistoryHit[] } | null;
  search: { query: string; results: SearchHit[] } | null;
  onSearch: (query: string, opts: SearchOptions) => void;
  searchFocus: number;
  onShowCommit: (sha: string) => void;
}

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "files", label: "Changed" },
  { id: "timeline", label: "Timeline" },
  { id: "search", label: "Search" },
];

function metaToItem(c: CommitMeta): CommitItem {
  return { sha: c.sha, shortSha: c.shortSha, date: c.date, subject: c.subject };
}

export function Sidebar(props: Props): JSX.Element {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${props.tab === t.id ? styles.tabActive : ""}`}
            onClick={() => props.onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {props.tab === "files" && (
        <>
          <FilterToggles filters={props.filters} onChange={props.onFilters} />
          <div className={styles.list}>
            {props.tree.length === 0 ? (
              <div className={styles.placeholder}>No changed files.</div>
            ) : (
              <FileTree
                nodes={props.tree}
                depth={0}
                active={props.active}
                viewed={props.viewed}
                collapsed={props.collapsed}
                onToggleDir={props.onToggleDir}
                onSelect={props.onSelect}
                onFileHistory={props.onFileHistory}
                onSymbolHistory={props.onSymbolHistory}
                onToggleViewed={props.onToggleViewed}
              />
            )}
          </div>
        </>
      )}

      {props.tab === "timeline" && (
        <div className={styles.list}>
          {props.focus === "recent" && (
            <CommitList
              title="Recent commits"
              items={props.timeline.map(metaToItem)}
              onSelect={props.onShowCommit}
            />
          )}
          {props.focus === "file" && (
            <CommitList
              title={props.fileHistory ? `History · ${props.fileHistory.path}` : "File history"}
              onClear={() => props.onFocus("recent")}
              items={(props.fileHistory?.commits ?? []).map(metaToItem)}
              onSelect={props.onShowCommit}
            />
          )}
          {props.focus === "symbol" && (
            <CommitList
              title={props.symbolHistory ? `Symbol · ${props.symbolHistory.name}` : "Symbol history"}
              onClear={() => props.onFocus("recent")}
              items={(props.symbolHistory?.hits ?? []).map((h) => ({
                sha: h.sha,
                shortSha: h.shortSha,
                date: h.date,
                subject: h.subject,
                badge: h.changeType,
              }))}
              onSelect={props.onShowCommit}
            />
          )}
        </div>
      )}

      {props.tab === "search" && (
        <SearchPanel
          search={props.search}
          onSearch={props.onSearch}
          onOpenFile={props.onFileHistory}
          focusSignal={props.searchFocus}
        />
      )}
    </aside>
  );
}
