'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** True after hydration; lets overlays portal into document.body without a server/client mismatch. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/**
 * Modal behaviour for a container element: focus moves in on open (to `[data-autofocus]` or the first control),
 * Tab/Shift+Tab cycle inside it, Esc closes, and focus returns to the opener on close.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void, closeOnEscape = true) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  const escape = useRef(closeOnEscape);
  useEffect(() => {
    close.current = onClose;
    escape.current = closeOnEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node;
    first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (escape.current) close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0]!;
      const tail = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return ref;
}
