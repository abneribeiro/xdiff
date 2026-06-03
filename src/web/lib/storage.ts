// Tiny localStorage wrapper for persisting UI preferences. All reads/writes are
// guarded so a disabled or full storage never breaks the app.

const PREFIX = "xdiff:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — preferences just won't persist */
  }
}
