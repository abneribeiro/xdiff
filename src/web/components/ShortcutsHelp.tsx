import styles from "./ShortcutsHelp.module.css";

interface Props {
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["j"], label: "Next file" },
  { keys: ["k"], label: "Previous file" },
  { keys: ["n"], label: "Next change in file" },
  { keys: ["p"], label: "Previous change in file" },
  { keys: ["v"], label: "Mark file viewed" },
  { keys: ["s"], label: "Toggle side-by-side / inline" },
  { keys: ["/"], label: "Search code" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["Esc"], label: "Close" },
];

/** Keyboard-shortcut cheat sheet, opened with `?`. */
export function ShortcutsHelp({ onClose }: Props): JSX.Element {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>Keyboard shortcuts</span>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className={styles.list}>
          {SHORTCUTS.map((s) => (
            <li key={s.label} className={styles.row}>
              <span className={styles.keys}>
                {s.keys.map((k) => (
                  <kbd key={k} className={styles.kbd}>
                    {k}
                  </kbd>
                ))}
              </span>
              <span className={styles.label}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
