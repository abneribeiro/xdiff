import type { FileDiff } from "../../server/protocol";

export interface Totals {
  files: number;
  added: number;
  removed: number;
  apiBreaks: number;
}

export function totals(files: FileDiff[]): Totals {
  let added = 0;
  let removed = 0;
  let apiBreaks = 0;
  for (const f of files) {
    added += f.stats.added;
    removed += f.stats.removed;
    if (f.publicSignatureChanged) apiBreaks++;
  }
  return { files: files.length, added, removed, apiBreaks };
}
