import type { QuestionChapter } from "@/lib/curriculum";
import { TradeOffCard } from "./Blocks";
import CodeBlock from "./CodeBlock";
import Mermaid from "./Mermaid";
import RichText from "./RichText";

function H2({ id, children, eyebrow }: { id: string; children: React.ReactNode; eyebrow?: string }) {
  return (
    <h2 id={id} className="lesson-h2">
      {eyebrow && <span className="h2-eyebrow">{eyebrow}</span>}
      {children}
    </h2>
  );
}

export default function QuestionLesson({ chapter }: { chapter: QuestionChapter }) {
  const { question: q, lld } = chapter;
  return (
    <>
      <H2 id="requirements" eyebrow="Step 1">
        Requirements
      </H2>
      <div className="two-col">
        <div className="panel-box">
          <div className="bt accent">Functional</div>
          <ul className="clean">
            {q.requirements.functional.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="panel-box">
          <div className="bt sky">Non-functional</div>
          <ul className="clean sky">
            {q.requirements.nonFunctional.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>

      <H2 id="scale" eyebrow="Step 2">
        Scale estimation
      </H2>
      <div className="scale-grid">
        {q.scale.map((s) => (
          <div className="scale-tile" key={s.label}>
            <div className="v">{s.value}</div>
            <div className="k">{s.label}</div>
          </div>
        ))}
      </div>

      <H2 id="concepts">Key concepts</H2>
      <div className="info-cards">
        {q.concepts.map((c) => (
          <div className="info-card" key={c.term}>
            <div className="t">{c.term}</div>
            <div className="d">{c.def}</div>
          </div>
        ))}
      </div>

      <H2 id="hld" eyebrow="Step 3-4">
        High-level design
      </H2>
      <Mermaid chart={q.diagram} />
      <ul className="clean">
        {q.hld.map((x) => (
          <li key={x}>
            <RichText text={x} />
          </li>
        ))}
      </ul>
      <h3 className="lesson-h3">API sketch</h3>
      <pre className="api">
        {q.api.map((line, i) => (
          <span key={i} className={line.startsWith("//") ? "c" : undefined}>
            {line}
            {"\n"}
          </span>
        ))}
      </pre>

      <H2 id="lld" eyebrow="Step 5">
        Low-level design
      </H2>
      <ul className="clean">
        {q.lld.map((x) => (
          <li key={x}>
            <RichText text={x} />
          </li>
        ))}
      </ul>

      {lld && (
        <>
          <h3 id="class-diagram" className="lesson-h3 anchored">
            Class diagram
          </h3>
          <Mermaid chart={lld.classDiagram} legend={false} />
          {lld.patterns.length > 0 && (
            <div className="pattern-row">
              {lld.patterns.map((p) => (
                <div className="pattern-chip" key={p.name}>
                  <b>{p.name}</b>
                  <span>
                    <RichText text={p.where} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <h3 id="request-flow" className="lesson-h3 anchored">
            Request flow
          </h3>
          <p className="prose-p muted">{lld.sequenceCaption}</p>
          <Mermaid chart={lld.sequenceDiagram} legend={false} />

          <h3 id="code" className="lesson-h3 anchored">
            Code walkthrough
          </h3>
          <CodeBlock code={lld.code.code} lang={lld.code.lang} caption={lld.code.caption} />
        </>
      )}

      <H2 id="stack">Tech stack</H2>
      <div className="panel-box">
        {q.stack.map((s) => (
          <div className="stack-row" key={s.layer}>
            <div className="stack-layer">{s.layer}</div>
            <div>
              <div className="stack-pick">{s.pick}</div>
              <div className="stack-why">{s.why}</div>
            </div>
          </div>
        ))}
      </div>

      <H2 id="tradeoffs" eyebrow="Step 6">
        Trade-offs
      </H2>
      <div className="trades">
        {q.tradeoffs.map((t) => (
          <TradeOffCard key={t.question} t={t} />
        ))}
      </div>
    </>
  );
}
