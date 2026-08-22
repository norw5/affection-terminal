import { BATCHER_SOURCES, DOCS, REGISTRY_FILES, SOURCES } from "@/lib/docs/loader";
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

  const registry = zip.folder("registry");
  for (const f of REGISTRY_FILES) registry?.file(f.filename, f.content);

  const sources = zip.folder("sources");
  for (const s of SOURCES) sources?.file(s.filename, s.content);

  const batchers = zip.folder("batchers");
  for (const b of BATCHER_SOURCES) batchers?.file(b.filename, b.content);

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
