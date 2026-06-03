export interface FilterState {
  /** Ignore whitespace-only changes. */
  whitespace: boolean;
  /** Hide files whose changes are entirely within comments. */
  comments: boolean;
}

/** A file is hidden by the current filters. */
export function isFiltered(
  file: { whitespaceOnly: boolean; commentOnly: boolean },
  state: FilterState,
): boolean {
  if (state.whitespace && file.whitespaceOnly) return true;
  if (state.comments && file.commentOnly) return true;
  return false;
}
