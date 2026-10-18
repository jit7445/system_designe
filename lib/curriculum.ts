import { ADVANCED_ARTICLES } from "./content/advanced";
import { FUNDAMENTALS_COMMS } from "./content/fundamentals-1";
import { FUNDAMENTALS_DATA } from "./content/fundamentals-2";
import { LLD_PART_1 } from "./content/lld-1";
import { LLD_PART_2 } from "./content/lld-2";
import { QUESTION_LLD_1 } from "./content/question-lld-1";
import { QUESTION_LLD_2 } from "./content/question-lld-2";
import { QUESTIONS } from "./questions";
import type { Article, Block, Level, Question, QuestionLLD } from "./types";

export type ModuleIcon =
  | "start"
  | "network"
  | "data"
  | "storage"
  | "traffic"
  | "realtime"
  | "search"
  | "media"
  | "transactions"
  | "oop"
  | "lld"
  | "advanced";

export type TrackId = "start" | "fundamentals" | "hld" | "lld" | "advanced";

interface SectionRef {
  id: string;
  label: string;
}

export interface IntroChapter {
  kind: "intro";
  slug: string;
  title: string;
  summary: string;
  sections: SectionRef[];
}

export interface ArticleChapter {
  kind: "article";
  slug: string;
  title: string;
  article: Article;
  sections: SectionRef[];
}

export interface QuestionChapter {
  kind: "question";
  slug: string;
  title: string;
  question: Question;
  lld: QuestionLLD | null;
  sections: SectionRef[];
}

export type Chapter = IntroChapter | ArticleChapter | QuestionChapter;

export interface CourseModule {
  id: string;
  title: string;
  icon: ModuleIcon;
  track: TrackId;
  level: Level;
  chapters: Chapter[];
}

const QUESTION_LLD: Record<string, QuestionLLD> = { ...QUESTION_LLD_1, ...QUESTION_LLD_2 };

const QUESTION_SECTIONS: SectionRef[] = [
  { id: "requirements", label: "Requirements" },
  { id: "scale", label: "Scale estimation" },
  { id: "concepts", label: "Key concepts" },
  { id: "hld", label: "High-level design" },
  { id: "lld", label: "Low-level design" },
  { id: "class-diagram", label: "Class diagram" },
  { id: "request-flow", label: "Request flow" },
  { id: "code", label: "Code walkthrough" },
  { id: "stack", label: "Tech stack" },
  { id: "tradeoffs", label: "Trade-offs" },
];

const INTRO: IntroChapter[] = [
  {
    kind: "intro",
    slug: "introduction",
    title: "Course Introduction",
    summary: "What this course covers, how it is organized from basic to advanced, and how to study it.",
    sections: [
      { id: "about", label: "What this course is" },
      { id: "tracks", label: "The five tracks" },
      { id: "lesson-parts", label: "How an HLD lesson is built" },
      { id: "how-to-study", label: "How to study it" },
    ],
  },
  {
    kind: "intro",
    slug: "roadmap",
    title: "8-Week Roadmap",
    summary: "A week-by-week plan from fundamentals to timed mock interviews.",
    sections: [
      { id: "plan", label: "The plan" },
      { id: "weekly-habit", label: "Weekly habit" },
    ],
  },
  {
    kind: "intro",
    slug: "interview-framework",
    title: "The Interview Framework",
    summary: "Six steps to structure any 45-minute system design interview.",
    sections: [
      { id: "steps", label: "The six steps" },
      { id: "mistakes", label: "Common mistakes" },
    ],
  },
  {
    kind: "intro",
    slug: "core-concepts",
    title: "Core Concepts Cheat Sheet",
    summary: "The building blocks that appear in almost every design, one line each.",
    sections: [{ id: "concepts-list", label: "The 12 concepts" }],
  },
];

function article(a: Article): ArticleChapter {
  return { kind: "article", slug: a.slug, title: a.title, article: a, sections: a.sections.map((s) => ({ id: s.id, label: s.heading })) };
}

function question(slug: string): QuestionChapter {
  const q = QUESTIONS.find((x) => x.slug === slug);
  if (!q) throw new Error(`Unknown question slug: ${slug}`);
  const lld = QUESTION_LLD[slug] ?? null;
  const sections = lld ? QUESTION_SECTIONS : QUESTION_SECTIONS.filter((s) => !["class-diagram", "request-flow", "code"].includes(s.id));
  return { kind: "question", slug, title: q.title, question: q, lld, sections };
}

const LLD_ALL = [...LLD_PART_1, ...LLD_PART_2];
const LLD_FOUNDATION_SLUGS = new Set(["oop-fundamentals", "solid-principles", "design-patterns-for-interviews", "lld-interview-approach"]);
const LEVEL_RANK: Record<Level, number> = { basic: 0, intermediate: 1, advanced: 2 };
const byLevel = (a: Article, b: Article) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level];

