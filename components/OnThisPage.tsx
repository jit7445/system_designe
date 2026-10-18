"use client";

import { useEffect, useState } from "react";

const HEADER_OFFSET = 120;

export default function OnThisPage({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [progress, setProgress] = useState(0);

  // Diagrams render after the browser's initial jump to a #section and push the target down,
  // so keep the target pinned while the article resizes, until the reader scrolls on their own.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const article = document.getElementById("lesson-article");
    if (!id || !article) return;
    let active = true;
    const pin = () => active && document.getElementById(id)?.scrollIntoView({ block: "start" });
    const stop = () => {
      active = false;
      observer.disconnect();
    };
    const observer = new ResizeObserver(pin);
    observer.observe(article);
    const events = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    events.forEach((e) => window.addEventListener(e, stop, { once: true, passive: true }));
    const timer = window.setTimeout(stop, 5000);
    return () => {
      stop();
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, []);

  useEffect(() => {
    function onScroll() {
      const article = document.getElementById("lesson-article");
      if (article) {
        const rect = article.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight + HEADER_OFFSET;
        const read = Math.min(Math.max(HEADER_OFFSET - rect.top, 0), Math.max(scrollable, 1));
        setProgress(scrollable > 0 ? Math.round((read / scrollable) * 100) : 100);
      }
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= HEADER_OFFSET + 10) current = s.id;
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  return (
    <aside className="toc" aria-label="On this page">
      <div className="toc-progress">
        <div className="toc-progress-row">
          <span>Reading progress</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="toc-title">On this page</div>
      <ul>
        {sections.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={s.id === active ? "active" : undefined}>
              <span className="toc-num">{i + 1}.</span> {s.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
