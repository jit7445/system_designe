import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ProgressProvider } from "@/components/ProgressProvider";
import TopNav from "@/components/TopNav";
import { NAV } from "@/lib/nav";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "SysDesign Prep", template: "%s · SysDesign Prep" },
  description: "System design from basic to advanced: fundamentals, 20 HLD interview questions with LLD, object-oriented design and distributed systems.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c10",
};

// Runs before first paint so a saved light theme never flashes the dark palette.
const themeScript = `try{var t=localStorage.getItem("sd_theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ProgressProvider>
          <TopNav nav={NAV} />
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
