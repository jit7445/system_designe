import { codeToHtml } from "shiki";
import CopyButton from "./CopyButton";

const LANG_ALIAS: Record<string, string> = { ts: "typescript", js: "javascript", sh: "bash", shell: "bash", yml: "yaml" };

async function highlight(code: string, lang: string) {
  const options = { themes: { light: "github-light", dark: "github-dark-default" }, defaultColor: false } as const;
  try {
    return await codeToHtml(code, { ...options, lang: LANG_ALIAS[lang] ?? lang });
  } catch {
    // Unknown language ids would otherwise fail the whole static build.
    return codeToHtml(code, { ...options, lang: "text" });
  }
}

export default async function CodeBlock({ code, lang, caption }: { code: string; lang: string; caption?: string }) {
  const html = await highlight(code.trim(), lang);
  return (
    <figure className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang}</span>
        {caption && <span className="code-caption">{caption}</span>}
        <CopyButton text={code.trim()} />
      </div>
      <div className="code-body" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}
