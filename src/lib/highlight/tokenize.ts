// Dependency-free syntax highlighter for the AFFECTION Terminal.
//
// Rationale: react-syntax-highlighter/prism is a large dependency we don't need — the
// content here is well-defined (Solidity contracts, JSON ABIs, bash snippets). A small
// rule-based tokenizer covers the languages we render, integrates cleanly with the
// terminal palette via CSS token classes (see globals.css), and is fully unit-testable.
//
// Design: a language is an ordered list of rules. The tokenizer walks the source left to
// right; at each position it tries each rule's *sticky* regex, first match wins. Whitespace
// and identifiers fall through to defaults. Identifiers are then re-classified by
// keyword/type sets and by "is followed by `(`" (function name) in a pass. JSON object keys
// (a string immediately followed by `:`) are re-typed as "property" in a final pass.

export type TokenType =
  | "keyword"
  | "type"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "punct"
  | "operator"
  | "property"
  | "constant"
  | "variable"
  | "ident"
  | "text";

export type Token = { type: TokenType; text: string };

type Rule = { type: TokenType; re: RegExp };

const STICKY = (re: string) => new RegExp(re, "y");

const IDENT_RE = STICKY("[A-Za-z_$][A-Za-z0-9_$]*");
const WS_RE = STICKY("\\s+");
const PUNCT_RE = STICKY("[{}()\\[\\];,.:@?]");
const OPERATOR_RE = STICKY(
  "(?:->|=>|\\+\\+|--|[+\\-*/%]=|&&|\\|\\||==|!=|<=|>=|<<|>>|[+\\-*/%<>=!&|^~])+",
);
const NUMBER_RE = STICKY("0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?");
const LINE_COMMENT_RE = STICKY("//[^\\n]*");
const BLOCK_COMMENT_RE = STICKY("/\\*[\\s\\S]*?\\*/");
const DOUBLE_STRING_RE = STICKY('"(?:\\\\.|[^"\\\\])*"');
const SINGLE_STRING_RE = STICKY("'(?:\\\\.|[^'\\\\])*'");
const TEMPLATE_STRING_RE = STICKY("`(?:\\\\.|[^`\\\\])*`");
const BASH_COMMENT_RE = STICKY("#[^\\n]*");
const BASH_VAR_RE = STICKY("\\$\\{[^}]*\\}|\\$[A-Za-z_]\\w*");
const BASH_FLAG_RE = STICKY("--?[A-Za-z][\\w-]*");
const BASH_SINGLE_RE = STICKY("'[^']*'");

function rule(re: RegExp, type: TokenType): Rule {
  return { type, re };
}

const SOLIDITY_RULES: Rule[] = [
  rule(BLOCK_COMMENT_RE, "comment"),
  rule(LINE_COMMENT_RE, "comment"),
  rule(DOUBLE_STRING_RE, "string"),
  rule(SINGLE_STRING_RE, "string"),
  rule(NUMBER_RE, "number"),
  rule(OPERATOR_RE, "operator"),
  rule(PUNCT_RE, "punct"),
];

const SOLIDITY_KEYWORDS = new Set([
  "pragma",
  "solidity",
  "import",
  "using",
  "for",
  "contract",
  "interface",
  "library",
  "abstract",
  "is",
  "struct",
  "enum",
  "mapping",
  "function",
  "constructor",
  "fallback",
  "receive",
  "modifier",
  "virtual",
  "override",
  "public",
  "private",
  "internal",
  "external",
  "view",
  "pure",
  "payable",
  "returns",
  "return",
  "memory",
  "storage",
  "calldata",
  "constant",
  "immutable",
  "unchecked",
  "if",
  "else",
  "while",
  "do",
  "break",
  "continue",
  "new",
  "delete",
  "require",
  "assert",
  "revert",
  "emit",
  "this",
  "super",
  "try",
  "catch",
  "event",
  "error",
  "assembly",
  "switch",
  "case",
  "default",
]);

function isSolidityType(ident: string): boolean {
  if (SOLIDITY_KEYWORDS.has(ident)) return false;
  if (ident === "address" || ident === "bool" || ident === "string") return true;
  if (/^(u?int\d+|bytes\d{1,2}|byte)$/.test(ident)) return true;
  return false;
}

const TYPESCRIPT_RULES: Rule[] = [
  rule(BLOCK_COMMENT_RE, "comment"),
  rule(LINE_COMMENT_RE, "comment"),
  rule(TEMPLATE_STRING_RE, "string"),
  rule(DOUBLE_STRING_RE, "string"),
  rule(SINGLE_STRING_RE, "string"),
  rule(NUMBER_RE, "number"),
  rule(OPERATOR_RE, "operator"),
  rule(PUNCT_RE, "punct"),
];

