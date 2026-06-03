import styles from "./CommitList.module.css";

export interface CommitItem {
  sha: string;
  shortSha: string;
  date: string;
  subject: string;
  badge?: string;
}

interface Props {
  title: string;
  items: CommitItem[];
  onSelect: (sha: string) => void;
  onClear?: () => void;
}

export function CommitList({ title, items, onSelect, onClear }: Props): JSX.Element {
  return (
    <div>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {onClear && (
          <button className={styles.clear} onClick={onClear}>
            ✕
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>Nothing found.</div>
      ) : (
        items.map((c) => (
          <button key={c.sha + (c.badge ?? "")} className={styles.row} onClick={() => onSelect(c.sha)}>
            <div className={styles.line}>
              <code className={styles.sha}>{c.shortSha}</code>
              {c.badge && <span className={`${styles.badge} ${styles[c.badge] ?? ""}`}>{c.badge}</span>}
              <span className={styles.date}>{c.date.slice(0, 10)}</span>
            </div>
            <div className={styles.subject}>{c.subject}</div>
          </button>
        ))
      )}
    </div>
  );
}
