"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sd_solved";

interface ProgressValue {
  solved: Set<string>;
  isSolved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  reset: () => void;
}

const ProgressContext = createContext<ProgressValue | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [solved, setSolved] = useState<Set<string>>(new Set());

  // Storage can throw in private windows or when site data is blocked.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSolved(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      setSolved((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const next = new Set<string>();
    persist(next);
    setSolved(next);
  }, [persist]);

  const value = useMemo<ProgressValue>(
    () => ({ solved, isSolved: (slug) => solved.has(slug), toggle, reset }),
    [solved, toggle, reset],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}
