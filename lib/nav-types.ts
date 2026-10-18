import type { ModuleIcon } from "./curriculum";
import type { Level } from "./types";

export interface NavChapter {
  slug: string;
  title: string;
  level: Level | null;
  keywords: string;
}

export interface NavModule {
  id: string;
  title: string;
  icon: ModuleIcon;
  chapters: NavChapter[];
}
