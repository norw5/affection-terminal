import { Highlight } from "@/lib/highlight/Highlight";
import { CopyButton } from "./CopyButton";

/** A code block with a language label, syntax highlighting, and copy button.
 *  Highlighting is dep-free (src/lib/highlight); unknown langs fall back to plain text.
 *  `label` overrides the displayed language name (useful when the label is richer than the
 *  highlight language, e.g. "abi · json" while still highlighting as JSON). */
export function CodeBlock({
  code,
  lang,
  label,
}: {
  code: string;
  lang?: string;
  label?: string;
}) {
  return (
    <div className="my-3 border border-border bg-panel-2">
      <div className="flex items-center justify-between border-b border-border px-3 py-1 text-xs uppercase tracking-wider text-text-faint">
        <span>{label ?? lang ?? "text"}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>
          <Highlight code={code} lang={lang} />
        </code>
      </pre>
    </div>
  );
}
