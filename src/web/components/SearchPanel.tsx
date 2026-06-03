import { useEffect, useRef, useState } from "react";
import styles from "./SearchPanel.module.css";
import type { SearchHit } from "../../server/protocol";

export interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
}

interface Props {
  search: { query: string; results: SearchHit[] } | null;
  onSearch: (query: string, opts: SearchOptions) => void;
  onOpenFile: (path: string) => void;
  /** Bumps when `/` is pressed, to refocus the input even if already mounted. */
  focusSignal: number;
}

export function SearchPanel({ search, onSearch, onOpenFile, focusSignal }: Props): JSX.Element {
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSignal]);

  const run = (q: string, opts: SearchOptions): void => {
    if (q.trim()) onSearch(q.trim(), opts);
  };

  return (
    <div className={styles.panel}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(query, { regex, caseSensitive });
        }}
      >
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className={styles.opts}>
          <label className={styles.opt}>
            <input
              type="checkbox"
              checked={regex}
              onChange={(e) => {
                setRegex(e.target.checked);
                run(query, { regex: e.target.checked, caseSensitive });
              }}
            />
            regex
          </label>
          <label className={styles.opt}>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => {
                setCaseSensitive(e.target.checked);
                run(query, { regex, caseSensitive: e.target.checked });
              }}
            />
            case
          </label>
        </div>
      </form>

      <div className={styles.results}>
        {search && (
          <div className={styles.count}>
            {search.results.length} result(s) for “{search.query}”
          </div>
        )}
        {search?.results.map((r, i) => (
          <button key={`${r.path}:${r.line}:${i}`} className={styles.hit} onClick={() => onOpenFile(r.path)}>
            <div className={styles.loc}>
              <span className={styles.path} title={r.path}>
                {r.path}
              </span>
              <span className={styles.lineno}>:{r.line}</span>
            </div>
            <code className={styles.text}>{r.text.trim().slice(0, 200)}</code>
          </button>
        ))}
      </div>
    </div>
  );
}
