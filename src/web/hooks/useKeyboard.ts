import { useEffect, useRef } from "react";

export type KeyHandler = (e: KeyboardEvent) => void;

/** True when the user is typing into a form control — skip global shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Binds a map of `key → handler` to window keydown. Handlers fire only when the
 * user isn't typing in a field (Escape is always delivered, to close overlays).
 * Latest handlers are read through a ref so the listener stays stable.
 */
export function useKeyboard(handlers: Record<string, KeyHandler>): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser/OS combos alone
      if (isTyping(e.target) && e.key !== "Escape") return;
      const handler = ref.current[e.key];
      if (handler) handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
