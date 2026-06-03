import { useRef, useState } from "react";
import styles from "./FileRow.module.css";
import type { FileDiff } from "../../server/protocol";
import { symbolSummary } from "../lib/symbols";
import { SemanticPopover } from "./SemanticPopover";

interface Props {
  file: FileDiff;
  active: boolean;
  viewed: boolean;
  /** Left padding (px) so nested files align under their folder. */
  indent: number;
  onSelect: () => void;
  onFileHistory: () => void;
  onSymbolHistory: (name: string) => void;
  onToggleViewed: () => void;
}

/** Up-to-5 proportional add/remove blocks, GitHub-style. */
function StatBar({ added, removed }: { added: number; removed: number }): JSX.Element {
  const total = added + removed;
  const greens = total === 0 ? 0 : Math.round((added / total) * 5);
  const reds = total === 0 ? 0 : Math.min(5 - greens, Math.ceil((removed / total) * 5));
  const blanks = 5 - greens - reds;
  return (
    <span className={styles.bar} title={`+${added} −${removed}`}>
      {Array.from({ length: greens }, (_, i) => (
        <span key={`g${i}`} className={`${styles.block} ${styles.blockAdd}`} />
      ))}
      {Array.from({ length: reds }, (_, i) => (
        <span key={`r${i}`} className={`${styles.block} ${styles.blockRem}`} />
      ))}
      {Array.from({ length: Math.max(0, blanks) }, (_, i) => (
        <span key={`b${i}`} className={`${styles.block} ${styles.blockNone}`} />
      ))}
    </span>
  );
}

export function FileRow({
  file,
  active,
  viewed,
  indent,
  onSelect,
  onFileHistory,
  onSymbolHistory,
  onToggleViewed,
}: Props): JSX.Element {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const enter = (): void => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.top, left: rect.right + 8 });
    setHover(true);
  };

  const copyPath = (e: React.MouseEvent): void => {
    e.stopPropagation();
    navigator.clipboard?.writeText(file.path).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };

  const summary = symbolSummary(file);
  const showPopover = hover && file.symbols.length > 0 && anchor;
  const basename = file.path.slice(file.path.lastIndexOf("/") + 1);

  return (
    <div
      ref={rowRef}
      className={`${styles.row} ${active ? styles.active : ""} ${viewed ? styles.viewed : ""}`}
      style={{ paddingLeft: 14 + indent }}
      onClick={onSelect}
      onMouseEnter={enter}
      onMouseLeave={() => setHover(false)}
    >
      <div className={styles.top}>
        <input
          type="checkbox"
          className={styles.viewedBox}
          checked={viewed}
          title="Mark as viewed"
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleViewed}
        />
        <span className={styles.path} title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
          {file.oldPath ? `${file.oldPath} → ${basename}` : file.path}
        </span>
        <button className={styles.iconBtn} title="Copy path" onClick={copyPath}>
          {copied ? "✓" : "⧉"}
        </button>
        <button
          className={styles.iconBtn}
          title="File history"
          onClick={(e) => {
            e.stopPropagation();
            onFileHistory();
          }}
        >
          ⏱
        </button>
      </div>

      <div className={styles.meta}>
        {file.skipped ? (
          <span className={styles.skipped}>{file.skipped === "binary" ? "binary file" : "file too large"}</span>
        ) : (
          <>
            <span className={styles.counts}>
              <span className={styles.add}>+{file.stats.added}</span>
              <span className={styles.rem}>−{file.stats.removed}</span>
            </span>
            <StatBar added={file.stats.added} removed={file.stats.removed} />
          </>
        )}
        {file.oldPath && <span className={styles.tag}>renamed</span>}
        {summary && (
          <span className={styles.summary}>
            {summary}
            {file.publicSignatureChanged && <span className={styles.pub}> ⚠ API</span>}
          </span>
        )}
      </div>

      {showPopover && (
        <SemanticPopover
          symbols={file.symbols}
          top={anchor.top}
          left={anchor.left}
          onSymbolClick={onSymbolHistory}
        />
      )}
    </div>
  );
}
