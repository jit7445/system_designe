"use client";

import { ArrowLeft, ArrowRight, Circle, CircleCheck, ListTree } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCourseShell } from "./CourseShell";
import { useProgress } from "./ProgressProvider";

interface Neighbour {
  slug: string;
  title: string;
}

export default function LessonActions({ slug, number, total, prev, next }: { slug: string; number: number; total: number; prev: Neighbour | null; next: Neighbour | null }) {
  const { isSolved, toggle } = useProgress();
  const { openDrawer } = useCourseShell();
  const router = useRouter();
  const done = isSolved(slug);

  function completeAndContinue() {
    if (!done) toggle(slug);
    if (next) router.push(`/learn/${next.slug}`);
  }

  return (
    <div className="action-bar" role="toolbar" aria-label="Lesson actions">
      <div className="ab-left">
        <button className="ab-btn ab-chapters" onClick={openDrawer}>
          <ListTree size={17} aria-hidden /> Chapters
        </button>
        <span className="ab-position">
          Chapter {number} of {total}
        </span>
      </div>
      <div className="ab-center">
        {prev ? (
          <Link href={`/learn/${prev.slug}`} className="ab-btn" title={prev.title}>
            <ArrowLeft size={17} aria-hidden /> <span className="ab-label">Previous</span>
          </Link>
        ) : (
          <span className="ab-btn disabled" aria-hidden>
            <ArrowLeft size={17} /> <span className="ab-label">Previous</span>
          </span>
        )}
        <button className={`ab-btn ab-complete${done ? " on" : ""}`} onClick={() => toggle(slug)} aria-pressed={done}>
          {done ? <CircleCheck size={17} aria-hidden /> : <Circle size={17} aria-hidden />}
          {done ? "Completed" : "Complete"}
        </button>
        {next ? (
          <button className="ab-btn ab-next" onClick={completeAndContinue} title={`Mark complete and go to ${next.title}`}>
            <span className="ab-label">Next</span> <ArrowRight size={17} aria-hidden />
          </button>
        ) : (
          <Link href="/" className="ab-btn ab-next">
            <span className="ab-label">Finish</span> <ArrowRight size={17} aria-hidden />
          </Link>
        )}
      </div>
      <div className="ab-right">{next && <span className="ab-upnext">Up next: {next.title}</span>}</div>
    </div>
  );
}
