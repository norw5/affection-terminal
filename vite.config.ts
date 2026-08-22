import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// AFF_TERMINAL — Vite config for a pure-static SPA.
// No SSR. Output is plain static files in dist/ (hostable on Vercel/CF Pages).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // Split heavy deps so the initial terminal shell is light.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          web3: ["viem", "wagmi"],
          query: ["@tanstack/react-query", "@tanstack/react-router"],
        },
      },
      // Silence benign "/*#__PURE__*/ comment" warnings from transitive deps
      // (e.g. @reown/appkit's internal ox-core) that Rollup tree-shakes out of the
      // production bundle anyway. Verified: no "reown"/"appkit" in dist output.
      onwarn(warning, defaultHandler) {
        if (/comment/.test(warning.message)) return;
        defaultHandler(warning);
      },
    },
  },
});
