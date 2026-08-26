import { DOCS, loadBatcherSources, loadRegistryFiles, loadSources } from "@/lib/docs/loader";
import { saveAs } from "file-saver";
// Client-side bundle export for the Developer Hub (Module A). Assembles the committed
// knowledge base (markdown), the machine-readable registry JSON, the canonical Solidity
// sources, and the portal's own batcher contracts into a zip entirely in the browser
// (JSZip) and triggers a download. No backend.
import JSZip from "jszip";

export async function exportKnowledgeBundle(): Promise<void> {
  const zip = new JSZip();
  const docs = zip.folder("docs");
  for (const d of DOCS) docs?.file(`${d.filename}.md`, d.content);

  // Lazy-load the heavy .sol/.json sources only when exporting (keeps the main chunk small).
  const [registryFiles, sources, batcherSources] = await Promise.all([
    loadRegistryFiles(),
    loadSources(),
    loadBatcherSources(),
  ]);

  const registry = zip.folder("registry");
  for (const f of registryFiles) registry?.file(f.filename, f.content);

  const sourcesFolder = zip.folder("sources");
  for (const s of sources) sourcesFolder?.file(s.filename, s.content);

  const batchers = zip.folder("batchers");
  for (const b of batcherSources) batchers?.file(b.filename, b.content);

  zip.file(
    "README.txt",
    [
      "AFFECTION Terminal — Knowledge Bundle",
      "====================================",
      "",
      `Exported from AFF_TERMINAL on ${new Date().toISOString()}`,
      "",
      "Contents:",
      "  docs/      — the markdown knowledge base (single source of truth)",
      "  registry/  — machine-readable addresses.json + minting_rates.json",
      "  sources/   — verified canonical contract source (AFFECTION family)",
      "  batchers/  — the portal's own batcher contracts (UnifiedAffectionBatcher,",
      "               AtomicArbBatcher) — self-contained Solidity, no imports",
      "",
      "Re-verify every live value against an RPC; see docs/sources.md.",
      "Contract sources are also at https://github.com/busytoby/atropa_pulsechain",
      "",
      "Not financial advice. DYOR.",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `affection-knowledge-${stamp}.zip`);
}

export async function exportMarkdownPack(): Promise<void> {
  const chunks: string[] = [];
  
  chunks.push("# AFFECTION Terminal — Knowledge Bundle");
  chunks.push(`Exported on ${new Date().toISOString()}`);
  chunks.push("");
  chunks.push("This is a single-file pack of the AFFECTION ecosystem knowledge base, registry, and contract sources.");
  chunks.push("");

  const [registryFiles, sources, batcherSources] = await Promise.all([
    loadRegistryFiles(),
    loadSources(),
    loadBatcherSources(),
  ]);

  const addFile = (folder: string, filename: string, content: string, ext: string) => {
    chunks.push(`================================================================`);
    chunks.push(`File: ${folder}/${filename}`);
    chunks.push(`================================================================`);
    
    // Only wrap in code fences if it's not already markdown
    if (ext === "md") {
      chunks.push(content);
    } else {
      chunks.push(`\`\`\`${ext}`);
      chunks.push(content);
      chunks.push(`\`\`\``);
    }
    chunks.push("");
  };

  for (const d of DOCS) addFile("docs", `${d.filename}.md`, d.content, "md");
  for (const f of registryFiles) addFile("registry", f.filename, f.content, "json");
  for (const s of sources) addFile("sources", s.filename, s.content, "solidity");
  for (const b of batcherSources) addFile("batchers", b.filename, b.content, "solidity");

  const blob = new Blob([chunks.join("\n")], { type: "text/markdown;charset=utf-8" });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `affection-knowledge-pack-${stamp}.md`);
}
