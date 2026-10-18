import { ArrowRight, ChevronDown, Code2, Network } from "lucide-react";
import Link from "next/link";
import Mermaid from "@/components/Mermaid";
import ModuleIcon from "@/components/ModuleIcon";
import { CORE_CONCEPTS, FAQ, LESSON_PARTS, PHASES, TRACK_DIAGRAMS } from "@/lib/course";
import { MODULES, TOTAL_CHAPTERS, TRACKS, modulesInTrack } from "@/lib/curriculum";
import { QUESTIONS } from "@/lib/questions";

const SAMPLE_TRADEOFF = QUESTIONS.find((q) => q.slug === "payment-system")!.tradeoffs[1];

export default function HomePage() {
  const firstChapter = MODULES[0].chapters[0].slug;
  const hldCount = QUESTIONS.length;

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-glow" aria-hidden />
        <span className="hero-badge">
          {TOTAL_CHAPTERS} chapters · basic to advanced · free
        </span>
        <h1>
          Master <span className="grad">System Design</span>
          <br />
          Interviews
        </h1>
        <p className="hero-sub">
          A structured path through fundamentals, <b>{hldCount} HLD interview questions</b> with full <b>LLD</b>, object-oriented
          design problems and advanced distributed systems, with an architecture diagram in every lesson.
        </p>
        <div className="hero-ctas">
          <Link href={`/learn/${firstChapter}`} className="btn btn-primary">
            Start learning <ArrowRight size={16} aria-hidden />
          </Link>
          <a href="#questions" className="btn btn-ghost">
            Browse questions
          </a>
        </div>
      </section>

      <section className="home-section" id="tracks">
        <div className="track-grid">
          {TRACKS.map((t) => {
            const mods = modulesInTrack(t.id);
            const count = mods.reduce((n, m) => n + m.chapters.length, 0);
            return (
              <Link key={t.id} href={`/learn/${mods[0].chapters[0].slug}`} className="track-card">
                <div className="track-thumb">
                  <Mermaid chart={TRACK_DIAGRAMS[t.id]} compact legend={false} />
                </div>
                <div className="track-info">
                  <div className="track-top">
                    <span className="pill">{t.level}</span>
                    <span className="track-count">{count} chapters</span>
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.blurb}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-section patterns" id="questions">
        <div className="patterns-copy">
          <h2>
            Learn the <span className="grad">building blocks</span>, not just answers
          </h2>
          <p>
            Interview questions repeat the same ideas: caching, fan-out, sharding, idempotency, queues. Learn each block once,
            then practice assembling them under time pressure.
          </p>
        </div>
        <div className="patterns-panels">
          <div className="pattern-panel">
            <div className="pp-head">
              <span className="pp-icon">
                <Network size={18} aria-hidden />
              </span>
              <h3>HLD interview questions</h3>
              <span className="pill accent">{hldCount} systems</span>
            </div>
            <div className="chip-cloud">
              {QUESTIONS.map((q) => (
                <Link key={q.slug} href={`/learn/${q.slug}`} className="chip-link">
                  {q.title}
                </Link>
              ))}
            </div>
          </div>
          <div className="pattern-panel">
            <div className="pp-head">
              <span className="pp-icon sky">
                <Code2 size={18} aria-hidden />
              </span>
              <h3>Core concepts</h3>
              <span className="pill sky">{CORE_CONCEPTS.length} building blocks</span>
            </div>
            <div className="chip-cloud">
              {CORE_CONCEPTS.map((c) => (
                <span key={c.term} className="chip-link static">
                  {c.term}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title">
          <h2>Every HLD lesson, the same seven steps</h2>
          <p>The order you study in is the order you should speak in during the interview.</p>
        </div>
        <div className="features">
          <ol className="feature-list">
            {LESSON_PARTS.map((p, i) => (
              <li key={p.title}>
                <span className="feature-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <b>{p.title}</b>
                  <span>{p.body}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="feature-preview">
            <div className="fp-label">From the Payment System lesson</div>
            <div className="trade">
              <div className="trade-q">{SAMPLE_TRADEOFF.question}</div>
              <div className="trade-opts">
                <div className="trade-opt">
                  <span className="lbl">Option A</span>
                  {SAMPLE_TRADEOFF.a}
                </div>
                <div className="trade-opt">
                  <span className="lbl">Option B</span>
                  {SAMPLE_TRADEOFF.b}
                </div>
              </div>
              <div className="trade-verdict">
                <b>Pick:</b> {SAMPLE_TRADEOFF.verdict}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title">
          <h2>The curriculum</h2>
          <p>
            {MODULES.length} modules, ordered from basic to advanced.
          </p>
        </div>
        <div className="module-grid">
          {MODULES.map((m) => (
            <Link key={m.id} href={`/learn/${m.chapters[0].slug}`} className="module-card">
              <span className="module-icon">
                <ModuleIcon name={m.icon} />
              </span>
              <span className="mc-body">
                <b>{m.title}</b>
                <span>
                  {m.chapters.length} chapters · {m.level}
                </span>
              </span>
              <ArrowRight size={16} aria-hidden className="mc-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-title">
          <h2>An 8-week plan</h2>
          <p>6-8 hours a week is enough if you practice instead of only reading.</p>
        </div>
        <div className="phases">
          {PHASES.map((p) => (
            <div className="phase" key={p.weeks}>
              <div className="phase-top">
                <span className="pill accent">{p.weeks}</span>
                <h3>{p.title}</h3>
              </div>
              <ul className="clean">
                {p.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section faq-section">
        <div className="section-title">
          <h2>Frequently asked questions</h2>
        </div>
        <div className="faq">
          {FAQ.map((f, i) => (
            <details key={f.q} className="faq-item">
              <summary>
                <span className="faq-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="faq-q">{f.q}</span>
                <ChevronDown size={18} aria-hidden className="faq-chevron" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="logo-text">
            SysDesign<b>Prep</b>
          </span>
          <p>System design interview preparation, from basic to advanced.</p>
        </div>
        <div className="footer-cols">
          {TRACKS.map((t) => (
            <div key={t.id}>
              <h4>{t.title}</h4>
              <ul>
                {modulesInTrack(t.id).map((m) => (
                  <li key={m.id}>
                    <Link href={`/learn/${m.chapters[0].slug}`}>{m.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
