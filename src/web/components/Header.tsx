import styles from "./Header.module.css";
import type { FileDiff } from "../../server/protocol";
import type { BaselineInfo, CommitView } from "../hooks/useWebSocket";
import { totals } from "../lib/metrics";
import { BaselineSelector } from "./BaselineSelector";

interface Props {
  baseline: BaselineInfo | null;
  refs: { branches: string[]; commits: import("../../server/protocol").CommitMeta[] } | null;
  files: FileDiff[];
  sideBySide: boolean;
  onToggleSideBySide: () => void;
  onRequestRefs: () => void;
  onSelectBaseline: (ref: string, cached: boolean) => void;
  commitView: CommitView | null;
  onBackToLive: () => void;
}

export function Header(props: Props): JSX.Element {
  const t = totals(props.files);
  const isGit = props.baseline?.mode === "git";

  return (
    <header className={styles.header}>
      <span className={styles.brand}>xdiff</span>

      {props.commitView ? (
        <div className={styles.commitBanner}>
          <span className={styles.commitLabel}>commit</span>
          <code className={styles.commitSubject}>{props.commitView.subject}</code>
          <button className={styles.back} onClick={props.onBackToLive}>
            ← live
          </button>
        </div>
      ) : (
        isGit && (
          <BaselineSelector
            baseline={props.baseline}
            refs={props.refs}
            onOpen={props.onRequestRefs}
            onSelect={props.onSelectBaseline}
          />
        )
      )}

      <div className={styles.metrics}>
        <span className={styles.metric}>
          <span className={styles.dim}>files</span>
          <strong>{t.files}</strong>
        </span>
        <span className={styles.metric}>
          <span className={styles.add}>+{t.added}</span>
          <span className={styles.rem}>−{t.removed}</span>
        </span>
        {t.apiBreaks > 0 && <span className={styles.apiAlert}>⚠ {t.apiBreaks} public API</span>}
      </div>

      <button
        className={`${styles.toggle} ${props.sideBySide ? styles.toggleOn : ""}`}
        onClick={props.onToggleSideBySide}
        title="Toggle side-by-side / inline"
      >
        {props.sideBySide ? "Side-by-side" : "Inline"}
      </button>
    </header>
  );
}
