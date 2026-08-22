import { MarkdownView } from "@/components/kb/MarkdownView";
import { DOCS, DOC_BY_SLUG } from "@/lib/docs/loader";
import { Link, useParams } from "@tanstack/react-router";

export function KBDoc() {
  const { doc: slug } = useParams({ from: "/kb/$doc" });
  const doc = DOC_BY_SLUG.get(slug);

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-err">404 — no such document: {slug}</p>
        <Link to="/kb" className="text-info hover:underline">
          ▸ back to knowledge base
        </Link>
      </div>
    );
  }

  const idx = DOCS.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? DOCS[idx - 1] : undefined;
  const next = idx >= 0 && idx < DOCS.length - 1 ? DOCS[idx + 1] : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-text-faint">
        <Link to="/kb" className="hover:text-text">
          knowledge-base
        </Link>
        <span>/</span>
        <span className="text-text-dim">{doc.filename}.md</span>
      </div>
      <MarkdownView key={slug} content={doc.content} />
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        {prev ? (
          <Link to="/kb/$doc" params={{ doc: prev.slug }} className="text-info hover:underline">
            ◂ {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to="/kb/$doc" params={{ doc: next.slug }} className="text-info hover:underline">
            {next.title} ▸
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
