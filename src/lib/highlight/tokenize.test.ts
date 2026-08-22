import { describe, expect, it } from "vitest";
import { type Token, resolveLang, supportedLangs, tokenize } from "./tokenize";

function types(tokens: Token[]): string {
  return tokens.map((t) => `${t.text}|${t.type}`).join(" ");
}

function compact(tokens: Token[]): string {
  return tokens
    .filter((t) => t.type !== "text" || t.text.trim() !== "")
    .map((t) => `[${t.type}]${t.text}`)
    .join(" ");
}

describe("resolveLang", () => {
  it("maps common aliases", () => {
    expect(resolveLang("sol")).toBe("solidity");
    expect(resolveLang("solidity")).toBe("solidity");
    expect(resolveLang("ts")).toBe("typescript");
    expect(resolveLang("tsx")).toBe("typescript");
    expect(resolveLang("js")).toBe("typescript");
    expect(resolveLang("json")).toBe("json");
    expect(resolveLang("abi")).toBe("json");
    expect(resolveLang("bash")).toBe("bash");
    expect(resolveLang("sh")).toBe("bash");
    expect(resolveLang("text")).toBe("text");
  });

  it("falls back to text for unknown", () => {
    expect(resolveLang("rust")).toBe("text");
    expect(resolveLang(undefined)).toBe("text");
    expect(resolveLang("")).toBe("text");
  });
});

describe("supportedLangs", () => {
  it("lists all five", () => {
    expect(supportedLangs()).toEqual(["solidity", "typescript", "json", "bash", "text"]);
  });
});

