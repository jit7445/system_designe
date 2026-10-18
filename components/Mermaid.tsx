"use client";

import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isDarkTheme } from "./ThemeToggle";

type NodeKind = "client" | "service" | "database" | "cache" | "queue";

const KIND_LABEL: Record<NodeKind, string> = {
  client: "Client",
  service: "Service",
  database: "Database / storage",
  cache: "Cache / index / edge",
  queue: "Queue / coordinator",
};

// The data encodes component type through Mermaid node shapes; longer openers must be tried first.
const NODE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)\s*(\(\[|\[\(|\{\{|\[\[|\[)"/g;
const OPENER_KIND: Record<string, NodeKind> = {
  "([": "client",
  "[(": "database",
  "{{": "cache",
  "[[": "queue",
  "[": "service",
};

// Mermaid cannot read CSS custom properties, so palettes are literal hex values.
const PALETTE: Record<"dark" | "light", Record<NodeKind, { fill: string; stroke: string }>> = {
  dark: {
    client: { fill: "#0b2230", stroke: "#38bdf8" },
    service: { fill: "#0b2616", stroke: "#22c55e" },
    database: { fill: "#2a1c05", stroke: "#f59e0b" },
    cache: { fill: "#2b0f20", stroke: "#f472b6" },
    queue: { fill: "#1c1636", stroke: "#a78bfa" },
  },
  light: {
    client: { fill: "#e0f2fe", stroke: "#0369a1" },
    service: { fill: "#dcfce7", stroke: "#15803d" },
    database: { fill: "#fef3c7", stroke: "#b45309" },
    cache: { fill: "#fce7f3", stroke: "#be185d" },
    queue: { fill: "#ede9fe", stroke: "#6d28d9" },
  },
};

// Covers flowcharts plus the sequence and class diagram variables Mermaid's base theme reads.
const BASE_THEME = {
  dark: {
    background: "#0a0d12",
    lineColor: "#6b7685",
    textColor: "#c9d1d9",
    edgeLabelBackground: "#0a0d12",
    primaryColor: "#0b2616",
    primaryBorderColor: "#22c55e",
    primaryTextColor: "#d6f5e0",
    secondaryColor: "#0b2230",
    tertiaryColor: "#11161d",
    mainBkg: "#0b2616",
    nodeBorder: "#22c55e",
    classText: "#d6f5e0",
    actorBkg: "#0b2230",
    actorBorder: "#38bdf8",
    actorTextColor: "#e2e8f0",
    actorLineColor: "#3b4552",
    signalColor: "#9aa5b1",
    signalTextColor: "#e2e8f0",
    labelBoxBkgColor: "#1c1636",
    labelBoxBorderColor: "#a78bfa",
    labelTextColor: "#e2e8f0",
    loopTextColor: "#c4b5fd",
    noteBkgColor: "#2a1c05",
    noteBorderColor: "#f59e0b",
    noteTextColor: "#fde68a",
    activationBkgColor: "#15301f",
    activationBorderColor: "#22c55e",
  },
  light: {
    background: "#f8fafc",
    lineColor: "#8a94a3",
    textColor: "#334155",
    edgeLabelBackground: "#f8fafc",
    primaryColor: "#dcfce7",
    primaryBorderColor: "#15803d",
    primaryTextColor: "#14532d",
    secondaryColor: "#e0f2fe",
    tertiaryColor: "#f1f5f9",
    mainBkg: "#dcfce7",
    nodeBorder: "#15803d",
    classText: "#14532d",
    actorBkg: "#e0f2fe",
    actorBorder: "#0369a1",
    actorTextColor: "#0c4a6e",
    actorLineColor: "#cbd5e1",
    signalColor: "#64748b",
    signalTextColor: "#1e293b",
    labelBoxBkgColor: "#ede9fe",
    labelBoxBorderColor: "#6d28d9",
    labelTextColor: "#3b0764",
    loopTextColor: "#5b21b6",
    noteBkgColor: "#fef3c7",
    noteBorderColor: "#b45309",
    noteTextColor: "#78350f",
    activationBkgColor: "#dcfce7",
    activationBorderColor: "#15803d",
  },
};

const isFlowchart = (chart: string) => /^\s*(graph|flowchart)\b/.test(chart);

function classify(chart: string) {
  const kinds = new Map<string, NodeKind>();
  if (!isFlowchart(chart)) return kinds;
  for (const m of chart.matchAll(NODE_PATTERN)) {
    if (!kinds.has(m[1])) kinds.set(m[1], OPENER_KIND[m[2]]);
  }
  return kinds;
}

function styledChart(chart: string, kinds: Map<string, NodeKind>, mode: "dark" | "light") {
  const lines = [chart];
  const byKind = new Map<NodeKind, string[]>();
  kinds.forEach((kind, id) => byKind.set(kind, [...(byKind.get(kind) ?? []), id]));
  byKind.forEach((ids, kind) => {
    const { fill, stroke } = PALETTE[mode][kind];
    lines.push(`  classDef k_${kind} fill:${fill},stroke:${stroke},color:${stroke},stroke-width:1.5px`);
    lines.push(`  class ${ids.join(",")} k_${kind}`);
  });
  return lines.join("\n");
}

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2];

function DiagramViewer({ svg, naturalWidth, onClose }: { svg: string; naturalWidth: number; onClose: () => void }) {
  const [zoom, setZoom] = useState(2);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    const el = bodyRef.current?.querySelector("svg");
    if (!el) return;
    el.style.maxWidth = "none";
    el.style.width = `${Math.round(naturalWidth * ZOOM_STEPS[zoom])}px`;
    el.style.height = "auto";
  }, [zoom, naturalWidth, svg]);

  return (
    <div className="viewer-backdrop" onMouseDown={onClose}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label="Diagram viewer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="viewer-bar">
          <button onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(ZOOM_STEPS[zoom] * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} disabled={zoom === ZOOM_STEPS.length - 1} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="viewer-close" onClick={onClose} aria-label="Close diagram viewer">
            <X size={18} />
          </button>
        </div>
        <div className="viewer-body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}

export default function Mermaid({ chart, legend = true, compact = false }: { chart: string; legend?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [mode, setMode] = useState<"dark" | "light" | null>(null);
  const [failed, setFailed] = useState(false);
  const [rendered, setRendered] = useState<{ svg: string; width: number } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const kinds = useMemo(() => classify(chart), [chart]);
  const present = useMemo(() => (Object.keys(KIND_LABEL) as NodeKind[]).filter((k) => [...kinds.values()].includes(k)), [kinds]);

  useEffect(() => {
    const sync = () => setMode(isDarkTheme() ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          flowchart: { curve: "basis", padding: compact ? 8 : 14, nodeSpacing: compact ? 30 : 46, rankSpacing: compact ? 34 : 52 },
          sequence: { mirrorActors: false, actorMargin: 56, messageMargin: 34, boxMargin: 8, noteMargin: 10 },
          class: { padding: 10 },
          themeVariables: { ...BASE_THEME[mode], fontSize: compact ? "12px" : "13px" },
        });
        // useId output contains colons, which are not valid in the DOM id Mermaid creates.
        const id = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${mode}`;
        const { svg } = await mermaid.render(id, styledChart(chart, kinds, mode));
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          const width = ref.current.querySelector("svg")?.viewBox.baseVal.width ?? 0;
          // The viewer reuses this markup, so the diagram's DOM id must not appear twice on the page.
          setRendered({ svg: svg.replaceAll(id, `${id}-full`), width });
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, kinds, mode, reactId, compact]);

  return (
    <figure className={`diagram-panel${compact ? " compact" : ""}`}>
      {failed ? (
        <pre className="diagram-fallback">{chart}</pre>
      ) : (
        <div className="diagram" ref={ref} role="img" aria-label="Architecture diagram" />
      )}
      {!compact && rendered && (
        <button className="diagram-expand" onClick={() => setViewerOpen(true)} aria-label="Open diagram fullscreen">
          <Maximize2 size={13} aria-hidden /> Fullscreen
        </button>
      )}
      {viewerOpen && rendered && <DiagramViewer svg={rendered.svg} naturalWidth={rendered.width} onClose={() => setViewerOpen(false)} />}
      {legend && !compact && present.length > 0 && (
        <figcaption className="diagram-legend">
          {present.map((k) => (
            <span key={k} className={`legend-item k-${k}`}>
              <i />
              {KIND_LABEL[k]}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
