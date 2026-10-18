import CourseShell from "@/components/CourseShell";
import { NAV } from "@/lib/nav";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <CourseShell nav={NAV}>{children}</CourseShell>;
}
