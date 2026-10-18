"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_KEY = "sd_theme";

// The site is dark-first: anything other than an explicit "light" renders dark.
export function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => setDark(isDarkTheme()), []);

  function toggle() {
    const next = isDarkTheme() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setDark(next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }

  return (
    <button className="nav-icon" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
      {dark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
