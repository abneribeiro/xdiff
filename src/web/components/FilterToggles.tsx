import styles from "./FilterToggles.module.css";
import type { FilterState } from "../ui/filters";

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterToggles({ filters, onChange }: Props): JSX.Element {
  return (
    <div className={styles.filters}>
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={filters.whitespace}
          onChange={(e) => onChange({ ...filters, whitespace: e.target.checked })}
        />
        Ignore whitespace
      </label>
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={filters.comments}
          onChange={(e) => onChange({ ...filters, comments: e.target.checked })}
        />
        Ignore comment-only changes
      </label>
    </div>
  );
}
