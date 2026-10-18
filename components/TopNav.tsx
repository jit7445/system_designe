"use client";

import { CircleCheck, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavModule } from "@/lib/nav-types";
import { useProgress } from "./ProgressProvider";
import SearchDialog from "./SearchDialog";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/learn/introduction", label: "Learn", match: "/learn" },
  { href: "/#questions", label: "Interview Questions" },
  { href: "/learn/oop-fundamentals", label: "LLD" },
  { href: "/learn/roadmap", label: "Roadmap" },
];

export default function TopNav({ nav }: { nav: NavModule[] }) {
  const pathname = usePathname();
  const { isSolved } = useProgress();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const all = nav.flatMap((m) => m.chapters);
  const done = all.filter((c) => isSolved(c.slug)).length;

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="topnav">
        <Link href="/" className="logo" aria-label="SysDesign Prep home">
          <span className="logo-mark" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="logo-text">
            SysDesign<b>Prep</b>
          </span>
        </Link>

        <nav className={`nav-links${menuOpen ? " open" : ""}`} aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={l.match && pathname.startsWith(l.match) ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="nav-spacer" />

        <button className="nav-search" onClick={() => setSearchOpen(true)} aria-label="Search chapters">
          <Search size={16} aria-hidden />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <span className="nav-progress" title="Chapters completed">
          <CircleCheck size={16} aria-hidden />
          {done}/{all.length}
        </span>
        <ThemeToggle />
        <button className="nav-icon nav-menu" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>
      <SearchDialog nav={nav} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
