"use client";

import { ArrowLeft, ChevronDown, CircleCheck, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { NavModule } from "@/lib/nav-types";
import ModuleIcon from "./ModuleIcon";
import { useProgress } from "./ProgressProvider";

export default function CourseSidebar({ nav, onClose }: { nav: NavModule[]; onClose: () => void }) {
  const pathname = usePathname();
  const { isSolved } = useProgress();
  const [filter, setFilter] = useState("");
  const currentSlug = pathname.split("/").pop() ?? "";
  const currentModule = nav.find((m) => m.chapters.some((c) => c.slug === currentSlug))?.id;
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set([currentModule ?? nav[0]?.id]));

  useEffect(() => {
    if (currentModule) setOpenModules((s) => (s.has(currentModule) ? s : new Set(s).add(currentModule)));
  }, [currentModule]);

  const query = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      nav
        .map((m) => ({ ...m, matches: query ? m.chapters.filter((c) => c.keywords.includes(query)) : m.chapters }))
        .filter((m) => m.matches.length > 0),
    [nav, query],
  );

  const total = nav.reduce((n, m) => n + m.chapters.length, 0);
  const done = nav.reduce((n, m) => n + m.chapters.filter((c) => isSolved(c.slug)).length, 0);
  const pct = Math.round((done / total) * 100);

  function toggleModule(id: string) {
    setOpenModules((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="sidebar-inner">
      <div className="sidebar-head">
        <div className="sidebar-top-row">
          <Link href="/" className="back-link">
            <ArrowLeft size={14} aria-hidden /> Back to Home
          </Link>
          <button className="drawer-close" onClick={onClose} aria-label="Close chapters">
            <X size={18} />
          </button>
        </div>
        <h2 className="course-title">System Design: Basic to Advanced</h2>
        <div className="course-progress">
          <span className="cp-pct">
            {pct}
            <small>%</small>
          </span>
          <span className="cp-count">
            {done}/{total}
          </span>
        </div>
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <label className="sidebar-search">
          <Search size={16} aria-hidden />
          <input id="chapter-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chapters..." />
        </label>
      </div>

      <nav className="module-list">
        {visible.length === 0 && <p className="module-empty">No chapters match "{filter}".</p>}
        {visible.map((m) => {
          const moduleDone = m.chapters.filter((c) => isSolved(c.slug)).length;
          const complete = moduleDone === m.chapters.length;
          const open = query.length > 0 || openModules.has(m.id);
          return (
            <div className={`module${open ? " open" : ""}`} key={m.id}>
              <button className="module-head" onClick={() => toggleModule(m.id)} aria-expanded={open}>
                <span className="module-icon">
                  <ModuleIcon name={m.icon} size={22} />
                </span>
                <span className="module-title">{m.title}</span>
                <span className={`module-ring${complete ? " complete" : ""}`} aria-hidden>
                  {complete && <CircleCheck size={14} />}
                </span>
                <span className="module-count">
                  {moduleDone}/{m.chapters.length}
                </span>
                <ChevronDown size={14} className="module-chevron" aria-hidden />
              </button>
              {open && (
                <ul className="chapter-list">
                  {m.matches.map((c) => {
                    const active = c.slug === currentSlug;
                    const isDone = isSolved(c.slug);
                    return (
                      <li key={c.slug}>
                        <Link href={`/learn/${c.slug}`} className={`chapter-link${active ? " active" : ""}${isDone ? " done" : ""}`} aria-current={active ? "page" : undefined}>
                          {isDone ? <CircleCheck size={16} aria-label="Completed" /> : <FileText size={16} aria-hidden />}
                          <span className="cl-title">{c.title}</span>
                          {c.level && <span className={`dot ${c.level}`} title={c.level} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