export const MODULES: CourseModule[] = [
  { id: "start", title: "Getting Started", icon: "start", track: "start", level: "basic", chapters: INTRO },
  { id: "networking", title: "Networking & APIs", icon: "network", track: "fundamentals", level: "basic", chapters: FUNDAMENTALS_COMMS.map(article) },
  { id: "data", title: "Data & Scale", icon: "data", track: "fundamentals", level: "intermediate", chapters: FUNDAMENTALS_DATA.map(article) },
  { id: "storage", title: "Storage & Key-Value", icon: "storage", track: "hld", level: "basic", chapters: ["url-shortener", "pastebin", "unique-id-generator"].map(question) },
  { id: "traffic", title: "Traffic & Async Work", icon: "traffic", track: "hld", level: "intermediate", chapters: ["rate-limiter", "notification-system", "job-scheduler", "message-queue"].map(question) },
  { id: "realtime", title: "Social & Real-Time", icon: "realtime", track: "hld", level: "intermediate", chapters: ["news-feed", "chat-system", "photo-sharing", "collaborative-editor"].map(question) },
  { id: "search", title: "Search & Location", icon: "search", track: "hld", level: "intermediate", chapters: ["web-crawler", "search-autocomplete", "nearby-places", "ride-hailing"].map(question) },
  { id: "media", title: "Media & Files", icon: "media", track: "hld", level: "advanced", chapters: ["video-streaming", "file-sync"].map(question) },
  { id: "transactions", title: "Transactions & Infra", icon: "transactions", track: "hld", level: "advanced", chapters: ["ticket-booking", "payment-system", "distributed-cache"].map(question) },
  { id: "lld-foundations", title: "LLD Foundations", icon: "oop", track: "lld", level: "basic", chapters: LLD_ALL.filter((a) => LLD_FOUNDATION_SLUGS.has(a.slug)).map(article) },
  { id: "lld-problems", title: "LLD Interview Problems", icon: "lld", track: "lld", level: "intermediate", chapters: LLD_ALL.filter((a) => !LLD_FOUNDATION_SLUGS.has(a.slug)).sort(byLevel).map(article) },
  { id: "advanced", title: "Advanced Distributed Systems", icon: "advanced", track: "advanced", level: "advanced", chapters: ADVANCED_ARTICLES.map(article) },
];

export const TRACKS: { id: TrackId; title: string; level: string; blurb: string }[] = [
  { id: "start", title: "Getting Started", level: "Start here", blurb: "The roadmap, the six-step interview framework and a cheat sheet of core concepts." },
  { id: "fundamentals", title: "System Design Fundamentals", level: "Basic", blurb: "Networking, APIs, load balancing, caching, databases, replication, sharding and queues." },
  { id: "hld", title: "HLD Interview Questions", level: "Intermediate", blurb: "20 classic systems, each with requirements, scale math, architecture, LLD and trade-offs." },
  { id: "lld", title: "Low-Level Design", level: "Intermediate", blurb: "OOP, SOLID, design patterns and worked object-oriented problems in Java." },
  { id: "advanced", title: "Advanced Distributed Systems", level: "Advanced", blurb: "Consensus, distributed transactions, event-driven design, reliability and multi-region." },
];

export const CHAPTERS: Chapter[] = MODULES.flatMap((m) => m.chapters);

export const TOTAL_CHAPTERS = CHAPTERS.length;

export function modulesInTrack(track: TrackId) {
  return MODULES.filter((m) => m.track === track);
}

export function getChapter(slug: string) {
  const index = CHAPTERS.findIndex((c) => c.slug === slug);
  if (index < 0) return null;
  const chapter = CHAPTERS[index];
  const module = MODULES.find((m) => m.chapters.some((c) => c.slug === slug))!;
  return {
    chapter,
    module,
    number: index + 1,
    prev: index > 0 ? CHAPTERS[index - 1] : null,
    next: index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null,
  };
}

export function chapterLevel(chapter: Chapter): Level | null {
  if (chapter.kind === "article") return chapter.article.level;
  if (chapter.kind === "question") return chapter.question.difficulty === "easy" ? "basic" : chapter.question.difficulty === "medium" ? "intermediate" : "advanced";
  return null;
}

function blockText(b: Block): string {
  switch (b.type) {
    case "p":
      return b.text;
    case "list":
      return b.items.join(" ");
    case "callout":
      return `${b.title ?? ""} ${b.text}`;
    case "tradeoff":
      return `${b.question} ${b.a} ${b.b} ${b.verdict}`;
    case "cards":
      return b.items.map((i) => `${i.title} ${i.text}`).join(" ");
    case "table":
      return [...b.head, ...b.rows.flat()].join(" ");
    case "code":
      return b.code.split(/\s+/).slice(0, 80).join(" ");
    default:
      return "";
  }
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function readingMinutes(chapter: Chapter) {
  if (chapter.kind === "intro") return 3;
  if (chapter.kind === "article") {
    const text = chapter.article.sections.flatMap((s) => s.blocks.map(blockText)).join(" ");
    return Math.max(3, Math.round(words(text) / 200) + 1);
  }
  const q = chapter.question;
  const text = [
    ...q.requirements.functional,
    ...q.requirements.nonFunctional,
    ...q.concepts.flatMap((c) => [c.term, c.def]),
    ...q.hld,
    ...q.lld,
    ...q.stack.flatMap((s) => [s.layer, s.pick, s.why]),
    ...q.tradeoffs.flatMap((t) => [t.question, t.a, t.b, t.verdict]),
  ].join(" ");
  return Math.max(5, Math.round(words(text) / 200) + (chapter.lld ? 5 : 2));
}
