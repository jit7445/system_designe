import { Lightbulb, MessageSquareQuote, TriangleAlert } from "lucide-react";
import type { Block, TradeOff } from "@/lib/types";
import CodeBlock from "./CodeBlock";
import Mermaid from "./Mermaid";
import RichText from "./RichText";

const CALLOUT_ICON = { tip: Lightbulb, warning: TriangleAlert, interview: MessageSquareQuote };
const CALLOUT_TITLE = { tip: "Tip", warning: "Watch out", interview: "What interviewers look for" };

export function TradeOffCard({ t }: { t: TradeOff }) {
  return (
    <div className="trade">
      <div className="trade-q">
        <RichText text={t.question} />
      </div>
      <div className="trade-opts">
        <div className="trade-opt">
          <span className="lbl">Option A</span>
          <RichText text={t.a} />
        </div>
        <div className="trade-opt">
          <span className="lbl">Option B</span>
          <RichText text={t.b} />
        </div>
      </div>
      <div className="trade-verdict">
        <b>Pick:</b> <RichText text={t.verdict} />
      </div>
    </div>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p className="prose-p">
          <RichText text={block.text} />
        </p>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <RichText text={item} />
        </li>
      ));
      return block.ordered ? <ol className="prose-ol">{items}</ol> : <ul className="clean">{items}</ul>;
    }
    case "diagram":
      return (
        <div className="block-diagram">
          <Mermaid chart={block.chart} />
          {block.caption && <p className="diagram-caption">{block.caption}</p>}
        </div>
      );
    case "code":
      return <CodeBlock code={block.code} lang={block.lang} caption={block.caption} />;
    case "table":
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th key={i}>
                    <RichText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout": {
      const Icon = CALLOUT_ICON[block.tone];
      return (
        <aside className={`callout ${block.tone}`}>
          <Icon size={18} aria-hidden />
          <div>
            <div className="callout-title">{block.title ?? CALLOUT_TITLE[block.tone]}</div>
            <p>
              <RichText text={block.text} />
            </p>
          </div>
        </aside>
      );
    }
    case "tradeoff":
      return <TradeOffCard t={block} />;
    case "cards":
      return (
        <div className="info-cards">
          {block.items.map((item, i) => (
            <div className="info-card" key={i}>
              <div className="t">
                <RichText text={item.title} />
              </div>
              <div className="d">
                <RichText text={item.text} />
              </div>
            </div>
          ))}
        </div>
      );
  }
}
