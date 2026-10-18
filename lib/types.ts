export type Difficulty = "easy" | "medium" | "hard";

export type Level = "basic" | "intermediate" | "advanced";

export interface StackItem {
  layer: string;
  pick: string;
  why: string;
}

export interface TradeOff {
  question: string;
  a: string;
  b: string;
  verdict: string;
}

export interface Concept {
  term: string;
  def: string;
}

export interface Question {
  slug: string;
  title: string;
  company: string;
  difficulty: Difficulty;
  tags: string[];
  requirements: { functional: string[]; nonFunctional: string[] };
  scale: { value: string; label: string }[];
  concepts: Concept[];
  diagram: string;
  hld: string[];
  api: string[];
  lld: string[];
  stack: StackItem[];
  tradeoffs: TradeOff[];
}

/**
 * Building blocks for article-style chapters (fundamentals, LLD, advanced).
 * Text fields accept **bold** and `code` inline markup.
 * Diagram charts are Mermaid source: flowchart ("graph LR/TD"), "sequenceDiagram" or "classDiagram".
 * In flowcharts the node shape sets its color: (["x"]) client, ["x"] service,
 * [("x")] database, {{"x"}} cache/index/edge, [["x"]] queue/coordinator.
 */
export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "diagram"; chart: string; caption?: string }
  | { type: "code"; lang: string; code: string; caption?: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "callout"; tone: "tip" | "warning" | "interview"; title?: string; text: string }
  | { type: "tradeoff"; question: string; a: string; b: string; verdict: string }
  | { type: "cards"; items: { title: string; text: string }[] };

export interface ArticleSection {
  id: string;
  heading: string;
  blocks: Block[];
}

export interface Article {
  slug: string;
  title: string;
  level: Level;
  summary: string;
  tags: string[];
  sections: ArticleSection[];
}

/** Extra low-level design material for one HLD interview question, keyed by question slug. */
export interface QuestionLLD {
  classDiagram: string;
  sequenceDiagram: string;
  sequenceCaption: string;
  code: { lang: string; code: string; caption: string };
  patterns: { name: string; where: string }[];
}