describe("tokenize text", () => {
  it("returns a single text token", () => {
    expect(tokenize("hello world", "text")).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("preserves the source verbatim", () => {
    const src = "line1\nline2\n  indented";
    const out = tokenize(src, "text")
      .map((t) => t.text)
      .join("");
    expect(out).toBe(src);
  });
});

describe("tokenize solidity", () => {
  it("classifies keywords, types, and functions", () => {
    const tokens = tokenize("function Generate() public view returns (uint256)", "solidity");
    expect(compact(tokens)).toBe(
      "[keyword]function [function]Generate [punct]( [punct]) [keyword]public [keyword]view [keyword]returns [punct]( [type]uint256 [punct])",
    );
  });

  it("highlights comments", () => {
    const tokens = tokenize("uint256 x = 1; // memo\n// line two", "solidity");
    const comments = tokens.filter((t) => t.type === "comment").map((t) => t.text);
    expect(comments).toEqual(["// memo", "// line two"]);
  });

  it("handles block comments spanning lines", () => {
    const tokens = tokenize("/* a\nb */ x", "solidity");
    expect(tokens.find((t) => t.type === "comment")?.text).toBe("/* a\nb */");
  });

  it("tokenizes hex literals and scientific notation", () => {
    const tokens = tokenize("uint256 a = 0xFF; uint256 b = 3e18;", "solidity");
    const nums = tokens.filter((t) => t.type === "number").map((t) => t.text);
    expect(nums).toEqual(["0xFF", "3e18"]);
  });

  it("recognizes sized int/bytes types", () => {
    const tokens = tokenize("uint8 int128 bytes32 address", "solidity");
    const types = tokens.filter((t) => t.type === "type").map((t) => t.text);
    expect(types).toEqual(["uint8", "int128", "bytes32", "address"]);
  });

  it("does not misclassify an identifier starting with 'int' as a type", () => {
    const tokens = tokenize("internal123 intThing", "solidity");
    const typeTokens = tokens.filter((t) => t.type === "type").map((t) => t.text);
    const idents = tokens.filter((t) => t.type === "ident").map((t) => t.text);
    expect(typeTokens).toEqual([]);
    expect(idents).toEqual(["internal123", "intThing"]);
  });

  it("round-trips the full source", () => {
    const src = "function foo(uint256 a) public pure returns (uint256) { return a * 2 + 0x1F; }";
    expect(
      tokenize(src, "solidity")
        .map((t) => t.text)
        .join(""),
    ).toBe(src);
  });
});

describe("tokenize json", () => {
  it("highlights keys, strings, numbers, and constants", () => {
    const src = '{"name": "AFFECTION", "cap": 5, "verified": true, "x": null}';
    const tokens = tokenize(src, "json");
    expect(compact(tokens)).toBe(
      '[punct]{ [property]"name" [punct]: [string]"AFFECTION" [punct], [property]"cap" [punct]: [number]5 [punct], [property]"verified" [punct]: [constant]true [punct], [property]"x" [punct]: [constant]null [punct]}',
    );
  });

  it("does not treat a string followed by a comma as a key", () => {
    const tokens = tokenize('["a", "b"]', "json");
    const props = tokens.filter((t) => t.type === "property");
    expect(props).toEqual([]);
    const strings = tokens.filter((t) => t.type === "string").map((t) => t.text);
    expect(strings).toEqual(['"a"', '"b"']);
  });

  it("round-trips a nested object", () => {
    const src = '{"a": {"b": 1}}';
    expect(
      tokenize(src, "json")
        .map((t) => t.text)
        .join(""),
    ).toBe(src);
  });
});

describe("tokenize bash", () => {
  it("highlights comments, flags, and variables", () => {
    const tokens = tokenize("curl --rpc $URL -X POST # go", "bash");
    expect(compact(tokens)).toBe(
      "[ident]curl [property]--rpc [variable]$URL [property]-X [ident]POST [comment]# go",
    );
  });

  it("handles single-quoted strings", () => {
    const tokens = tokenize("echo 'hello world'", "bash");
    expect(tokens.find((t) => t.type === "string")?.text).toBe("'hello world'");
  });

  it("round-trips", () => {
    const src = "npm run verify-supply 2>&1 | tail -20";
    expect(
      tokenize(src, "bash")
        .map((t) => t.text)
        .join(""),
    ).toBe(src);
  });
});

describe("tokenize typescript", () => {
  it("classifies keywords, operators, functions, and constants", () => {
    const tokens = tokenize("const x: number = foo(42, true);", "typescript");
    expect(compact(tokens)).toBe(
      "[keyword]const [ident]x [punct]: [ident]number [operator]= [function]foo [punct]( [number]42 [punct], [constant]true [punct]) [punct];",
    );
  });

  it("treats a capitalized identifier as a type, but a constructor call as a function", () => {
    const decl = tokenize("let x: Client", "typescript");
    expect(decl.find((t) => t.type === "type")?.text).toBe("Client");
    const call = tokenize("new Client()", "typescript");
    expect(call.filter((t) => t.type === "function").map((t) => t.text)).toEqual(["Client"]);
    expect(call.filter((t) => t.type === "type")).toEqual([]);
  });
});

describe("tokenize round-trips across languages", () => {
  const cases: Array<[string, ReturnType<typeof resolveLang>]> = [
    ["contract A {}", "solidity"],
    ['{ "a": 1 }', "json"],
    ["echo hi", "bash"],
    ["const x = 1;", "typescript"],
  ];
  for (const [src, lang] of cases) {
    it(`preserves source for ${lang}`, () => {
      expect(
        tokenize(src, lang)
          .map((t) => t.text)
          .join(""),
      ).toBe(src);
    });
  }
});

describe("tokenize handles edge cases without throwing", () => {
  it("empty string", () => {
    expect(tokenize("", "solidity")).toEqual([{ type: "text", text: "" }]);
  });

  it("lone operators and punctuation", () => {
    const t = tokenize("== >= => . , ;", "solidity");
    expect(t.map((x) => x.text).join("")).toBe("== >= => . , ;");
  });

  it("unterminated string does not loop forever", () => {
    const t = tokenize('{"a": "unterminated', "json");
    expect(t.map((x) => x.text).join("")).toBe('{"a": "unterminated');
  });

  it("unterminated block comment does not loop forever", () => {
    const t = tokenize("/* never ends", "solidity");
    expect(t.map((x) => x.text).join("")).toBe("/* never ends");
  });

  it("unused helper kept honest", () => {
    expect(types([])).toBe("");
  });
});
