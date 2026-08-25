// Build-time loader for the committed knowledge base. The .md/.sol/.json files in
// affection_docs/ are imported at build time via import.meta.glob (?raw) so the portal is
// fully static/offline-capable while keeping a single source of truth (the committed files).
//
// NOTE: paths are relative to this file (src/lib/docs/), so affection_docs/ is 3 levels up.

export type Doc = { slug: string; title: string; filename: string; content: string };

const mdModules = import.meta.glob("../../../affection_docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function titleFromFilename(filename: string): string {
  // "03_minting_routes" -> "Minting Routes"
  const noPrefix = filename.replace(/^\d+_/, "");
  return noPrefix
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function titleFromContent(content: string): string | null {
  const m = content.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1]!.replace(/\s*\(.*\)$/, "") : null;
}

const entries = Object.entries(mdModules)
  .map(([path, content]) => {
    const filename = path.split("/").pop()!.replace(/\.md$/, "");
    const slug = filename;
    const title = titleFromContent(content) ?? titleFromFilename(filename);
    return { slug, title, filename, content } satisfies Doc;
  })
  .sort((a, b) => a.filename.localeCompare(b.filename));

export const DOCS: Doc[] = entries;
export const DOC_BY_SLUG = new Map(entries.map((d) => [d.slug, d]));
export const README: Doc | undefined = entries.find((d) => d.filename.toLowerCase() === "readme");

// Raw sources for the export bundle (Module A). The canonical AFFECTION-family Solidity
// (affection/conjecture/dynamic/faung/fa/addresses) — the verified on-chain sources only.
// The portal's own batcher contracts (contracts/*.sol) are bundled alongside these; the
// old community multi-mint sources are deliberately NOT bundled (not maintained/vouched
// for — see affection_docs/sources.md).
//
// These are lazy-loaded (eager: false) so they only enter the bundle when the user exports
// the knowledge bundle — keeps the main chunk small (the .sol sources are ~200KB of text).
const solModules = import.meta.glob("../../../affection_docs/sources/*.sol", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export async function loadSources(): Promise<{ filename: string; content: string }[]> {
  const entries = await Promise.all(
    Object.entries(solModules).map(async ([path, mod]) => ({
      filename: path.split("/").pop()!,
      content: await mod(),
    })),
  );
  return entries.sort((a, b) => a.filename.localeCompare(b.filename));
}

// The portal's own batcher contracts — authored + maintained by this portal, shipped in
// the knowledge bundle so users can read/recompile/verify what the wizard deploys.
const batcherModules = import.meta.glob("../../../contracts/*.sol", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export async function loadBatcherSources(): Promise<{ filename: string; content: string }[]> {
  const entries = await Promise.all(
    Object.entries(batcherModules).map(async ([path, mod]) => ({
      filename: path.split("/").pop()!,
      content: await mod(),
    })),
  );
  return entries.sort((a, b) => a.filename.localeCompare(b.filename));
}

const jsonModules = import.meta.glob("../../../affection_docs/registry/*.json", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export async function loadRegistryFiles(): Promise<{ filename: string; content: string }[]> {
  const entries = await Promise.all(
    Object.entries(jsonModules).map(async ([path, mod]) => ({
      filename: path.split("/").pop()!,
      content: await mod(),
    })),
  );
  return entries.sort((a, b) => a.filename.localeCompare(b.filename));
}