const TYPESCRIPT_KEYWORDS = new Set([
  "abstract",
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "implements",
  "import",
  "from",
  "for",
  "if",
  "in",
  "instanceof",
  "interface",
  "let",
  "module",
  "namespace",
  "new",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "type",
  "typeof",
  "var",
  "void",
  "while",
  "yield",
  "get",
  "set",
  "satisfies",
  "keyof",
  "infer",
  "is",
]);

const TYPESCRIPT_CONSTANTS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

const BASH_RULES: Rule[] = [
  rule(BASH_COMMENT_RE, "comment"),
  rule(BASH_SINGLE_RE, "string"),
  rule(DOUBLE_STRING_RE, "string"),
  rule(BASH_VAR_RE, "variable"),
  rule(BASH_FLAG_RE, "property"),
  rule(NUMBER_RE, "number"),
  rule(PUNCT_RE, "punct"),
];

const JSON_RULES: Rule[] = [
  rule(DOUBLE_STRING_RE, "string"),
  rule(NUMBER_RE, "number"),
  rule(PUNCT_RE, "punct"),
];

const JSON_CONSTANTS = new Set(["true", "false", "null"]);

export type Lang = "solidity" | "typescript" | "json" | "bash" | "text";

function rulesFor(lang: Lang): Rule[] {
  switch (lang) {
    case "solidity":
      return SOLIDITY_RULES;
    case "typescript":
      return TYPESCRIPT_RULES;
    case "json":
      return JSON_RULES;
    case "bash":
      return BASH_RULES;
    case "text":
      return [];
  }
}

function peekNextNonWsChar(code: string, from: number): string | null {
  let j = from;
  while (j < code.length && /\s/.test(code[j] ?? "")) j++;
  return j < code.length ? (code[j] ?? null) : null;
}

function classifyIdent(ident: string, nextNonWsChar: string | null, lang: Lang): TokenType {
  switch (lang) {
    case "solidity":
      if (SOLIDITY_KEYWORDS.has(ident)) return "keyword";
      if (isSolidityType(ident)) return "type";
      if (nextNonWsChar === "(") return "function";
      return "ident";
    case "typescript":
      if (TYPESCRIPT_KEYWORDS.has(ident)) return "keyword";
      if (TYPESCRIPT_CONSTANTS.has(ident)) return "constant";
      if (/^[A-Z]/.test(ident) && nextNonWsChar !== "(") return "type";
      if (nextNonWsChar === "(") return "function";
      return "ident";
    case "json":
      if (JSON_CONSTANTS.has(ident)) return "constant";
      return "ident";
    default:
      return "ident";
  }
}

export function tokenize(code: string, lang: Lang): Token[] {
  if (lang === "text" || code.length === 0) return [{ type: "text", text: code }];
  const rules = rulesFor(lang);
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    WS_RE.lastIndex = i;
    const ws = WS_RE.exec(code);
    if (ws && ws[0] !== "") {
      tokens.push({ type: "text", text: ws[0] });
      i = WS_RE.lastIndex;
      continue;
    }

    let matched = false;
    for (const r of rules) {
      r.re.lastIndex = i;
      const m = r.re.exec(code);
      if (m && m[0] !== "") {
        tokens.push({ type: r.type, text: m[0] });
        i = r.re.lastIndex;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    IDENT_RE.lastIndex = i;
    const ident = IDENT_RE.exec(code);
    if (ident && ident[0] !== "") {
      const nextChar = peekNextNonWsChar(code, IDENT_RE.lastIndex);
      tokens.push({ type: classifyIdent(ident[0], nextChar, lang), text: ident[0] });
      i = IDENT_RE.lastIndex;
      continue;
    }

    tokens.push({ type: "text", text: code[i] ?? "" });
    i++;
  }

  return retypeJsonKeys(tokens);
}

function retypeJsonKeys(tokens: Token[]): Token[] {
  let out = tokens;
  for (let k = 0; k < out.length; k++) {
    const tk = out[k];
    if (!tk || tk.type !== "string") continue;
    let j = k + 1;
    while (j < out.length && out[j]?.type === "text") j++;
    const next = out[j];
    if (next && next.type === "punct" && next.text.includes(":")) {
      out = out.slice(0, k).concat([{ type: "property", text: tk.text }], out.slice(k + 1));
    }
  }
  return out;
}

export function supportedLangs(): Lang[] {
  return ["solidity", "typescript", "json", "bash", "text"];
}

export function resolveLang(name: string | undefined): Lang {
  if (!name) return "text";
  const n = name.toLowerCase();
  if (n === "sol" || n === "solidity") return "solidity";
  if (n === "ts" || n === "tsx" || n === "typescript" || n === "js" || n === "jsx")
    return "typescript";
  if (n === "json" || n === "json5" || n === "abi") return "json";
  if (n === "bash" || n === "sh" || n === "shell" || n === "console") return "bash";
  return "text";
}
