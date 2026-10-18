import { MODULES, chapterLevel } from "./curriculum";
import type { NavModule } from "./nav-types";

// Built on the server so client components get titles and slugs without the full chapter text.
export const NAV: NavModule[] = MODULES.map((m) => ({
  id: m.id,
  title: m.title,
  icon: m.icon,
  chapters: m.chapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    level: chapterLevel(c),
    keywords: [
      c.title,
      m.title,
      ...(c.kind === "question" ? [c.question.company, ...c.question.tags, "hld", "lld"] : []),
      ...(c.kind === "article" ? c.article.tags : []),
      ...c.sections.map((s) => s.label),
    ]
      .join(" ")
      .toLowerCase(),
  })),
}));
