"use client";

import { useEffect, type RefObject } from "react";

/**
 * Observes the chrome (sticky TopBar + TabNav stack) and writes its height
 * to `document.documentElement.style.--ph-chrome-h` so sticky table headers
 * can pin themselves immediately below it.
 */
export function useChromeHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (h: number) => {
      document.documentElement.style.setProperty(
        "--ph-chrome-h",
        `${Math.ceil(h)}px`,
      );
    };
    apply(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.height);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--ph-chrome-h");
    };
  }, [ref]);
}
