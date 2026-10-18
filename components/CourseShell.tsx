"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { NavModule } from "@/lib/nav-types";
import CourseSidebar from "./CourseSidebar";

const SIDEBAR_KEY = "sd_sidebar_collapsed";

const ShellContext = createContext<{ openDrawer: () => void }>({ openDrawer: () => {} });

export function useCourseShell() {
  return useContext(ShellContext);
}

export default function CourseShell({ nav, children }: { nav: NavModule[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <ShellContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
      <div className={`course${collapsed ? " collapsed" : ""}`}>
        <div className={`drawer-scrim${drawerOpen ? " show" : ""}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`course-sidebar${drawerOpen ? " open" : ""}`} aria-label="Course chapters">
          <CourseSidebar nav={nav} onClose={() => setDrawerOpen(false)} />
        </aside>
        <button
          className="collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Show chapter sidebar" : "Hide chapter sidebar"}
          title={collapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div className="course-main">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}
