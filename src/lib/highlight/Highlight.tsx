import { resolveLang, tokenize } from "./tokenize";

// Renders tokenized source as <span>s keyed to the terminal palette via `.tok-*` classes
// (see globals.css). `lang` is resolved leniently; unknown langs fall back to plain text.
// Output preserves whitespace via `pre`/`white-space: pre` so the surrounding layout need
// not add its own — this component only emits the <code> body.
export function Highlight({ code, lang }: { code: string; lang?: string }) {
  const resolved = resolveLang(lang);
  const tokens = tokenize(code, resolved);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={`t-${i}-${t.text.length}`} className={`tok-${t.type}`}>
          {t.text}
        </span>
      ))}
    </>
  );
}
