import { useEffect, useRef, useState } from "react";
import styles from "./BaselineSelector.module.css";
import type { CommitMeta } from "../../server/protocol";
import type { BaselineInfo } from "../hooks/useWebSocket";

interface Props {
  baseline: BaselineInfo | null;
  refs: { branches: string[]; commits: CommitMeta[] } | null;
  onOpen: () => void;
  onSelect: (ref: string, cached: boolean) => void;
}

export function BaselineSelector({ baseline, refs, onOpen, onSelect }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (): void => {
    if (!open) onOpen();
    setOpen((v) => !v);
  };

  const pick = (ref: string, cached = false): void => {
    onSelect(ref, cached);
    setOpen(false);
  };

  const current = baseline?.cached ? "index (staged)" : (baseline?.ref ?? "HEAD");

  return (
    <div className={styles.root} ref={rootRef}>
      <button className={styles.button} onClick={toggle}>
        <span className={styles.label}>baseline</span>
        <code className={styles.ref}>{current}</code>
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.menu}>
          <button className={styles.item} onClick={() => pick("HEAD")}>
            <code>HEAD</code>
            <span className={styles.hint}>last commit</span>
          </button>
          <button className={styles.item} onClick={() => pick("HEAD", true)}>
            <code>:index</code>
            <span className={styles.hint}>staged</span>
          </button>

          {refs?.branches.length ? <div className={styles.section}>branches</div> : null}
          {refs?.branches.map((b) => (
            <button key={b} className={styles.item} onClick={() => pick(b)}>
              <code>{b}</code>
            </button>
          ))}

          {refs?.commits.length ? <div className={styles.section}>recent commits</div> : null}
          {refs?.commits.map((c) => (
            <button key={c.sha} className={styles.item} onClick={() => pick(c.sha)}>
              <code className={styles.sha}>{c.shortSha}</code>
              <span className={styles.subject}>{c.subject}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
