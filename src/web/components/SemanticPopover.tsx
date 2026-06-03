import styles from "./SemanticPopover.module.css";
import type { SymbolChange } from "../../server/protocol";
import { tagFor } from "../lib/symbols";

interface Props {
  symbols: SymbolChange[];
  top: number;
  left: number;
  onSymbolClick: (name: string) => void;
}

export function SemanticPopover({ symbols, top, left, onSymbolClick }: Props): JSX.Element {
  return (
    <div className={styles.popover} style={{ top, left }} onClick={(e) => e.stopPropagation()}>
      <div className={styles.heading}>Symbols changed</div>
      {symbols.map((s) => (
        <button
          key={`${s.name}:${s.kind}`}
          className={styles.symbol}
          title="View this symbol's history"
          onClick={() => onSymbolClick(s.name)}
        >
          <span className={`${styles.tag} ${styles[tagFor(s.kind)]}`}>{tagFor(s.kind)}</span>
          <span className={styles.name}>{s.name}</span>
          {s.isPublic && <span className={styles.public}>pub</span>}
          {s.signatureChanged && <span className={styles.sig}>sig</span>}
          <span className={`${styles.change} ${styles[s.changeType]}`}>{s.changeType}</span>
        </button>
      ))}
    </div>
  );
}
