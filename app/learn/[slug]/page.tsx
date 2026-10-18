import { Clock, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockView } from "@/components/Blocks";
import IntroContent from "@/components/IntroContent";
import LessonActions from "@/components/LessonActions";
import OnThisPage from "@/components/OnThisPage";
import QuestionLesson from "@/components/QuestionLesson";
import { CHAPTERS, TOTAL_CHAPTERS, chapterLevel, getChapter, readingMinutes } from "@/lib/curriculum";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return CHAPTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = getChapter(slug);
  if (!found) return {};
  const { chapter } = found;
  const description =
    chapter.kind === "article" ? chapter.article.summary : chapter.kind === "intro" ? chapter.summary : `Design ${chapter.title}: requirements, HLD, LLD, tech stack and trade-offs.`;
  return { title: chapter.title, description };
}

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const found = getChapter(slug);
  if (!found) notFound();
  const { chapter, module, number, prev, next } = found;
  const level = chapterLevel(chapter);

  return (
    <div className="lesson-grid">
      <article id="lesson-article" className="lesson">
        <header className="lesson-header">
          <Link href={`/learn/${module.chapters[0].slug}`} className="lesson-module">
            <Layers size={14} aria-hidden /> {module.title}
          </Link>
          <h1>{chapter.title}</h1>
          <div className="lesson-pills">
            <span className="meta-pill">
              <Clock size={14} aria-hidden /> {readingMinutes(chapter)} min read
            </span>
            {level && <span className={`meta-pill level ${level}`}>{level}</span>}
            {chapter.kind === "question" && <span className="meta-pill">Asked at {chapter.question.company}</span>}
            {chapter.kind === "question" && chapter.lld && <span className="meta-pill accent">HLD + LLD</span>}
          </div>
          {chapter.kind === "article" && <p className="lesson-summary">{chapter.article.summary}</p>}
          {chapter.kind === "intro" && <p className="lesson-summary">{chapter.summary}</p>}
        </header>

        <div className="lesson-card">
          {chapter.kind === "intro" && <IntroContent slug={chapter.slug} />}
          {chapter.kind === "question" && <QuestionLesson chapter={chapter} />}
          {chapter.kind === "article" &&
            chapter.article.sections.map((s) => (
              <section key={s.id}>
                <h2 id={s.id} className="lesson-h2">
                  {s.heading}
                </h2>
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </section>
            ))}
        </div>
      </article>

      <OnThisPage sections={chapter.sections} />

      <LessonActions
        slug={chapter.slug}
        number={number}
        total={TOTAL_CHAPTERS}
        prev={prev && { slug: prev.slug, title: prev.title }}
        next={next && { slug: next.slug, title: next.title }}
      />
    </div>
  );
}
