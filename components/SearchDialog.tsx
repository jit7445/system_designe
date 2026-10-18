"use client";

import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavModule } from "@/lib/nav-types";

export default function SearchDialog({ nav, open, onClose }: { nav: NavModule[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const entries = useMemo(() => nav.flatMap((m) => m.chapters.map((c) => ({ ...c, module: m.title }))), [nav]);
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? entries.filter((e) => words.every((w) => e.keywords.includes(w))) : entries;
  }, [query, entries]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  function go(slug: string) {
    onClose();
    router.push(`/learn/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) go(results[cursor].slug);
  }

  return (
    <div className="search-backdrop" onMouseDown={onClose}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search chapters" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            id="global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search chapters, systems, tags..."
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="search-results">
          {results.length === 0 && <li className="search-empty">No chapters match "{query}". Try a system like "chat" or a topic like "sharding".</li>}
          {results.map((r, i) => (
            <li key={r.slug}>
              <button className={i === cursor ? "active" : undefined} onMouseEnter={() => setCursor(i)} onClick={() => go(r.slug)}>
                <FileText size={16} aria-hidden />
                <span className="sr-title">{r.title}</span>
                <span className="sr-module">{r.module}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
