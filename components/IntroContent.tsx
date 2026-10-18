import Link from "next/link";
import { CORE_CONCEPTS, FRAMEWORK, LESSON_PARTS, PHASES } from "@/lib/course";
import { MODULES, TRACKS, modulesInTrack } from "@/lib/curriculum";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="lesson-h2">
      {children}
    </h2>
  );
}

function Introduction() {
  return (
    <>
      <H2 id="about">What this course is</H2>
      <p className="prose-p">
        A structured path from the basics of how the web works to senior-level distributed systems, built around how
        system design interviews are actually run. Every chapter is short enough to finish in one sitting and ends with
        what an interviewer expects you to say.
      </p>
      <p className="prose-p">
        It covers both halves of the interview loop: <b>high-level design (HLD)</b>, where you draw services, databases
        and queues, and <b>low-level design (LLD)</b>, where you model classes, relationships and code.
      </p>

      <H2 id="tracks">The five tracks</H2>
      <div className="track-list">
        {TRACKS.map((t, i) => {
          const mods = modulesInTrack(t.id);
          const count = mods.reduce((n, m) => n + m.chapters.length, 0);
          const first = mods[0]?.chapters[0];
          return (
            <Link key={t.id} href={first ? `/learn/${first.slug}` : "/"} className="track-row">
              <span className="track-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="track-body">
                <b>{t.title}</b>
                <span>{t.blurb}</span>
              </span>
              <span className="track-meta">
                <span className="pill">{t.level}</span>
                <span className="track-count">{count} chapters</span>
              </span>
            </Link>
          );
        })}
      </div>

      <H2 id="lesson-parts">How an HLD lesson is built</H2>
      <p className="prose-p">Every one of the 20 interview questions follows the same order, which is also the order you should speak in during an interview:</p>
      <ol className="steps-list">
        {LESSON_PARTS.map((p) => (
          <li key={p.title}>
            <b>{p.title}</b>
            <span>{p.body}</span>
          </li>
        ))}
      </ol>

      <H2 id="how-to-study">How to study it</H2>
      <ul className="clean">
        <li>Work top to bottom in the sidebar. Modules are ordered from basic to advanced.</li>
        <li>For each interview question, set a 40-minute timer and design it on paper before opening the lesson.</li>
        <li>Compare your design with the lesson, then write down the two or three things you missed.</li>
        <li>Mark the chapter complete only when you can redraw the architecture and class diagram from memory.</li>
      </ul>
    </>
  );
}

function Roadmap() {
  return (
    <>
      <H2 id="plan">The plan</H2>
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
      <H2 id="weekly-habit">Weekly habit</H2>
      <p className="prose-p">
        Budget 6-8 hours a week: two fundamentals chapters, two interview questions done timed on paper, one LLD
        problem, and 30 minutes redrawing a design from an earlier week. Spaced repetition beats binge reading.
      </p>
      <p className="prose-p">
        The course has {MODULES.reduce((n, m) => n + m.chapters.length, 0)} chapters across {MODULES.length} modules.
      </p>
    </>
  );
}

function Framework() {
  return (
    <>
      <H2 id="steps">The six steps</H2>
      <div className="framework">
        {FRAMEWORK.map((s) => (
          <div className="step" key={s.title}>
            <div className="step-k">
              {s.step} <span>{s.minutes}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      <H2 id="mistakes">Common mistakes</H2>
      <ul className="clean">
        <li>Drawing boxes before agreeing on requirements and scale.</li>
        <li>Naming technologies (Kafka, Cassandra) without saying why they fit this workload.</li>
        <li>Going deep on one component and never covering the end-to-end read and write paths.</li>
        <li>Ignoring failure: what happens when a node, a region or a dependency goes down.</li>
        <li>Presenting one option as the only answer instead of comparing two and choosing.</li>
      </ul>
    </>
  );
}

function ConceptsCheatSheet() {
  return (
    <>
      <H2 id="concepts-list">The 12 concepts</H2>
      <div className="info-cards">
        {CORE_CONCEPTS.map((c) => (
          <div className="info-card" key={c.term}>
            <div className="t">{c.term}</div>
            <div className="d">{c.def}</div>
          </div>
        ))}
      </div>
      <p className="prose-p muted">Each of these has a full chapter in the Fundamentals track.</p>
    </>
  );
}

export default function IntroContent({ slug }: { slug: string }) {
  if (slug === "introduction") return <Introduction />;
  if (slug === "roadmap") return <Roadmap />;
  if (slug === "interview-framework") return <Framework />;
  return <ConceptsCheatSheet />;
}
