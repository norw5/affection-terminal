import type { Config } from "tailwindcss";

// AFF_TERMINAL — terminal/TUI design tokens.
// Colors are mapped to CSS custom properties defined in src/styles/globals.css so the
// palette is centralized. Sharp corners (radius 0) for the IDE/TUI aesthetic.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        panel: "var(--c-panel)",
        "panel-2": "var(--c-panel-2)",
        border: "var(--c-border)",
        "border-bright": "var(--c-border-bright)",
        text: "var(--c-text)",
        "text-dim": "var(--c-text-dim)",
        "text-faint": "var(--c-text-faint)",
        accent: "var(--c-accent)",
        "accent-dim": "var(--c-accent-dim)",
        ok: "var(--c-ok)",
        warn: "var(--c-warn)",
        err: "var(--c-err)",
        info: "var(--c-info)",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "0px",
        DEFAULT: "0px",
        md: "0px",
        lg: "0px",
      },
      fontSize: {
        // monospace-friendly sizes. Bumped +1px on the small end (xs/sm/base) for
        // readability; 14px and above are unchanged.
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.0625rem" }],
        base: ["0.875rem", { lineHeight: "1.25rem" }],
        lg: ["0.875rem", { lineHeight: "1.25rem" }],
        xl: ["1rem", { lineHeight: "1.375rem" }],
        "2xl": ["1.25rem", { lineHeight: "1.625rem" }],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
} satisfies Config;
