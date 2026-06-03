import { diffLines } from "diff";

/** 1-based inclusive line range in the *modified* file. */
export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface DiffResult {
  added: number;
  removed: number;
  /** Ranges in the modified file touched by additions, plus anchor lines for deletions. */
  changedRanges: LineRange[];
  /** True when texts differ only by whitespace. */
  whitespaceOnly: boolean;
  /** True when there is no textual difference at all. */
  identical: boolean;
}

export function computeDiff(original: string, modified: string): DiffResult {
  if (original === modified) {
    return { added: 0, removed: 0, changedRanges: [], whitespaceOnly: false, identical: true };
  }

  const parts = diffLines(original, modified);
  let added = 0;
  let removed = 0;
  let newLine = 1; // current line in the modified file
  const changedRanges: LineRange[] = [];

  for (const part of parts) {
    const count = part.count ?? part.value.split("\n").length - 1;
    if (part.added) {
      added += count;
      changedRanges.push({ startLine: newLine, endLine: newLine + count - 1 });
      newLine += count;
    } else if (part.removed) {
      removed += count;
      // Anchor the deletion at the current position in the new file so the
      // semantic layer can attribute it to the surrounding symbol.
      changedRanges.push({ startLine: newLine, endLine: newLine });
    } else {
      newLine += count;
    }
  }

  return {
    added,
    removed,
    changedRanges,
    whitespaceOnly: stripWs(original) === stripWs(modified),
    identical: false,
  };
}

function stripWs(s: string): string {
  return s.replace(/\s+/g, "");
}
