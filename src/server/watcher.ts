import chokidar, { type FSWatcher } from "chokidar";
import type { IgnoreMatcher } from "./ignore.js";

export interface WatcherCallbacks {
  /** File added or changed (debounced per path). */
  onChange: (absPath: string) => void;
  /** File removed. */
  onRemove: (absPath: string) => void;
}

const DEBOUNCE_MS = 150;

export class ProjectWatcher {
  private watcher: FSWatcher;
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private root: string,
    matcher: IgnoreMatcher,
    private cb: WatcherCallbacks,
  ) {
    // chokidar v4 removed glob support — `ignored` must be a predicate.
    this.watcher = chokidar.watch(root, {
      ignored: (p: string) => matcher.isIgnored(p),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
    });

    this.watcher
      .on("add", (p) => this.schedule(p))
      .on("change", (p) => this.schedule(p))
      .on("unlink", (p) => {
        this.clear(p);
        this.cb.onRemove(p);
      });
  }

  private schedule(absPath: string): void {
    this.clear(absPath);
    this.timers.set(
      absPath,
      setTimeout(() => {
        this.timers.delete(absPath);
        this.cb.onChange(absPath);
      }, DEBOUNCE_MS),
    );
  }

  private clear(absPath: string): void {
    const t = this.timers.get(absPath);
    if (t) {
      clearTimeout(t);
      this.timers.delete(absPath);
    }
  }

  async close(): Promise<void> {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    await this.watcher.close();
  }
}
