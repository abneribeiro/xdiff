import styles from "./Footer.module.css";

interface Props {
  connected: boolean;
  /** Number of changed files currently in view. */
  changedCount: number;
  /** How many of those are marked viewed. */
  viewedCount: number;
  /** Epoch ms of the most recent live change, or null if none yet. */
  lastUpdateAt: number | null;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false });
}

/** Status bar pinned to the bottom — connection, change count, ws host, last save. */
export function Footer({ connected, changedCount, viewedCount, lastUpdateAt }: Props): JSX.Element {
  return (
    <footer className={styles.footer}>
      <span className={styles.item}>
        <span className={`${styles.dot} ${connected ? styles.live : styles.offline}`} />
        {connected ? "watching" : "reconnecting…"}
        <span className={styles.dim}> · {changedCount} changed</span>
        {changedCount > 0 && (
          <span className={styles.dim}>
            {" "}
            · {viewedCount}/{changedCount} viewed
          </span>
        )}
      </span>
      <span className={styles.item}>{location.host}</span>
      <span className={styles.right}>
        press <kbd>?</kbd> for shortcuts
        {lastUpdateAt && <> · last save {clock(lastUpdateAt)}</>}
      </span>
    </footer>
  );
}
