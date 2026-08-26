import { CodeBlock } from "@/components/ui/CodeBlock";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { type Components, MarkdownHooks as Markdown } from "react-markdown";
import remarkGfm from "remark-gfm";

function isBlockCode(className: string | undefined, children: ReactNode): boolean {
  if (className && /language-/.test(className)) return true;
  if (typeof children === "string" && children.includes("\n")) return true;
  return false;
}

/** Extract a KB slug from a relative .md link, or null if it isn't a KB doc link.
 *  `01_overview.md` → `01_overview`; `sources.md` → `sources`; `../docs/x.md` → null. */
function kbSlugFromHref(href: string): string | null {
  if (/^https?:\/\//i.test(href)) return null;
  if (href.startsWith("/")) return null;
  const clean = href.split("#")[0]?.split("?")[0];
  if (!clean || !clean.endsWith(".md")) return null;
  const base = clean.split("/").pop();
  if (!base || !base.endsWith(".md")) return null;
  return base.replace(/\.md$/, "");
}

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({
    className,
    children,
    node,
    ...props
  }: ComponentPropsWithoutRef<"code"> & {
    node?: unknown;
  }) => {
    const text = String(children ?? "");
    if (isBlockCode(className, children)) {
      const match = /language-(\w+)/.exec(className ?? "");
      return <CodeBlock code={text.replace(/\n$/, "")} lang={match?.[1]} />;
    }
    return (
      <code className="rounded-none bg-panel-2 px-1 py-0.5 text-info" {...props}>
        {children}
      </code>
    );
  },
  a: ({ href, children }) => {
    if (!href) return <span>{children}</span>;
    if (/^https?:\/\//i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    const slug = kbSlugFromHref(href);
    if (slug) {
      return (
        <a href={`/knowledge-base/${slug}`} className="text-info hover:underline">
          {children}
        </a>
      );
    }
    return (
      <span className="text-text-dim" title={`not bundled: ${href}`}>
        {children}
      </span>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-panel-2 px-2 py-1 text-left text-text-dim">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-accent-dim pl-3 text-text-dim">
      {children}
    </blockquote>
  ),
  hr: () => <div className="ascii-divider my-4">{"─".repeat(80)}</div>,
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl text-accent">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 border-b border-border pb-1 text-lg text-text">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-base text-text">{children}</h3>,
  ul: ({ children }) => <ul className="my-2 list-none space-y-1 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-none space-y-1 pl-1">{children}</ol>,
  li: ({ children }) => (
    <li className="relative pl-4 before:absolute before:left-0 before:text-accent before:content-['▸']">
      {children}
    </li>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
};

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose-invert max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        fallback={<p className="text-xs text-text-faint">rendering markdown…</p>}
      >
        {content}
      </Markdown>
    </div>
  );
}
